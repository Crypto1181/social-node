const axios = require('axios');

const User = require('../models/User');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');

const OWLET_API_URL = 'https://the-owlet.com/api/v2';
const OWLET_API_KEY = 'owlet_79e2a3a5ab9135d1c4e417b48cd7795b02265c58a9e64e0e';

exports.getServices = async (req, res) => {
  try {
    const response = await axios.post(OWLET_API_URL, {
      key: OWLET_API_KEY,
      action: 'services'
    });
    
    // Some SMM panels return HTML on error, or JSON on success. We need to handle it.
    if (typeof response.data === 'string' && response.data.includes('<html')) {
        return res.status(500).json({ success: false, message: 'Invalid response from Owlet API' });
    }

    res.status(200).json({
      success: true,
      services: response.data
    });
  } catch (error) {
    console.error('Owlet getServices error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch services' });
  }
};

exports.addOrder = async (req, res) => {
  try {
    const { service, link, quantity } = req.body;
    const userId = req.user.userId;
    
    // 1. Fetch user to check balance
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // 2. Fetch all services to find the correct rate
    const servicesResponse = await axios.post(OWLET_API_URL, {
      key: OWLET_API_KEY,
      action: 'services'
    });

    const services = servicesResponse.data;
    if (typeof services === 'string' || !Array.isArray(services)) {
       return res.status(500).json({ success: false, message: 'Failed to verify service rate' });
    }

    const targetService = services.find(s => s.service.toString() === service.toString());
    if (!targetService) {
      return res.status(400).json({ success: false, message: 'Invalid service selected' });
    }

    const rate = parseFloat(targetService.rate);
    const orderQuantity = parseInt(quantity, 10);
    const totalCost = (orderQuantity / 1000) * rate;

    // 3. Check wallet balance
    if (user.walletBalance < totalCost) {
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
    }

    // 4. Place order to Owlet
    const response = await axios.post(OWLET_API_URL, {
      key: OWLET_API_KEY,
      action: 'add',
      service,
      link,
      quantity
    });

    const data = response.data;
    
    if (data.error) {
      return res.status(400).json({ success: false, message: data.error });
    }

    // 5. Deduct balance and save if successful
    user.walletBalance -= totalCost;
    await user.save();

    // 6. Save Transaction
    await Transaction.create({
      user: userId,
      type: 'purchase',
      amount: totalCost,
      description: `Purchased ${targetService.name}`,
      reference: data.order ? data.order.toString() : ''
    });

    // 7. Save Order
    await Order.create({
      user: userId,
      owletOrderId: data.order ? data.order.toString() : 'unknown',
      serviceId: service,
      serviceName: targetService.name,
      link,
      quantity: orderQuantity,
      charge: parseFloat(data.charge || totalCost)
    });

    res.status(200).json({
      success: true,
      data: data,
      newBalance: user.walletBalance
    });
  } catch (error) {
    console.error('Owlet addOrder error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to place order' });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.userId }).sort({ createdAt: -1 });
    
    const orderIds = orders.map(o => o.owletOrderId).filter(id => id && id !== 'unknown');
    
    if (orderIds.length > 0) {
      // Query Owlet for live status
      const response = await axios.post(OWLET_API_URL, {
        key: OWLET_API_KEY,
        action: 'status',
        orders: orderIds.join(',')
      });
      
      const liveStatuses = response.data;
      
      if (liveStatuses && !liveStatuses.error) {
        let savePromises = [];
        for (let order of orders) {
          const liveData = liveStatuses[order.owletOrderId];
          if (liveData && !liveData.error && liveData.status) {
            order.status = liveData.status;
            // Save updated status to DB
            savePromises.push(order.save());
          }
        }
        if (savePromises.length > 0) await Promise.all(savePromises);
      }
    }
    
    res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error('getOrders error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user.userId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, transactions });
  } catch (error) {
    console.error('getTransactions error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch transactions' });
  }
};

exports.refillStatus = async (req, res) => {
  try {
    const { refill } = req.body;
    const response = await axios.post(OWLET_API_URL, {
      key: OWLET_API_KEY,
      action: 'refill_status',
      refill
    });
    res.status(200).json(response.data);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch refill status' });
  }
};

