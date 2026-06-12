const fs = require('fs');
const path = require('path');
const Catalog = require('../models/Catalog');
const { scanCatalogPdf, scanCatalogImage } = require('../services/geminiService');
const { parseExcelCatalog } = require('../services/excelService');
const { syncProductsFromCatalog } = require('../services/productService');
const {
    findMatchingCatalog,
    buildMergedDraft,
} = require('../services/companyMatchService');

const MIME_BY_EXT = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.csv': 'text/csv',
};

function resolveMimeType(catalog) {
    if (catalog.mimeType) {
        return catalog.mimeType;
    }
    const ext = path.extname(catalog.originalFileName || catalog.filePath || '').toLowerCase();
    return MIME_BY_EXT[ext] || 'application/octet-stream';
}

function detectSourceType(mimeType, fileName) {
    if (mimeType.startsWith('image/')) {
        return 'image';
    }
    if (
        mimeType.includes('spreadsheet')
        || mimeType.includes('excel')
        || mimeType === 'text/csv'
        || /\.(xlsx|xls|csv)$/i.test(fileName)
    ) {
        return 'excel';
    }
    return 'pdf';
}

async function extractFromFile(filePath, mimeType, sourceType) {
    if (sourceType === 'image') {
        return scanCatalogImage(filePath, mimeType);
    }
    if (sourceType === 'excel') {
        return {
            extracted: parseExcelCatalog(filePath),
            rawAiResponse: { source: 'excel' },
        };
    }
    return scanCatalogPdf(filePath);
}

const listCatalogs = async (req, res) => {
    try {
        const catalogs = await Catalog.find({ status: { $in: ['scanned', 'failed'] } })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        res.json({
            success: true,
            data: catalogs,
        });
    } catch (error) {
        console.error('listCatalogs error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch catalogs',
        });
    }
};

const getCatalogFile = async (req, res) => {
    try {
        const catalog = await Catalog.findById(req.params.id).lean();

        if (!catalog) {
            return res.status(404).json({
                success: false,
                message: 'Catalog not found',
            });
        }

        if (!catalog.filePath || !fs.existsSync(catalog.filePath)) {
            return res.status(404).json({
                success: false,
                message: 'File not found',
            });
        }

        const safeName = (catalog.originalFileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
        const mimeType = resolveMimeType(catalog);

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);

        const stream = fs.createReadStream(catalog.filePath);
        stream.on('error', (error) => {
            console.error('getCatalogFile stream error:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: 'Failed to read file',
                });
            }
        });
        stream.pipe(res);
    } catch (error) {
        console.error('getCatalogFile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch catalog file',
        });
    }
};

const getCatalog = async (req, res) => {
    try {
        const catalog = await Catalog.findById(req.params.id).lean();

        if (!catalog) {
            return res.status(404).json({
                success: false,
                message: 'Catalog not found',
            });
        }

        let matchedCatalog = null;
        if (catalog.matchedCatalogId) {
            matchedCatalog = await Catalog.findById(catalog.matchedCatalogId).lean();
        }

        res.json({
            success: true,
            data: {
                ...catalog,
                matchedCatalog,
            },
        });
    } catch (error) {
        console.error('getCatalog error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch catalog',
        });
    }
};

const uploadAndScanCatalog = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: 'No file uploaded',
        });
    }

    const mimeType = req.file.mimetype;
    const sourceType = detectSourceType(mimeType, req.file.originalname);

    const catalog = await Catalog.create({
        originalFileName: req.file.originalname,
        filePath: req.file.path,
        mimeType,
        sourceType,
        status: 'pending',
    });

    try {
        const { extracted, rawAiResponse } = await extractFromFile(
            req.file.path,
            mimeType,
            sourceType,
        );

        let draftData = extracted;
        let matchedCatalogId = null;
        let matchedCatalog = null;
        let mergeMessage = '';

        if (sourceType === 'image' || sourceType === 'excel') {
            matchedCatalog = await findMatchingCatalog(extracted.company);

            if (matchedCatalog) {
                matchedCatalogId = matchedCatalog._id;
                draftData = buildMergedDraft(matchedCatalog, extracted);
                mergeMessage = `Matched existing company "${matchedCatalog.company?.name}". Review merged data before saving.`;
            } else if (sourceType === 'image') {
                mergeMessage = 'No matching company found. A new catalog will be created after you save.';
            }
        }

        const updated = await Catalog.findByIdAndUpdate(
            catalog._id,
            {
                ...draftData,
                rawAiResponse,
                matchedCatalogId,
                status: 'draft',
            },
            { new: true },
        ).lean();

        res.json({
            success: true,
            data: {
                ...updated,
                matchedCatalog,
            },
            message: mergeMessage || 'File scanned. Review and save to store in database.',
        });
    } catch (error) {
        console.error('uploadAndScanCatalog error:', error);

        const errorMessage = error instanceof Error ? error.message : 'Failed to scan file';

        await Catalog.findByIdAndUpdate(catalog._id, {
            status: 'failed',
            errorMessage,
        });

        if (req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            success: false,
            message: errorMessage,
        });
    }
};

