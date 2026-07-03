// PM2 Ecosystem config
// Optimized for 2C2G server
module.exports = {
  apps: [
    {
      name: 'resource-api',
      script: 'src/server.js',
      cwd: '/opt/resource-platform/server',

      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        JWT_SECRET: 'change-this-to-a-random-string-at-least-32-chars',
        DB_PATH: '/opt/resource-platform/server/data/database.sqlite',
        UPLOAD_DIR: '/opt/resource-platform/server/uploads',
        MAX_FILE_SIZE: 52428800,
        CORS_ORIGIN: 'https://your-domain.com',
      },

      // 2C2G optimized settings
      exec_mode: 'fork',       // Single process (SQLite doesn't support cluster)
      instances: 1,
      max_memory_restart: '300M',  // Restart if memory exceeds 300MB

      // Node.js memory limit (256MB heap)
      node_args: '--max-old-space-size=256',

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/resource-api/error.log',
      out_file: '/var/log/resource-api/out.log',
      merge_logs: true,
      log_type: 'json',

      // Restart behavior
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      min_uptime: 10000,

      // Watch - don't watch in production
      watch: false,
    },
  ],
};
