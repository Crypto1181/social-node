const axios = require('axios');
const User = require('../models/User');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

exports.initializeDeposit = async (req, res) => {
  try {
    const { amount } = req.body;
    const user = await User.findById(req.user.id);

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: user.email,
        amount: amount * 100, // Paystack works in kobo
        callback_url: 'https://social-node-j9z0.onrender.com/api/wallet/callback' // Optional, not heavily relied on if we verify from mobile
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.status) {
      res.json({
        success: true,
        authorization_url: response.data.data.authorization_url,
        access_code: response.data.data.access_code,
        reference: response.data.data.reference
      });
    } else {
      res.status(400).json({ success: false, message: 'Failed to initialize payment' });
    }
  } catch (error) {
    console.error('Paystack Initialize Error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Failed to initialize deposit' });
  }
};

exports.verifyDeposit = async (req, res) => {
  try {
    const { reference } = req.body;
    const user = await User.findById(req.user.id);

    if (!reference) {
      return res.status(400).json({ success: false, message: 'Reference is required' });
    }

    // Check if reference already processed (to prevent double crediting)
    // We could store it in a Transaction model. For now we will check the user's transactions array.
    if (user.transactions && user.transactions.some(t => t.reference === reference)) {
      return res.status(400).json({ success: false, message: 'Transaction already processed' });
    }

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
        }
      }
    );

    const data = response.data.data;
    if (data.status === 'success') {
      const amountNaira = data.amount / 100;
      
      // Credit wallet
      user.walletBalance = (user.walletBalance || 0) + amountNaira;
      
      // Add to transaction history
      const transaction = {
        type: 'deposit',
        amount: amountNaira,
        reference: reference,
        date: new Date(),
        status: 'success'
      };
      
      if (!user.transactions) user.transactions = [];
      user.transactions.push(transaction);

      await user.save();

      res.json({
        success: true,
        message: 'Deposit successful',
        newBalance: user.walletBalance
      });
    } else {
      res.status(400).json({ success: false, message: 'Payment not successful on Paystack' });
    }
  } catch (error) {
    console.error('Paystack Verify Error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Failed to verify deposit' });
  }
};
