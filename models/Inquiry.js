const mongoose = require('mongoose');

const InquirySchema = new mongoose.Schema({
    inquiryId: { type: String, unique: true, required: true },
    companyName: { type: String, default: '' },
    contactPersonName: { type: String, default: '' },
    contactNumber: { type: String, default: '' },
    whatsappOrWechat: { type: String, default: '' },
    email: { type: String, default: '' },
    cityState: { type: String, default: '' },
    tin: { type: String, default: '' },
    businessType: { type: String, default: '' },
    hasImportExperience: { type: Boolean, default: false },
    currentSourceCountry: { type: String, default: '' },
    currentSellMarketCountry: { type: String, default: '' },
    preferredSellMarketCountry: { type: String, default: '' },
    productName: { type: String, default: '' },
    productCategory: { type: String, default: '' },
    productLink: { type: String, default: '' },
    productDescription: { type: String, default: '' },
    productSpecifications: { type: String, default: '' },
    trialSampleQuantity: { type: String, default: '' },
    monthlyYearlyQuantity: { type: String, default: '' },
    productBrandingRequired: { type: Boolean, default: false },
    certificationsNeeded: { type: [String], default: [] },
    certificationsOther: { type: String, default: '' },
    shipmentPreferences: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
});

InquirySchema.pre('validate', async function preValidate() {
    if (this.inquiryId) {
        return;
    }

    const date = new Date();
    const datePart = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('');

    const prefix = `INQ-${datePart}`;
    const count = await this.constructor.countDocuments({
        inquiryId: new RegExp(`^${prefix}`),
    });

    this.inquiryId = `${prefix}-${String(count + 1).padStart(4, '0')}`;
});

module.exports = mongoose.model('Inquiry', InquirySchema);
