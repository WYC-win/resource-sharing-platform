const jwt = require('jsonwebtoken');
const config = require('../config/index');
const User = require('../models/User');

/**
 * JWT Authentication middleware
 * Verifies the access token from the Authorization header
 * Attaches user info to req.user
 */
function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      code: 401,
      message: '未登录，请先登录',
      data: null,
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        code: 401,
        message: '用户不存在',
        data: null,
      });
    }
    if (user.status === 'disabled') {
      return res.status(403).json({
        code: 403,
        message: '账号已被禁用，请联系管理员',
        data: null,
      });
    }

    req.user = {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        code: 401,
        message: '登录已过期，请重新登录',
        data: null,
      });
    }
    return res.status(401).json({
      code: 401,
      message: '无效的登录凭证',
      data: null,
    });
  }
}

module.exports = auth;
