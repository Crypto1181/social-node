const express = require('express');
const router = express.Router();
const owletController = require('../controllers/owletController');
const { protect } = require('../middleware/authMiddleware');

// Get all services from Owlet
router.get('/services', protect, owletController.getServices);

// Add a new order
router.post('/order', protect, owletController.addOrder);

// Get order history
router.get('/orders', protect, owletController.getOrders);

// Get transaction history
router.get('/transactions', protect, owletController.getTransactions);

// Telecom & Refill Endpoints
router.post('/refill-status', protect, owletController.refillStatus);
router.get('/capabilities', protect, owletController.getCapabilities);
router.post('/data-plans', protect, owletController.getDataPlans);
router.post('/buy-airtime', protect, owletController.buyAirtime);
router.post('/buy-data', protect, owletController.buyData);

// Talktiyu (Phone Numbers)
router.post('/number-countries', protect, owletController.getNumberCountries);
router.post('/number-services', protect, owletController.getNumberServices);
router.post('/rent-number', protect, owletController.rentNumber);
router.post('/otp', protect, owletController.getOtp);

module.exports = router;
