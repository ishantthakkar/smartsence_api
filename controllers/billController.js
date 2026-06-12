const path = require('path');
const fs = require('fs');
const Bill = require('../models/Bill');
const { scanBillPdf } = require('../services/geminiService');

const listBills = async (req, res) => {
    try {
        const bills = await Bill.find()
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        res.json({
            success: true,
            data: bills,
        });
    } catch (error) {
        console.error('listBills error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch bills',
        });
    }
};

const uploadAndScanBill = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: 'No PDF file uploaded',
        });
    }

    const bill = await Bill.create({
        originalFileName: req.file.originalname,
        filePath: req.file.path,
        status: 'pending',
    });

    try {
        const { extracted, rawAiResponse } = await scanBillPdf(req.file.path);

        const updated = await Bill.findByIdAndUpdate(
            bill._id,
            {
                ...extracted,
                rawAiResponse,
                status: 'scanned',
            },
            { new: true },
        ).lean();

        res.json({
            success: true,
            data: updated,
            message: 'Bill scanned successfully',
        });
    } catch (error) {
        console.error('uploadAndScanBill error:', error);

        const errorMessage = error instanceof Error ? error.message : 'Failed to scan bill';

        await Bill.findByIdAndUpdate(bill._id, {
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

const getBill = async (req, res) => {
    try {
        const bill = await Bill.findById(req.params.id).lean();

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: 'Bill not found',
            });
        }

        res.json({
            success: true,
            data: bill,
        });
    } catch (error) {
        console.error('getBill error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch bill',
        });
    }
};

module.exports = {
    listBills,
    uploadAndScanBill,
    getBill,
};
