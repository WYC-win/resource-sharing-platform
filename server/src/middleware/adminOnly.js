/**
 * Admin-only middleware
 * Must be used after the auth middleware
 */
function adminOnly(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      code: 401,
      message: '未登录',
      data: null,
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      code: 403,
      message: '权限不足，仅管理员可执行此操作',
      data: null,
    });
  }

  next();
}

module.exports = adminOnly;
