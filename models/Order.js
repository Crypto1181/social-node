const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  owletOrderId: {
    type: String,
    required: true
  },
  serviceId: {
    type: String,
    required: true
  },
  serviceName: {
    type: String,
    required: true
  },
  link: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  charge: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    default: 'Pending'
  },
  startCount: {
    type: String,
    default: '0'
  },
  remains: {
    type: String,
    default: '0'
  }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
