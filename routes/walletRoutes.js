const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const walletController = require('../controllers/walletController');

router.post('/deposit', protect, walletController.initializeDeposit);
router.post('/verify', protect, walletController.verifyDeposit);
router.get('/callback', walletController.paystackCallback);
router.post('/withdraw', protect, walletController.withdraw);
router.post('/webhook/bachs', walletController.bachsWebhook);

module.exports = router;
