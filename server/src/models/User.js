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

    // 附上「最近访问时间」。
    // last_login_at 只在调用登录接口时刷新，而学生登录一次后 token 存在浏览器里，
    // 之后再进站直接带 token、不会再走登录接口，所以该字段会一直停在第一次登录。
    // 真正的访问时间在 visit_logs（app.js 里每个 /api/ 请求都会记一条，同 IP 60 秒去重）。
    // 这里取「访问记录」与「最后登录」中更晚的那个——登录本身也算一次访问。
    if (users.length > 0) {
      const ids = users.map((u) => u.id);
      const visitMap = {};
      queryAll(
        `SELECT user_id, MAX(visited_at) AS last_visit
         FROM visit_logs
         WHERE user_id IN (${ids.map(() => '?').join(',')})
         GROUP BY user_id`,
        ids
      ).forEach((r) => { visitMap[r.user_id] = r.last_visit; });

      users.forEach((u) => {
        const v = visitMap[u.id];
        u.last_visit = (v && (!u.last_login_at || v > u.last_login_at))
          ? v
          : (u.last_login_at || null);
      });
    }

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
