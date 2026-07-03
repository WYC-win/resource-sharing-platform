const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const config = require('./config/index');
const { errorHandler } = require('./middleware/errorHandler');
const { execute, queryOne } = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/users.routes');
const categoryRoutes = require('./routes/categories.routes');
const resourceRoutes = require('./routes/resources.routes');
const statsRoutes = require('./routes/stats.routes');
const courseRoutes = require('./routes/courses.routes');

const app = express();

// Trust proxy (Nginx) for correct IP detection when behind reverse proxy
app.set('trust proxy', 1);

// Security headers - relaxed for API
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);

// CORS
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
  })
);

// Request logging (skip in test)
app.use(morgan('dev'));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Simple visit counter - log each unique IP once per day
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const existing = queryOne(
        "SELECT COUNT(*) as count FROM visit_logs WHERE ip_address = ? AND date(visited_at) = ?",
        [req.ip, today]
      );
      if (!existing || existing.count === 0) {
        execute(
          'INSERT INTO visit_logs (ip_address, user_agent) VALUES (?, ?)',
          [req.ip, req.headers['user-agent'] || '']
        );
      }
    } catch (e) { /* ignore visit logging errors */ }
  }
  next();
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/resources', resourceRoutes);
app.use('/api/v1/stats', statsRoutes);
app.use('/api/v1/courses', courseRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ code: 200, message: 'ok', data: { uptime: process.uptime() } });
});

// 404 handler for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在', data: null });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
