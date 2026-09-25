const axios = require('axios');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

exports.initializeDeposit = async (req, res) => {
  try {
    const { amount } = req.body;
    const user = await User.findById(req.user.userId);

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
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
    const user = await User.findById(req.user.userId);

    if (!reference) {
      return res.status(400).json({ success: false, message: 'Reference is required' });
    }

    // Check if reference already processed (to prevent double crediting)
    const existingTransaction = await Transaction.findOne({ reference });
    if (existingTransaction) {
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
      await Transaction.create({
        user: req.user.userId,
        type: 'deposit',
        amount: amountNaira,
        description: 'Paystack Deposit',
        reference: reference,
        status: 'success'
      });

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

exports.paystackCallback = (req, res) => {
  res.send(`
    <html>
      <body style="display:flex; justify-content:center; align-items:center; height:100vh; flex-direction:column; font-family:sans-serif; text-align:center;">
        <h1 style="color:green;">Payment Successful!</h1>
        <p>You can now close this window and go back to the app to verify your deposit.</p>
      </body>
    </html>
  `);
};
