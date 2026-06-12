const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const catalogController = require('../controllers/catalogController');

const router = express.Router();

const uploadsDir = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv',
]);

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${unique}-${safeName}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
            cb(null, true);
            return;
        }
        cb(new Error('File type not allowed. Upload PDF, image (JPG/PNG), or Excel (XLSX/XLS/CSV).'));
    },
});

router.get('/', catalogController.listCatalogs);
router.get('/:id/pdf', catalogController.getCatalogFile);
router.get('/:id/file', catalogController.getCatalogFile);
router.get('/:id', catalogController.getCatalog);
router.put('/:id/save', catalogController.saveCatalog);
router.delete('/:id/draft', catalogController.discardDraft);
router.post('/upload', (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            return res.status(400).json({
                success: false,
                message: err.message || 'File upload failed',
            });
        }
        next();
    });
}, catalogController.uploadAndScanCatalog);

module.exports = router;
