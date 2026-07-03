const express = require('express');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const Course = require('../models/Course');

const router = express.Router();

/**
 * GET /api/v1/courses
 * List all courses (with resource count for students)
 */
router.get('/', auth, (req, res) => {
  // Students see courses with approved resource counts
  // Admin sees all courses
  const courses = Course.getResourceCounts();
  res.json({ code: 200, message: 'success', data: courses });
});

/**
 * GET /api/v1/courses/all
 * Get all courses without resource count (for upload form dropdown)
 */
router.get('/all', auth, (req, res) => {
  const courses = Course.findAll();
  res.json({ code: 200, message: 'success', data: courses });
});

/**
 * POST /api/v1/courses
 * Create a new course (admin only)
 */
router.post('/', auth, adminOnly, (req, res) => {
  const { name, sort_order } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ code: 400, message: '请输入课程名称', data: null });
  }

  try {
    const course = Course.create({ name: name.trim(), sort_order });
    res.status(201).json({ code: 201, message: '创建成功', data: course });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ code: 400, message: '该课程已存在', data: null });
    }
    throw err;
  }
});

/**
 * PUT /api/v1/courses/:id
 * Update a course (admin only)
 */
router.put('/:id', auth, adminOnly, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, sort_order } = req.body;

  try {
    const course = Course.update(id, { name, sort_order });
    if (!course) {
      return res.status(404).json({ code: 404, message: '课程不存在', data: null });
    }
    res.json({ code: 200, message: '更新成功', data: course });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ code: 400, message: '该课程名称已存在', data: null });
    }
    throw err;
  }
});

/**
 * DELETE /api/v1/courses/:id
 * Delete a course (admin only)
 */
router.delete('/:id', auth, adminOnly, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const result = Course.delete(id);
  if (result.success) {
    res.json({ code: 200, message: '删除成功', data: null });
  } else {
    res.status(400).json({ code: 400, message: result.message, data: null });
  }
});

module.exports = router;
