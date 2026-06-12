const mongoose = require('mongoose');

const ProductItemSchema = new mongoose.Schema({
    name: { type: String, default: '' },
    price: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
}, { _id: false });

const CustomerSchema = new mongoose.Schema({
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
}, { _id: false });

const BillSchema = new mongoose.Schema({
    originalFileName: { type: String, default: '' },
    filePath: { type: String, default: '' },
    customer: { type: CustomerSchema, default: () => ({}) },
    invoiceNumber: { type: String, default: '' },
    orderId: { type: String, default: '' },
    date: { type: String, default: '' },
    products: { type: [ProductItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    currency: { type: String, default: '' },
    status: {
        type: String,
        enum: ['pending', 'scanned', 'failed'],
        default: 'pending',
    },
    errorMessage: { type: String, default: '' },
    rawAiResponse: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Bill', BillSchema);
