const express = require('express');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const Announcement = require('../models/Announcement');

const router = express.Router();

/**
 * GET /api/v1/announcements
 * Get published announcements (for students)
 */
router.get('/', auth, (req, res) => {
  const announcements = Announcement.findPublished();
  res.json({ code: 200, message: 'success', data: announcements });
});

/**
 * GET /api/v1/announcements/admin
 * Get all announcements with pagination (admin only)
 */
router.get('/admin', auth, adminOnly, (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const pageSize = parseInt(req.query.pageSize, 10) || 20;
  const status = req.query.status || '';
  const result = Announcement.findAll({ page, pageSize, status });
  res.json({ code: 200, message: 'success', ...result });
});

/**
 * POST /api/v1/announcements
 * Create announcement (admin only)
 */
router.post('/', auth, adminOnly, (req, res) => {
  const { title, content } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ code: 400, message: '请填写公告标题', data: null });
  }
  if (!content || !content.trim()) {
    return res.status(400).json({ code: 400, message: '请填写公告内容', data: null });
  }

  const announcement = Announcement.create({
    title: title.trim(),
    content: content.trim(),
    created_by: req.user.id,
  });
  res.status(201).json({ code: 201, message: '公告创建成功', data: announcement });
});

/**
 * PUT /api/v1/announcements/:id
 * Update announcement (admin only)
 */
router.put('/:id', auth, adminOnly, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title, content } = req.body;
  const announcement = Announcement.update(id, { title, content });

  if (!announcement) {
    return res.status(404).json({ code: 404, message: '公告不存在', data: null });
  }

  res.json({ code: 200, message: '更新成功', data: announcement });
});

/**
 * DELETE /api/v1/announcements/:id
 * Delete announcement (admin only)
 */
router.delete('/:id', auth, adminOnly, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const result = Announcement.delete(id);

  if (!result.success) {
    return res.status(404).json({ code: 404, message: '公告不存在', data: null });
  }

  res.json({ code: 200, message: '删除成功', data: null });
});

/**
 * PUT /api/v1/announcements/:id/publish
 * Publish announcement (admin only)
 */
router.put('/:id/publish', auth, adminOnly, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const announcement = Announcement.publish(id);

  if (!announcement) {
    return res.status(404).json({ code: 404, message: '公告不存在', data: null });
  }

  res.json({ code: 200, message: '已发布', data: announcement });
});

/**
 * PUT /api/v1/announcements/:id/unpublish
 * Unpublish announcement (admin only)
 */
router.put('/:id/unpublish', auth, adminOnly, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const announcement = Announcement.unpublish(id);

  if (!announcement) {
    return res.status(404).json({ code: 404, message: '公告不存在', data: null });
  }

  res.json({ code: 200, message: '已下架', data: announcement });
});

/**
 * PUT /api/v1/announcements/:id/pin
 * Toggle pin status (admin only)
 */
router.put('/:id/pin', auth, adminOnly, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const announcement = Announcement.togglePin(id);

  if (!announcement) {
    return res.status(404).json({ code: 404, message: '公告不存在', data: null });
  }

  res.json({ code: 200, message: '操作成功', data: announcement });
});

module.exports = router;
