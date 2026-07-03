const express = require('express');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const Category = require('../models/Category');

const router = express.Router();

/**
 * GET /api/v1/categories
 * List all categories (authenticated users)
 */
router.get('/', auth, (req, res) => {
  const categories = Category.findAll();
  const counts = Category.getResourceCounts();

  // Merge resource counts into categories
  const countMap = {};
  counts.forEach((c) => {
    countMap[c.id] = c.count;
  });
  const data = categories.map((cat) => ({
    ...cat,
    resourceCount: countMap[cat.id] || 0,
  }));

  res.json({ code: 200, message: 'success', data });
});

/**
 * POST /api/v1/categories
 * Create category (admin only)
 */
router.post('/', auth, adminOnly, (req, res) => {
  const { name, description, sort_order } = req.body;

  if (!name) {
    return res.status(400).json({ code: 400, message: '请填写分类名称', data: null });
  }

  const category = Category.create({ name, description, sort_order });
  res.status(201).json({ code: 201, message: '分类创建成功', data: category });
});

/**
 * PUT /api/v1/categories/:id
 * Update category (admin only)
 */
router.put('/:id', auth, adminOnly, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, description, sort_order } = req.body;
  const category = Category.update(id, { name, description, sort_order });

  if (!category) {
    return res.status(404).json({ code: 404, message: '分类不存在', data: null });
  }

  res.json({ code: 200, message: '更新成功', data: category });
});

/**
 * DELETE /api/v1/categories/:id
 * Delete category (admin only)
 */
router.delete('/:id', auth, adminOnly, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const result = Category.delete(id);

  if (!result.success) {
    return res.status(400).json({ code: 400, message: result.message, data: null });
  }

  res.json({ code: 200, message: '删除成功', data: null });
});

module.exports = router;
