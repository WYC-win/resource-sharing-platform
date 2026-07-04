const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config/index');
const User = require('../models/User');

/**
 * Authenticate user and generate tokens
 * @param {string} username
 * @param {string} password
 * @returns {Object|null} { user, accessToken, refreshToken } or null
 */
async function login(username, password) {
  const user = User.findByUsername(username);
  if (!user) return null;

  // Check password
  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) return null;

  // Check account status
  if (user.status === 'disabled') {
    throw Object.assign(new Error('账号已被禁用，请联系管理员'), { statusCode: 403 });
  }

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Remove password hash from returned user
  const { password_hash, ...safeUser } = user;

  return {
    user: safeUser,
    accessToken,
    refreshToken,
  };
}

/**
 * Generate access token (short-lived)
 * @param {Object} user
 * @returns {string}
 */
function generateAccessToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiresIn }
  );
}

/**
 * Generate refresh token (long-lived)
 * @param {Object} user
 * @returns {string}
 */
function generateRefreshToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      type: 'refresh',
    },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
}

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken
 * @returns {Object|null} { accessToken, refreshToken } or null
 */
function refreshAccessToken(refreshToken) {
  try {
    const decoded = jwt.verify(refreshToken, config.jwt.secret);
    if (decoded.type !== 'refresh') return null;

    const user = User.findById(decoded.userId);
    if (!user || user.status === 'disabled') return null;

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  } catch {
    return null;
  }
}

/**
 * Validate student ID format and auto-login/create
 * Rules: 10 digits
 *   - First 4 digits (college code): 1001-1019
 *   - Last 2 digits (class seq no.): 01-36
 * @param {string} studentId
 * @returns {Object} { user, accessToken, refreshToken }
 */
function studentLogin(studentId) {
  // Validate format (all error messages are intentionally generic)
  const validation = validateStudentId(studentId);
  if (!validation.valid) {
    throw Object.assign(new Error('学号错误'), { statusCode: 400 });
  }

  // Find or auto-create user
  let user = User.findByUsername(studentId);
  if (!user) {
    User.create({
      username: studentId,
      password_hash: '', // Students don't need a password
      display_name: studentId,
      role: 'student',
    });
    user = User.findByUsername(studentId);
  }

  // Check status
  if (user.status === 'disabled') {
    throw Object.assign(new Error('账号已被禁用，请联系管理员'), { statusCode: 403 });
  }

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  const { password_hash, ...safeUser } = user;
  return { user: safeUser, accessToken, refreshToken };
}

/**
 * Validate student ID format
 */
/**
 * Validate student ID format
 * Rules based on CUGB actual student ID structure:
 *   - 10 digits total
 *   - First 4 digits: college code (1001-1019, covers all current 2023-2024 departments)
 *   - Positions 5-6: enrollment year (no restriction, covers all years)
 *   - Positions 7-8: class code (no restriction, varies by department)
 *   - Last 2 digits: sequence number in class (01-36)
 */
function validateStudentId(id) {
  if (!id || typeof id !== 'string') {
    return { valid: false, message: '请输入学号' };
  }

  // Must be exactly 10 digits
  if (!/^\d{10}$/.test(id)) {
    return { valid: false, message: '学号必须为 10 位数字' };
  }

  // Special test account
  if (id === '1000000000') {
    return { valid: true };
  }

  // First 4 digits must be valid college code (1001-1009)
  const prefix = parseInt(id.substring(0, 4), 10);
  if (prefix < 1001 || prefix > 1009) {
    return { valid: false, message: '学号错误' };
  }

  // Last 2 digits must be 01-36 (班级序号)
  const suffix = parseInt(id.substring(8), 10);
  if (suffix < 1 || suffix > 36) {
    return { valid: false, message: '学号错误' };
  }

  return { valid: true };
}

module.exports = {
  login,
  studentLogin,
  generateAccessToken,
  generateRefreshToken,
  refreshAccessToken,
};
