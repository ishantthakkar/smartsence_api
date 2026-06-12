const express = require('express');
const productController = require('../controllers/productController');

const router = express.Router();

router.get('/', productController.listProducts);
router.patch('/:id/tags', productController.updateProductTags);

module.exports = router;
