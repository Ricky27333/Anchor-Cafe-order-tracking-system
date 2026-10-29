const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');

const menuRoutes = require('./routes/menuRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reportRoutes = require('./routes/reportRoutes');
const expenseRoutes = require('./routes/expenseRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/expenses', expenseRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    cafe: process.env.CAFE_NAME || 'Anchor Cafe',
    location: process.env.CAFE_LOCATION || 'Ramapuram Beach, Chirala',
    timestamp: new Date().toISOString()
  });
});

// Friendly screen routes
app.get('/pos', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/pos.html'));
});

app.get('/track', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/track.html'));
});

app.get('/track/:orderNumber', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/track.html'));
});

app.get('/admin/analytics', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/analytics.html'));
});

module.exports = app;
