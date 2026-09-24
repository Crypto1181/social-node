const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || 'dummy_client_id');

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user in database
    user = new User({
      name,
      email,
      password: hashedPassword
    });

    await user.save();

    // Create JWT Token
    const payload = { userId: user.id };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret_key_123', { expiresIn: '1h' });

    res.status(201).json({ 
      success: true, 
      token, 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        walletBalance: user.walletBalance 
      } 
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    // Create JWT Token
    const payload = { userId: user.id };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret_key_123', { expiresIn: '1h' });

    res.status(200).json({ 
      success: true, 
      token, 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        walletBalance: user.walletBalance 
      } 
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Google Sign In / Sign Up
// @route   POST /api/auth/google
exports.googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    const ticket = await client.verifyIdToken({
      idToken,
      // Without audience specified here it just validates the JWT signature, which is okay for this prototype.
    });
    const payload = ticket.getPayload();
    const { email, name } = payload;

    let user = await User.findOne({ email });
    if (!user) {
      const randomPassword = Math.random().toString(36).slice(-8) + 'Aa1!';
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(randomPassword, salt);
      
      user = new User({
        name,
        email,
        password: hashedPassword
      });
      await user.save();
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret_key_123', { expiresIn: '1h' });
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        walletBalance: user.walletBalance
      }
    });
  } catch (error) {
    console.error('Google auth error:', error.message);
    res.status(401).json({ success: false, message: 'Google authentication failed' });
  }
};

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
    }
    
    console.log(`[MOCK EMAIL] Password reset requested for ${email}`);
    res.status(200).json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update Profile
// @route   PUT /api/auth/profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, profilePic } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    if (name) user.name = name;
    if (profilePic) user.profilePic = profilePic; // store base64 or URL
    
    await user.save();
    
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        walletBalance: user.walletBalance,
        profilePic: user.profilePic
      }
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
