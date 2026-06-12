const express = require('express');

const router = express.Router();

const wecomController = require(
    '../controllers/wecomController'
);

router.get(
    '/webhook',
    wecomController.verifyWebhook
);

router.post(
    '/webhook',
    wecomController.receiveMessage
);

module.exports = router;