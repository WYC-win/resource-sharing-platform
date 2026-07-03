const express = require('express');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const User = require('../models/User');
const Resource = require('../models/Resource');
const DownloadLog = require('../models/DownloadLog');
const { queryOne } = require('../config/db');
const { formatFileSize } = require('../utils/fileHelper');

const router = express.Router();

// All routes require auth + admin
router.use(auth, adminOnly);

/**
 * GET /api/v1/stats/overview
 * Dashboard overview statistics
 */
router.get('/overview', (req, res) => {
  const userStats = User.getStats();
  const resourceStats = Resource.getStats();
  const todayDownloads = DownloadLog.getDownloadCount('today');
  const weekDownloads = DownloadLog.getDownloadCount('week');

  // Visit stats
  const totalVisits = queryOne('SELECT COUNT(*) as count FROM visit_logs');
  const todayVisits = queryOne("SELECT COUNT(DISTINCT ip_address) as count FROM visit_logs WHERE date(visited_at) = date('now', 'localtime')");

  res.json({
    code: 200,
    message: 'success',
    data: {
      users: userStats,
      resources: {
        ...resourceStats,
        totalSizeLabel: formatFileSize(resourceStats.totalSizeBytes),
      },
      downloads: {
        today: todayDownloads,
        week: weekDownloads,
      },
      visits: {
        total: totalVisits?.count || 0,
        today: todayVisits?.count || 0,
      },
    },
  });
});

/**
 * GET /api/v1/stats/daily-downloads
 * Download count per day for the last N days
 */
router.get('/daily-downloads', (req, res) => {
  const days = parseInt(req.query.days, 10) || 7;
  const data = DownloadLog.getDailyDownloads(Math.min(days, 90));
  res.json({ code: 200, message: 'success', data });
});

/**
 * GET /api/v1/stats/top-downloaded
 * Top downloaded resources
 */
router.get('/top-downloaded', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const data = DownloadLog.getTopDownloaded(limit);
  res.json({ code: 200, message: 'success', data });
});

/**
 * GET /api/v1/stats/category-distribution
 * Resource count by category
 */
router.get('/category-distribution', (req, res) => {
  const data = Resource.getCategoryDistribution();
  res.json({ code: 200, message: 'success', data });
});

/**
 * GET /api/v1/stats/recent
 * Recent resources
 */
router.get('/recent', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const data = Resource.getRecent(limit);
  res.json({ code: 200, message: 'success', data });
});

module.exports = router;
