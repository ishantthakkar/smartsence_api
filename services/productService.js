const Product = require('../models/Product');

async function syncProductsFromCatalog(catalog) {
    const catalogId = catalog._id;

    await Product.deleteMany({ catalogId });

    const products = Array.isArray(catalog.products) ? catalog.products : [];
    if (products.length === 0) {
        return [];
    }

    const docs = products.map((item, index) => ({
        catalogId,
        catalogProductIndex: index,
        companyName: catalog.company?.name || '',
        catalogFileName: catalog.originalFileName || '',
        name: item.name || '',
        sku: item.sku || '',
        description: item.description || '',
        category: item.category || '',
        tags: Array.isArray(item.tags) ? item.tags.filter(Boolean) : [],
        price: item.price || 0,
        currency: item.currency || '',
        imageUrls: Array.isArray(item.imageUrls) ? item.imageUrls : [],
    }));

    return Product.insertMany(docs);
}

module.exports = {
    syncProductsFromCatalog,
};
