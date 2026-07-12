const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const jwt = require('jsonwebtoken');
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

// Visit counter - dedupe same IP within 60s window to avoid counting multi-API page loads
const visitCache = new Map();
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    try {
      const now = Date.now();
      const lastVisit = visitCache.get(req.ip);
      if (!lastVisit || now - lastVisit > 60000) {
        visitCache.set(req.ip, now);
        // Try to get user_id from JWT token
        let userId = null;
        const authHeader = req.headers.authorization;
        const queryToken = req.query && req.query.token;
        const token = queryToken || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null);
        if (token) {
          try {
            const decoded = jwt.verify(token, config.jwt.secret);
            userId = decoded.userId;
            // Skip admin and test account
            if (decoded.role === 'admin' || decoded.username === '1000000000') {
              next();
              return;
            }
          } catch {}
        }
        execute(
          'INSERT INTO visit_logs (user_id, ip_address, user_agent) VALUES (?, ?, ?)',
          [userId, req.ip, req.headers['user-agent'] || '']
        );
        // Clean up stale entries every 100 inserts
        if (visitCache.size > 500) {
          const cutoff = now - 60000;
          for (const [ip, time] of visitCache) {
            if (time < cutoff) visitCache.delete(ip);
          }
        }
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