exports.getCapabilities = async (req, res) => {
  try {
    const response = await axios.post(OWLET_API_URL, {
      key: OWLET_API_KEY,
      action: 'capabilities'
    });
    res.status(200).json(response.data);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch capabilities' });
  }
};

exports.getDataPlans = async (req, res) => {
  try {
    const { network } = req.body; // mtn | glo | airtel | 9mobile
    const response = await axios.post(OWLET_API_URL, {
      key: OWLET_API_KEY,
      action: 'data_plans',
      network
    });
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch data plans' });
  }
};

exports.buyAirtime = async (req, res) => {
  try {
    const { network, phone, amount } = req.body;
    const userId = req.user.userId;
    const totalCost = parseFloat(amount);

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.walletBalance < totalCost) return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });

    const response = await axios.post(OWLET_API_URL, {
      key: OWLET_API_KEY,
      action: 'airtime',
      network,
      phone,
      amount
    });

    const data = response.data;
    if (data.error) return res.status(400).json({ success: false, message: data.error });

    user.walletBalance -= totalCost;
    await user.save();

    await Transaction.create({
      user: userId,
      type: 'purchase',
      amount: totalCost,
      description: `Bought ${network} Airtime for ${phone}`,
      reference: data.order ? data.order.toString() : ''
    });

    res.status(200).json({ success: true, data, newBalance: user.walletBalance });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to buy airtime' });
  }
};

exports.buyData = async (req, res) => {
  try {
    const { network, phone, plan, price } = req.body; // Frontend should send the expected price to deduct
    const userId = req.user.userId;
    const totalCost = parseFloat(price);

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.walletBalance < totalCost) return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });

    const response = await axios.post(OWLET_API_URL, {
      key: OWLET_API_KEY,
      action: 'data',
      network,
      phone,
      plan
    });

    const data = response.data;
    if (data.error) return res.status(400).json({ success: false, message: data.error });

    user.walletBalance -= totalCost;
    await user.save();

    await Transaction.create({
      user: userId,
      type: 'purchase',
      amount: totalCost,
      description: `Bought ${network} Data for ${phone}`,
      reference: data.order ? data.order.toString() : ''
    });

    res.status(200).json({ success: true, data, newBalance: user.walletBalance });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to buy data' });
  }
};

// --- Nyra (Virtual Cards) ---
exports.getCardCatalog = async (req, res) => {
  try {
    const { q, country } = req.body;
    const payload = {
      key: OWLET_API_KEY,
      action: 'card_catalog'
    };
    if (q) payload.q = q;
    if (country) payload.country = country;

    const response = await axios.post(OWLET_API_URL, payload);
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch card catalog' });
  }
};

exports.createCard = async (req, res) => {
  try {
    const { product, face, expectedPrice } = req.body; 
    const userId = req.user.userId;
    const totalCost = parseFloat(expectedPrice);

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.walletBalance < totalCost) return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });

    const response = await axios.post(OWLET_API_URL, {
      key: OWLET_API_KEY,
      action: 'create_card',
      product,
      face
    });

    const data = response.data;
    if (data.error) return res.status(400).json({ success: false, message: data.error });

    user.walletBalance -= totalCost;
    await user.save();

    await Transaction.create({
      user: userId,
      type: 'purchase',
      amount: totalCost,
      description: `Bought Virtual Card: ${product}`,
      reference: data.order ? data.order.toString() : ''
    });

    res.status(200).json({ success: true, data, newBalance: user.walletBalance });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create card' });
  }
};

// --- Talktiyu (Phone Numbers & OTP) ---
exports.getNumberCountries = async (req, res) => {
  try {
    const { actionType } = req.body;
    let apiAction = 'number_countries';
    if (actionType === 'rent_number') {
      apiAction = 'rent_countries';
    }

    const response = await axios.post(OWLET_API_URL, {
      key: OWLET_API_KEY,
      action: apiAction
    });
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch number countries' });
  }
};

