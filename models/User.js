const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  walletBalance: {
    type: Number,
    default: 0
  },
  profilePic: {
    type: String,
    default: ''
  },
  transactions: [{
    type: { type: String }, // 'deposit', 'order'
    amount: Number,
    reference: String,
    date: Date,
    status: String,
    details: mongoose.Schema.Types.Mixed
  }]
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
