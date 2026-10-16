const axios = require('axios');
const crypto = require('crypto');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const BACHS_SECRET_KEY = process.env.BACHS_SECRET_KEY;
const BACHS_WEBHOOK_SECRET = process.env.BACHS_WEBHOOK_SECRET;

// Helper to verify Bachs Webhook signatures
function verifyBachsSignature(rawBody, secret, timestampHeader, signatureHeader, toleranceSeconds = 300) {
  if (!signatureHeader || !timestampHeader || !secret) return false;
  const timestamp = parseInt(timestampHeader, 10);
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) {
    return false;
  }
  const message = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(message, 'utf8').digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

function verifyBachsSignatureV2(header, rawBody, secret, toleranceSeconds = 300) {
  if (!header || !secret) return false;
  const parts = {};
  header.split(',').forEach(p => {
    const idx = p.indexOf('=');
    if (idx !== -1) {
      const k = p.substring(0, idx).trim();
      const v = p.substring(idx + 1).trim();
      if (!parts[k]) parts[k] = [];
      parts[k].push(v);
    }
  });
  if (!parts.t || !parts.v1) return false;
  const timestamp = parseInt(parts.t[0], 10);
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;
  const message = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(message, 'utf8').digest('hex');
  return parts.v1.some(sig => {
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
    } catch {
      return false;
    }
  });
}

exports.initializeDeposit = async (req, res) => {
  try {
    const { amount, gateway = 'paystack' } = req.body;
    const user = await User.findById(req.user.userId);

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (gateway === 'bachs') {
      const reference = `BACHS_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const response = await axios.post(
        'https://api.bachs.io/v1/checkout-sessions',
        {
          pricing: {
            currency: 'NGN',
            amount: Number(amount).toFixed(2)
          },
          customer: {
            email: user.email,
            name: user.name || 'User'
          },
          reference: reference,
          success_url: 'https://social-node-j9z0.onrender.com/api/wallet/callback',
          cancel_url: 'https://social-node-j9z0.onrender.com/api/wallet/callback',
          metadata: {
            userId: user._id.toString(),
            email: user.email
          }
        },
        {
          headers: {
            Authorization: `Bearer ${BACHS_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.checkout_url) {
        return res.json({
          success: true,
          authorization_url: response.data.checkout_url,
          reference: response.data.checkout_id,
          checkout_id: response.data.checkout_id,
          gateway: 'bachs'
        });
      } else {
        return res.status(400).json({ success: false, message: 'Failed to initialize Bachs payment' });
      }
    }

    // Default: Paystack
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: user.email,
        amount: Math.round(amount * 100), 
        callback_url: 'https://social-node-j9z0.onrender.com/api/wallet/callback' 
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
        reference: response.data.data.reference,
        gateway: 'paystack'
      });
    } else {
      res.status(400).json({ success: false, message: 'Failed to initialize payment' });
    }
  } catch (error) {
    console.error('Initialize Deposit Error:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      message: error.response?.data?.message || 'Failed to initialize deposit' 
    });
  }
};

exports.verifyDeposit = async (req, res) => {
  try {
    const { reference, gateway } = req.body;
    const user = await User.findById(req.user.userId);

    if (!reference) {
      return res.status(400).json({ success: false, message: 'Reference is required' });
    }

    // Check if reference already processed (to prevent double crediting)
    const existingTransaction = await Transaction.findOne({ reference });
    if (existingTransaction) {
      return res.json({
        success: true,
        message: 'Deposit already credited',
        newBalance: user.walletBalance
      });
    }

    const isBachs = gateway === 'bachs' || reference.startsWith('chk_') || reference.startsWith('BACHS_');

    if (isBachs) {
      const response = await axios.get(
        `https://api.bachs.io/v1/checkout-sessions/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${BACHS_SECRET_KEY}`
          }
        }
      );

      const data = response.data;
      const isPaid = data.status === 'completed' || 
                     data.payment_status === 'paid' || 
                     (data.charge && (data.charge.status === 'succeeded' || data.charge.status === 'paid'));

      if (isPaid) {
        const amountNaira = parseFloat(data.amount || data.charge?.amount_paid || data.charge?.amount || 0);

        user.walletBalance = (user.walletBalance || 0) + amountNaira;

        await Transaction.create({
          user: req.user.userId,
          type: 'deposit',
          amount: amountNaira,
          description: 'Bachs Deposit',
          reference: reference,
          status: 'success'
        });

        await user.save();

        return res.json({
          success: true,
          message: 'Deposit successful',
          newBalance: user.walletBalance
        });
      } else {
        return res.status(400).json({ 
          success: false, 
          message: 'Payment not yet confirmed by Bachs' 
        });
      }
    }

    // Paystack verification
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
    console.error('Verify Deposit Error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Failed to verify deposit' });
  }
};

exports.bachsWebhook = async (req, res) => {
  try {
    const signatureV2 = req.headers['x-bachs-signature-v2'];
    const signature = req.headers['x-bachs-signature'];
    const timestamp = req.headers['x-bachs-timestamp'];

    if (BACHS_WEBHOOK_SECRET) {
      let isValid = false;
      const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
      if (signatureV2) {
        isValid = verifyBachsSignatureV2(signatureV2, rawBody, BACHS_WEBHOOK_SECRET);
      } else if (signature && timestamp) {
        isValid = verifyBachsSignature(rawBody, BACHS_WEBHOOK_SECRET, timestamp, signature);
      }

      if (!isValid) {
        console.warn('Invalid Bachs webhook signature');
        return res.status(400).json({ error: 'Invalid signature' });
      }
    }

    const event = req.body;
    console.log('Received Bachs Webhook:', event?.type);

    if (event && (event.type === 'collection.succeeded' || event.type === 'checkout.completed')) {
      const data = event.data || {};
      const ref = data.checkout_id || data.reference || data.charge_id;

      if (ref) {
        const existing = await Transaction.findOne({ reference: ref });
        if (!existing) {
          let targetUser = null;
          if (data.metadata?.userId) {
            targetUser = await User.findById(data.metadata.userId);
          }
          if (!targetUser && (data.customer?.email || data.customer_details?.email)) {
            const email = (data.customer?.email || data.customer_details?.email).toLowerCase();
            targetUser = await User.findOne({ email });
          }

          if (targetUser) {
            const amountNaira = parseFloat(data.amount || data.settlement_amount || 0);
            targetUser.walletBalance = (targetUser.walletBalance || 0) + amountNaira;

            await Transaction.create({
              user: targetUser._id,
              type: 'deposit',
              amount: amountNaira,
              description: 'Bachs Deposit',
              reference: ref,
              status: 'success'
            });

            await targetUser.save();
            console.log(`Successfully credited ${amountNaira} NGN to user ${targetUser.email} via Bachs webhook`);
          }
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Bachs Webhook Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
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
