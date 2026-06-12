const mongoose = require('mongoose');

const CatalogContactSchema = new mongoose.Schema({
    name: { type: String, default: '' },
    role: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    website: { type: String, default: '' },
}, { _id: false });

const CatalogCompanySchema = new mongoose.Schema({
    name: { type: String, default: '' },
    address: { type: String, default: '' },
    website: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
}, { _id: false });

const CatalogProductSchema = new mongoose.Schema({
    name: { type: String, default: '' },
    sku: { type: String, default: '' },
    description: { type: String, default: '' },
    category: { type: String, default: '' },
    tags: { type: [String], default: [] },
    price: { type: Number, default: 0 },
    currency: { type: String, default: '' },
    imageUrls: { type: [String], default: [] },
}, { _id: false });

const CatalogAttachmentSchema = new mongoose.Schema({
    originalFileName: { type: String, default: '' },
    filePath: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    sourceType: { type: String, default: '' },
}, { _id: false });

const CatalogSchema = new mongoose.Schema({
    originalFileName: { type: String, default: '' },
    filePath: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    sourceType: {
        type: String,
        enum: ['pdf', 'image', 'excel'],
        default: 'pdf',
    },
    matchedCatalogId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Catalog',
        default: null,
    },
    attachments: { type: [CatalogAttachmentSchema], default: [] },

    company: { type: CatalogCompanySchema, default: () => ({}) },
    contacts: { type: [CatalogContactSchema], default: [] },
    products: { type: [CatalogProductSchema], default: [] },
    extractedImageUrls: { type: [String], default: [] },

    status: {
        type: String,
        enum: ['pending', 'draft', 'scanned', 'failed'],
        default: 'pending',
    },
    errorMessage: { type: String, default: '' },
    rawAiResponse: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Catalog', CatalogSchema);

