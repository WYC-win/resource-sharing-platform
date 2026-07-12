const express = require('express');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const User = require('../models/User');
const Resource = require('../models/Resource');
const DownloadLog = require('../models/DownloadLog');
const { queryOne, queryAll } = require('../config/db');
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
  const totalDownloads = DownloadLog.getDownloadCount('all');

  // Visit stats
  const totalVisits = queryOne('SELECT COUNT(*) as count FROM visit_logs');
  const todayVisits = queryOne("SELECT COUNT(*) as count FROM visit_logs WHERE date(visited_at) = date('now', 'localtime')");
  const todayVisitors = queryOne("SELECT COUNT(DISTINCT ip_address) as count FROM visit_logs WHERE date(visited_at) = date('now', 'localtime')");

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
        total: totalDownloads,
      },
      visits: {
        total: totalVisits?.count || 0,
        today: todayVisits?.count || 0,
        todayVisitors: todayVisitors?.count || 0,
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

/**
 * GET /api/v1/stats/live-log
 * Live activity log - recent downloads and visits
 */
router.get('/live-log', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);

  // Recent downloads with user and resource info
  const downloads = queryAll(`
    SELECT 'download' as type, u.username, r.title, r.file_type,
           dl.downloaded_at as time
    FROM download_logs dl
    JOIN users u ON dl.user_id = u.id
    JOIN resources r ON dl.resource_id = r.id
    ORDER BY dl.downloaded_at DESC
    LIMIT ?
  `, [limit]);

  // Recent visits (with username when available)
  const visits = queryAll(`
    SELECT 'visit' as type, COALESCE(u.username, vl.ip_address) as visitor,
           '' as title, '' as file_type,
           vl.visited_at as time
    FROM visit_logs vl
    LEFT JOIN users u ON vl.user_id = u.id
    ORDER BY vl.visited_at DESC
    LIMIT ?
  `, [limit]);

  // Merge and sort by time DESC
  const merged = [...downloads, ...visits]
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, limit);

  res.json({ code: 200, message: 'success', data: merged });
});

module.exports = router;
