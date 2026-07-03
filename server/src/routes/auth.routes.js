const express = require('express');
const bcrypt = require('bcryptjs');
const authService = require('../services/authService');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Rate limiting - simple in-memory counter
// Key is IP address, value is { count, lockedUntil }
const loginAttempts = {};

function checkRateLimit(key) {
  const now = Date.now();
  const r = loginAttempts[key];
  if (!r) return { allowed: true };
  if (r.lockedUntil && now < r.lockedUntil) {
    return { allowed: false, message: `登录失败次数过多，请 ${Math.ceil((r.lockedUntil - now)/60000)} 分钟后再试` };
  }
  if (r.lockedUntil && now >= r.lockedUntil) {
    delete loginAttempts[key];
  }
  return { allowed: true };
}

function recordFailedAttempt(key) {
  if (!loginAttempts[key]) loginAttempts[key] = { count: 0, lockedUntil: null };
  loginAttempts[key].count++;
  const c = loginAttempts[key].count;
  if (c >= 5) loginAttempts[key].lockedUntil = Date.now() + 1800000; // 30 min
  return 5 - c;
}

function clearRateLimit(key) {
  delete loginAttempts[key];
}

/**
 * POST /api/v1/auth/login
 * User login
 */
router.post('/login', async (req, res, next) => {
  try {
    const key = req.ip;
    const check = checkRateLimit(key);
    if (!check.allowed) {
      return res.status(429).json({ code: 429, message: check.message, data: null });
    }

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        code: 400,
        message: '请输入用户名和密码',
        data: null,
      });
    }

    const result = await authService.login(username, password);
    if (!result) {
      const remaining = recordFailedAttempt(key);
      return res.status(401).json({
        code: 401,
        message: remaining > 0 ? `用户名或密码错误，还剩 ${remaining} 次机会` : '登录失败次数过多，请 30 分钟后再试',
        data: null,
      });
    }

    clearRateLimit(key);

    res.json({
      code: 200,
      message: '登录成功',
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/auth/profile
 * Get current user profile
 */
router.get('/profile', auth, (req, res) => {
  const user = User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({
      code: 404,
      message: '用户不存在',
      data: null,
    });
  }
  res.json({
    code: 200,
    message: 'success',
    data: user,
  });
});

/**
 * POST /api/v1/auth/refresh
 * Refresh access token
 */
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({
      code: 400,
      message: '缺少 refreshToken',
      data: null,
    });
  }

  const result = authService.refreshAccessToken(refreshToken);
  if (!result) {
    return res.status(401).json({
      code: 401,
      message: '刷新失败，请重新登录',
      data: null,
    });
  }

  res.json({
    code: 200,
    message: 'success',
    data: result,
  });
});

/**
 * POST /api/v1/auth/student-login
 * Student login via student ID only (auto-create if new)
 */
router.post('/student-login', (req, res, next) => {
  try {
    const key = req.ip;
    const check = checkRateLimit(key);
    if (!check.allowed) {
      return res.status(429).json({ code: 429, message: check.message, data: null });
    }

    const { studentId } = req.body;
    const result = authService.studentLogin(studentId);
    clearRateLimit(key);
    res.json({
      code: 200,
      message: '登录成功',
      data: result,
    });
  } catch (err) {
    if (err.statusCode === 400) {
      recordFailedAttempt(req.ip);
    }
    next(err);
  }
});

/**
 * PUT /api/v1/auth/password
 * Change password
 */
router.put('/password', auth, async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        code: 400,
        message: '请填写旧密码和新密码',
        data: null,
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        code: 400,
        message: '新密码长度不能少于 6 位',
        data: null,
      });
    }

    const user = User.findByUsername(req.user.username);
    if (!user) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在',
        data: null,
      });
    }

    const isValid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isValid) {
      return res.status(400).json({
        code: 400,
        message: '旧密码错误',
        data: null,
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    User.update(req.user.id, { password_hash: passwordHash });

    res.json({
      code: 200,
      message: '密码修改成功',
      data: null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
