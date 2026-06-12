const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const billController = require('../controllers/billController');

const router = express.Router();

const uploadsDir = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

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
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
            return;
        }
        cb(new Error('Only PDF files are allowed'));
    },
});

router.get('/', billController.listBills);
router.get('/:id', billController.getBill);
router.post('/upload', (req, res, next) => {
    upload.single('pdf')(req, res, (err) => {
        if (err) {
            return res.status(400).json({
                success: false,
                message: err.message || 'File upload failed',
            });
        }
        next();
    });
}, billController.uploadAndScanBill);

module.exports = router;
