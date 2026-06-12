const Inquiry = require('../models/Inquiry');

const listInquiries = async (req, res) => {
    try {
        const inquiries = await Inquiry.find()
            .sort({ createdAt: -1 })
            .limit(200)
            .lean();

        res.json({
            success: true,
            data: inquiries,
        });
    } catch (error) {
        console.error('listInquiries error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch inquiries',
        });
    }
};

const getInquiry = async (req, res) => {
    try {
        const inquiry = await Inquiry.findById(req.params.id).lean();

        if (!inquiry) {
            return res.status(404).json({
                success: false,
                message: 'Inquiry not found',
            });
        }

        res.json({
            success: true,
            data: inquiry,
        });
    } catch (error) {
        console.error('getInquiry error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch inquiry',
        });
    }
};

const createInquiry = async (req, res) => {
    try {
        const {
            companyName,
            contactPersonName,
            contactNumber,
            whatsappOrWechat,
            email,
            cityState,
            tin,
            businessType,
            hasImportExperience,
            currentSourceCountry,
            currentSellMarketCountry,
            preferredSellMarketCountry,
        } = req.body;

        if (!companyName?.trim() || !contactPersonName?.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Company name and contact person name are required',
            });
        }

        const hasExperience = Boolean(hasImportExperience);

        const inquiry = await Inquiry.create({
            companyName: String(companyName).trim(),
            contactPersonName: String(contactPersonName).trim(),
            contactNumber: String(contactNumber ?? '').trim(),
            whatsappOrWechat: String(whatsappOrWechat ?? '').trim(),
            email: String(email ?? '').trim(),
            cityState: String(cityState ?? '').trim(),
            tin: String(tin ?? '').trim(),
            businessType: String(businessType ?? '').trim(),
            hasImportExperience: hasExperience,
            currentSourceCountry: hasExperience ? String(currentSourceCountry ?? '').trim() : '',
            currentSellMarketCountry: hasExperience ? String(currentSellMarketCountry ?? '').trim() : '',
            preferredSellMarketCountry: hasExperience ? '' : String(preferredSellMarketCountry ?? '').trim(),
        });

        res.status(201).json({
            success: true,
            data: inquiry,
            message: 'Inquiry submitted successfully',
        });
    } catch (error) {
        console.error('createInquiry error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit inquiry',
        });
    }
};

module.exports = {
    listInquiries,
    getInquiry,
    createInquiry,
};