exports.getNumberServices = async (req, res) => {
  try {
    const { country, actionType } = req.body;
    let apiAction = 'number_services';
    if (actionType === 'rent_number') {
      apiAction = 'rent_services';
    }

    const payload = {
      key: OWLET_API_KEY,
      action: apiAction
    };
    if (country) payload.country = country;

    const response = await axios.post(OWLET_API_URL, payload);
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch number services' });
  }
};

exports.rentNumber = async (req, res) => {
  try {
    const { country, service, expectedPrice, actionType } = req.body;
    const userId = req.user.userId;
    const totalCost = parseFloat(expectedPrice);

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.walletBalance < totalCost) return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });

    const response = await axios.post(OWLET_API_URL, {
      key: OWLET_API_KEY,
      action: actionType || 'rent_number', // supports buy_number or rent_number
      country,
      service
    });

    const data = response.data;
    if (data.error) return res.status(400).json({ success: false, message: data.error });

    user.walletBalance -= totalCost;
    await user.save();

    await Transaction.create({
      user: userId,
      type: 'purchase',
      amount: totalCost,
      description: `Got Number for ${service} (Action: ${actionType || 'rent_number'})`,
      reference: data.order ? data.order.toString() : ''
    });

    res.status(200).json({ success: true, data, newBalance: user.walletBalance });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get number' });
  }
};

exports.getOtp = async (req, res) => {
  try {
    const { order } = req.body;
    const response = await axios.post(OWLET_API_URL, {
      key: OWLET_API_KEY,
      action: 'otp',
      order
    });
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch OTP' });
  }
};

// --- Rhombus (Proxies) ---
exports.getProxyCatalog = async (req, res) => {
  try {
    const response = await axios.post(OWLET_API_URL, {
      key: OWLET_API_KEY,
      action: 'proxy_catalog'
    });
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch proxy catalog' });
  }
};

exports.buyProxy = async (req, res) => {
  try {
    const { product, plan, location, quantity, expectedPrice } = req.body;
    const userId = req.user.userId;
    const totalCost = parseFloat(expectedPrice);

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.walletBalance < totalCost) return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });

    const payload = {
      key: OWLET_API_KEY,
      action: 'buy_proxy',
      product,
      plan,
      quantity
    };
    if (location) payload.location = location;

    const response = await axios.post(OWLET_API_URL, payload);

    const data = response.data;
    if (data.error) return res.status(400).json({ success: false, message: data.error });

    user.walletBalance -= totalCost;
    await user.save();

    await Transaction.create({
      user: userId,
      type: 'purchase',
      amount: totalCost,
      description: `Bought Proxies (${quantity}x)`,
      reference: data.order ? data.order.toString() : ''
    });

    res.status(200).json({ success: true, data, newBalance: user.walletBalance });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to buy proxy' });
  }
};

// --- Gamerzone (Game Top-ups) ---
exports.getGameProducts = async (req, res) => {
  try {
    const response = await axios.post(OWLET_API_URL, {
      key: OWLET_API_KEY,
      action: 'game_products'
    });
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch game products' });
  }
};

exports.getGamePackages = async (req, res) => {
  try {
    const { product } = req.body;
    const response = await axios.post(OWLET_API_URL, {
      key: OWLET_API_KEY,
      action: 'game_packages',
      product
    });
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch game packages' });
  }
};

exports.gameTopup = async (req, res) => {
  try {
    const { product, sku, player_id, additional_fields, expectedPrice } = req.body;
    const userId = req.user.userId;
    const totalCost = parseFloat(expectedPrice);

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.walletBalance < totalCost) return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });

    const payload = {
      key: OWLET_API_KEY,
      action: 'game_topup',
      product,
      sku,
      player_id,
      ...(additional_fields || {})
    };

    const response = await axios.post(OWLET_API_URL, payload);

    const data = response.data;
    if (data.error) return res.status(400).json({ success: false, message: data.error });

    user.walletBalance -= totalCost;
    await user.save();

    await Transaction.create({
      user: userId,
      type: 'purchase',
      amount: totalCost,
      description: `Game Top-up: ${product} (SKU: ${sku})`,
      reference: data.order ? data.order.toString() : ''
    });

    res.status(200).json({ success: true, data, newBalance: user.walletBalance });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to process game top-up' });
  }
};
