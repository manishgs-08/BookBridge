const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const passport = require('passport');

// Import configurations
require('./config/passport');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const AppError = require('./utils/AppError');
const { generalLimiter } = require('./middleware/rateLimiter');

// Import routes
const authRoutes             = require('./routes/authRoutes');
const bookRoutes             = require('./routes/bookRoutes');
const negotiationRoutes      = require('./routes/negotiationRoutes');
const messageRoutes          = require('./routes/messageRoutes');
const wishlistRoutes         = require('./routes/wishlistRoutes');
const requestRoutes          = require('./routes/requestRoutes');
const reviewRoutes           = require('./routes/reviewRoutes');
const notificationRoutes     = require('./routes/notificationRoutes');
const disputeRoutes          = require('./routes/disputeRoutes');
const adminRoutes            = require('./routes/adminRoutes');
const setupSwagger           = require('./config/swagger');

// Initialize express app
const app = express();

// ─── Middleware ─────────────────────────────────────────

// Security headers
app.use(helmet());

// CORS configuration (allow frontend origin)
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global Rate Limiting
app.use(generalLimiter);

// Request logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Initialize Passport
app.use(passport.initialize());

// ─── Routes ─────────────────────────────────────────────

// API Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date() });
});

// Mount domain routes
app.use('/api/auth',          authRoutes);
app.use('/api/books',         bookRoutes);
app.use('/api/negotiations',  negotiationRoutes);
app.use('/api/messages',      messageRoutes);
app.use('/api/wishlist',      wishlistRoutes);
app.use('/api/requests',      requestRoutes);
app.use('/api/reviews',       reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/disputes',      disputeRoutes);
app.use('/api/admin',         adminRoutes);

// Setup Swagger documentation
setupSwagger(app);

// Catch-all route for unhandled requests (404)
app.all('*', (req, res, next) => {
  next(AppError.notFound(`Route not found: ${req.originalUrl}`));
});

// ─── Global Error Handler ───────────────────────────────
app.use(errorHandler);

module.exports = app;
