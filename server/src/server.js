const app = require('./app');
const config = require('./config/index');
const { getDb, closeDb } = require('./config/db');

const PORT = config.port;

async function start() {
  try {
    // Initialize database
    await getDb();
    console.log(`✅ Database initialized (${config.db.path})`);

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`   Environment: ${config.env}`);
      console.log(`   Max file size: ${(config.upload.maxFileSize / 1024 / 1024).toFixed(0)}MB`);
    });

    // Graceful shutdown
    const shutdown = () => {
      console.log('\n🛑 Shutting down...');
      server.close(() => {
        closeDb();
        console.log('✅ Closed gracefully');
        process.exit(0);
      });
      // Force shutdown after 5s
      setTimeout(() => {
        console.error('⚠️ Forced shutdown');
        process.exit(1);
      }, 5000);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();
