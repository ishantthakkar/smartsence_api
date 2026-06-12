const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    catalogId: { type: mongoose.Schema.Types.ObjectId, ref: 'Catalog', required: true },
    catalogProductIndex: { type: Number, default: 0 },
    companyName: { type: String, default: '' },
    catalogFileName: { type: String, default: '' },
    name: { type: String, default: '' },
    sku: { type: String, default: '' },
    description: { type: String, default: '' },
    category: { type: String, default: '' },
    tags: { type: [String], default: [] },
    price: { type: Number, default: 0 },
    currency: { type: String, default: '' },
    imageUrls: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
});

ProductSchema.index({ catalogId: 1, catalogProductIndex: 1 });

module.exports = mongoose.model('Product', ProductSchema);
