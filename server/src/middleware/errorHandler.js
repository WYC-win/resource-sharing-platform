/**
 * Global error handler middleware
 */
function errorHandler(err, req, res, next) {
  console.error('[Error]', err.stack || err.message || err);

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      code: 400,
      message: '文件大小超过限制（最大 50MB）',
      data: null,
    });
  }

  // Multer unexpected file field
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      code: 400,
      message: '上传字段错误',
      data: null,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      code: 401,
      message: '登录已过期，请重新登录',
      data: null,
    });
  }

  // Validation errors (express-validator)
  if (err.type === 'validation') {
    return res.status(422).json({
      code: 422,
      message: '请求参数验证失败',
      data: err.errors || [],
    });
  }

  // Default server error
  const statusCode = err.statusCode || 500;
  const message = err.statusCode
    ? err.message
    : '服务器内部错误，请稍后重试';

  res.status(statusCode).json({
    code: statusCode,
    message,
    data: null,
  });
}

/**
 * Create an error with status code
 * @param {string} message
 * @param {number} statusCode
 * @returns {Error}
 */
function createError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

module.exports = { errorHandler, createError };
