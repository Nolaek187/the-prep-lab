const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const errorHandler = require('./middleware/errorHandler');
const logger = require('./middleware/logger');


// Route files
const authRoutes = require('./routes/auth');
const mealRoutes = require('./routes/meal');
const ingredientRoutes = require('./routes/ingredients');
const adminRoutes = require('./routes/admin');
const usersRoutes=  require('./routes/users');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();


// Middleware
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(logger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'The Prep Lab API is running',
    timestamp: new Date().toISOString()
  });
});

// Mount routers
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/meals', mealRoutes);
app.use('/api/v1/ingredients', ingredientRoutes);
app.use('/api/v1/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);



module.exports = app;