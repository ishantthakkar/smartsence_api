const Catalog = require('../models/Catalog');
const Product = require('../models/Product');
const { syncProductsFromCatalog } = require('../services/productService');

const listProducts = async (req, res) => {
    try {
        const productCount = await Product.countDocuments();
        if (productCount === 0) {
            const catalogs = await Catalog.find({ status: 'scanned' }).lean();
            for (const catalog of catalogs) {
                await syncProductsFromCatalog(catalog);
            }
        }

        const tag = String(req.query.tag ?? '').trim().toLowerCase();
        const filter = tag ? { tags: tag } : {};

        const products = await Product.find(filter)
            .sort({ createdAt: -1 })
            .limit(500)
            .lean();

        res.json({
            success: true,
            data: products,
        });
    } catch (error) {
        console.error('listProducts error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch products',
        });
    }
};

const updateProductTags = async (req, res) => {
    try {
        const tags = Array.isArray(req.body.tags)
            ? req.body.tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean)
            : [];

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { tags: Array.from(new Set(tags)) },
            { new: true },
        ).lean();

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
            });
        }

        res.json({
            success: true,
            data: product,
            message: 'Tags updated',
        });
    } catch (error) {
        console.error('updateProductTags error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update product tags',
        });
    }
};

module.exports = {
    listProducts,
    updateProductTags,
};
