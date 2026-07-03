const express = require('express');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const User = require('../models/User');

const router = express.Router();

// All routes require auth + admin
router.use(auth, adminOnly);

/**
 * GET /api/v1/users
 * List users with pagination and filtering
 */
router.get('/', (req, res) => {
  const { page = 1, pageSize = 20, search = '', role = '', status = '' } = req.query;
  const result = User.findAll({
    page: parseInt(page, 10),
    pageSize: parseInt(pageSize, 10),
    search,
    role,
    status,
  });

  res.json({
    code: 200,
    message: 'success',
    data: result.users,
    meta: {
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      total: result.total,
      totalPages: Math.ceil(result.total / parseInt(pageSize, 10)),
    },
  });
});

/**
 * POST /api/v1/users
 * Create a new user (admin pre-creates accounts)
 */
router.post('/', async (req, res, next) => {
  try {
    const { username, display_name, role = 'student' } = req.body;

    if (!username || !display_name) {
      return res.status(400).json({
        code: 400,
        message: '请填写用户名和显示名称',
        data: null,
      });
    }

    // Check if username already exists
    const existing = User.findByUsername(username);
    if (existing) {
      return res.status(409).json({
        code: 409,
        message: '用户名已存在',
        data: null,
      });
    }

    // Generate random initial password (8 chars)
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = User.create({
      username,
      password_hash: passwordHash,
      display_name,
      role,
    });

    res.status(201).json({
      code: 201,
      message: '用户创建成功',
      data: {
        ...user,
        initialPassword: password, // Only returned once at creation
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/users/:id
 * Update user
 */
router.put('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { display_name, role, status } = req.body;
    const updates = {};
    if (display_name !== undefined) updates.display_name = display_name;
    if (role !== undefined) updates.role = role;
    if (status !== undefined) updates.status = status;

    const user = User.update(id, updates);
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在', data: null });
    }

    res.json({ code: 200, message: '更新成功', data: user });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/users/:id
 * Delete user
 */
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const deleted = User.delete(id);
  if (!deleted) {
    return res.status(404).json({ code: 404, message: '用户不存在', data: null });
  }
  res.json({ code: 200, message: '删除成功', data: null });
});

/**
 * PUT /api/v1/users/:id/reset-password
 * Reset user password (admin only)
 */
router.put('/:id/reset-password', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let newPassword = '';
    for (let i = 0; i < 8; i++) {
      newPassword += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const user = User.update(id, { password_hash: passwordHash });
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在', data: null });
    }

    res.json({
      code: 200,
      message: '密码重置成功',
      data: { newPassword }, // Only returned once
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