const saveCatalog = async (req, res) => {
    try {
        const catalog = await Catalog.findById(req.params.id);

        if (!catalog) {
            return res.status(404).json({
                success: false,
                message: 'Catalog not found',
            });
        }

        if (catalog.status !== 'draft') {
            return res.status(400).json({
                success: false,
                message: 'Only draft catalogs can be saved from review',
            });
        }

        const {
            company,
            contacts,
            products,
            extractedImageUrls,
        } = req.body;

        const attachment = {
            originalFileName: catalog.originalFileName,
            filePath: catalog.filePath,
            mimeType: catalog.mimeType,
            sourceType: catalog.sourceType,
        };

        if (catalog.matchedCatalogId) {
            const target = await Catalog.findById(catalog.matchedCatalogId);

            if (!target) {
                return res.status(404).json({
                    success: false,
                    message: 'Matched catalog no longer exists',
                });
            }

            target.company = company ?? target.company;
            target.contacts = Array.isArray(contacts) ? contacts : target.contacts;
            target.products = Array.isArray(products) ? products : target.products;
            target.extractedImageUrls = Array.isArray(extractedImageUrls)
                ? extractedImageUrls
                : target.extractedImageUrls;
            target.attachments = [...(target.attachments ?? []), attachment];
            target.status = 'scanned';
            target.errorMessage = '';

            await target.save();

            if (catalog.filePath && catalog.filePath !== target.filePath) {
                // keep draft file as attachment only
            }

            await Catalog.findByIdAndDelete(catalog._id);

            const saved = target.toObject();
            await syncProductsFromCatalog(saved);

            return res.json({
                success: true,
                data: saved,
                message: `Details merged into existing catalog for ${saved.company?.name || 'company'}`,
            });
        }

        catalog.company = company ?? catalog.company;
        catalog.contacts = Array.isArray(contacts) ? contacts : catalog.contacts;
        catalog.products = Array.isArray(products) ? products : catalog.products;
        catalog.extractedImageUrls = Array.isArray(extractedImageUrls)
            ? extractedImageUrls
            : catalog.extractedImageUrls;
        catalog.status = 'scanned';
        catalog.errorMessage = '';

        await catalog.save();

        const saved = catalog.toObject();
        await syncProductsFromCatalog(saved);

        res.json({
            success: true,
            data: saved,
            message: 'Catalog saved to database',
        });
    } catch (error) {
        console.error('saveCatalog error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save catalog',
        });
    }
};

const discardDraft = async (req, res) => {
    try {
        const catalog = await Catalog.findById(req.params.id);

        if (!catalog) {
            return res.status(404).json({
                success: false,
                message: 'Catalog not found',
            });
        }

        if (catalog.status !== 'draft') {
            return res.status(400).json({
                success: false,
                message: 'Only draft catalogs can be discarded',
            });
        }

        if (catalog.filePath && fs.existsSync(catalog.filePath)) {
            fs.unlinkSync(catalog.filePath);
        }

        await Catalog.findByIdAndDelete(catalog._id);

        res.json({
            success: true,
            message: 'Draft discarded',
        });
    } catch (error) {
        console.error('discardDraft error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to discard draft',
        });
    }
};

module.exports = {
    listCatalogs,
    getCatalog,
    getCatalogFile,
    getCatalogPdf: getCatalogFile,
    uploadAndScanCatalog,
    saveCatalog,
    discardDraft,
};
