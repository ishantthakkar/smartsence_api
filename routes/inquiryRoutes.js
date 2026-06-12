const express = require('express');
const inquiryController = require('../controllers/inquiryController');

const router = express.Router();

router.get('/', inquiryController.listInquiries);
router.get('/:id', inquiryController.getInquiry);
router.post('/', inquiryController.createInquiry);

module.exports = router;
