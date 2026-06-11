require('dotenv').config();
const { validateEnv } = require('./config/env');
const app = require('./app');
const { testConnection, closePool } = require('./config/db');

const PORT = process.env.PORT || 5000;

// Start server function
const startServer = async () => {
  try {
    // 1. Validate environment variables before doing anything
    validateEnv();

    // 2. Test database connection before starting server
    await testConnection();

    // 2. Start listening for requests
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });

    // 3. Graceful shutdown handler
    const gracefulShutdown = async () => {
      console.log('Shutting down server gracefully...');
      
      server.close(async () => {
        console.log('HTTP server closed.');
        await closePool();
        process.exit(0);
      });

      // Force close if taking too long (e.g., 10 seconds)
      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    // Listen for termination signals
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

// Handle unhandled promise rejections globally
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

// Handle uncaught exceptions globally
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

startServer();
