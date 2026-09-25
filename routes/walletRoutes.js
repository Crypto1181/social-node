const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const walletController = require('../controllers/walletController');

router.post('/deposit', protect, walletController.initializeDeposit);
router.post('/verify', protect, walletController.verifyDeposit);
router.get('/callback', walletController.paystackCallback);

module.exports = router;
