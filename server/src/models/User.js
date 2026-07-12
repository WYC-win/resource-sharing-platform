const { queryAll, queryOne, execute } = require('../config/db');

class User {
  /**
   * Create a new user
   * @param {Object} userData - { username, password_hash, display_name, role }
   * @returns {Object} The created user (without password_hash)
   */
  static create(userData) {
    const result = execute(
      `INSERT INTO users (username, password_hash, display_name, role)
       VALUES (?, ?, ?, ?)`,
      [userData.username, userData.password_hash, userData.display_name, userData.role || 'student']
    );
    return this.findById(result.lastInsertRowid);
  }

  /**
   * Find user by username
   * @param {string} username
   * @returns {Object|undefined} User object with password_hash
   */
  static findByUsername(username) {
    return queryOne('SELECT * FROM users WHERE username = ?', [username]);
  }

  /**
   * Find user by ID
   * @param {number} id
   * @returns {Object|undefined} User object (without password_hash)
   */
  static findById(id) {
    return queryOne(
      'SELECT id, username, display_name, role, status, created_at, updated_at, last_login_at, disclaimer_accepted_at FROM users WHERE id = ?',
      [id]
    );
  }

  /**
   * List all users with pagination
   * @param {Object} options - { page, pageSize, search, role, status }
   * @returns {{ users: Array, total: number }}
   */
  static findAll({ page = 1, pageSize = 20, search = '', role = '', status = '' } = {}) {
    const conditions = [];
    const params = [];

    if (search) {
      conditions.push('(username LIKE ? OR display_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (role) {
      conditions.push('role = ?');
      params.push(role);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const countResult = queryOne(`SELECT COUNT(*) as total FROM users ${whereClause}`, params);
    const total = countResult.total;

    const offset = (page - 1) * pageSize;
    const users = queryAll(
      `SELECT id, username, display_name, role, status, created_at, updated_at, last_login_at
       FROM users ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return { users, total };
  }

  /**
   * Update user
   * @param {number} id
   * @param {Object} updates
   * @returns {Object} Updated user
   */
  static update(id, updates) {
    const fields = [];
    const params = [];

    if (updates.display_name !== undefined) {
      fields.push('display_name = ?');
      params.push(updates.display_name);
    }
    if (updates.role !== undefined) {
      fields.push('role = ?');
      params.push(updates.role);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      params.push(updates.status);
    }
    if (updates.password_hash !== undefined) {
      fields.push('password_hash = ?');
      params.push(updates.password_hash);
    }

    if (fields.length === 0) return this.findById(id);

    fields.push("updated_at = datetime('now', 'localtime')");
    params.push(id);

    execute(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
    return this.findById(id);
  }

  /**
   * Delete (hard delete) user
   * @param {number} id
   * @returns {boolean}
   */
  static delete(id) {
    const result = execute('DELETE FROM users WHERE id = ?', [id]);
    return result.changes > 0;
  }

  /**
   * Get user statistics
   * @returns {Object} { total, active, admin, student }
   */
  static getStats() {
    const total = queryOne('SELECT COUNT(*) as count FROM users');
    const active = queryOne("SELECT COUNT(*) as count FROM users WHERE status = 'active'");
    const admin = queryOne("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
    const student = queryOne("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
    return {
      total: total.count,
      active: active.count,
      admin: admin.count,
      student: student.count,
    };
  }
}

module.exports = User;
