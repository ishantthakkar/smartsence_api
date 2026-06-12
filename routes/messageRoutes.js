const express = require('express');
const messageController = require('../controllers/messageController');

const router = express.Router();

router.get('/', messageController.listMessages);

module.exports = router;
