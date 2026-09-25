require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/authRoutes');

const app = express();


app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));


app.use('/api/auth', authRoutes);
const owletRoutes = require('./routes/owlet');
app.use('/api/owlet', owletRoutes);
const walletRoutes = require('./routes/walletRoutes');
app.use('/api/wallet', walletRoutes);


app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Social Metric API' });
});


const dbUri = process.env.DB_URI;

mongoose.connect(dbUri)
  .then(() => console.log(' Successfully connected to MongoDB'))
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
