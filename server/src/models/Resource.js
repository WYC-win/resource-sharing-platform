const { queryAll, queryOne, execute } = require('../config/db');

class Resource {
  /**
   * Create a new resource
   * @param {Object} data
   * @returns {Object} Created resource
   */
  static create(data) {
    const result = execute(
      `INSERT INTO resources (title, description, course_id, category_id, file_name, file_path,
        file_size, file_type, mime_type, uploader_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.title,
        data.description || null,
        data.course_id || null,
        data.category_id,
        data.file_name,
        data.file_path,
        data.file_size,
        data.file_type,
        data.mime_type,
        data.uploader_id,
        data.status || 'pending',
      ]
    );
    return this.findById(result.lastInsertRowid);
  }

  /**
   * Find resource by ID with JOIN info
   * @param {number} id
   * @returns {Object|undefined}
   */
  static findById(id) {
    return queryOne(
      `SELECT r.*, u.display_name as uploader_name, c.name as category_name, co.name as course_name
       FROM resources r
       LEFT JOIN users u ON r.uploader_id = u.id
       LEFT JOIN categories c ON r.category_id = c.id
       LEFT JOIN courses co ON r.course_id = co.id
       WHERE r.id = ?`,
      [id]
    );
  }

  /**
   * List approved resources (student view)
   * @param {Object} options
   * @returns {{ resources: Array, total: number }}
   */
  static findApproved({
    page = 1, pageSize = 20, search = '', category_id = '',
    file_type = '', sort = 'created_at', order = 'desc', course_id = ''
  } = {}) {
    const conditions = ["r.status = 'approved'", "r.is_visible = 1"];
    const params = [];

    if (search) {
      conditions.push('(r.title LIKE ? OR r.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category_id) {
      conditions.push('r.category_id = ?');
      params.push(category_id);
    }
    if (course_id) {
      conditions.push('r.course_id = ?');
      params.push(course_id);
    }
    if (file_type) {
      conditions.push('r.file_type = ?');
      params.push(file_type);
    }

    const whereClause = 'WHERE ' + conditions.join(' AND ');
    const allowedSortFields = ['created_at', 'download_count', 'title', 'file_size'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    const total = queryOne(`SELECT COUNT(*) as total FROM resources r ${whereClause}`, params).total;

    const offset = (page - 1) * pageSize;
    const resources = queryAll(
      `SELECT r.*, u.display_name as uploader_name, c.name as category_name, co.name as course_name
       FROM resources r
       LEFT JOIN users u ON r.uploader_id = u.id
       LEFT JOIN categories c ON r.category_id = c.id
       LEFT JOIN courses co ON r.course_id = co.id
       ${whereClause}
       ORDER BY c.sort_order ASC, r.${sortField} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return { resources, total };
  }

  /**
   * List all resources (admin view)
   * @param {Object} options
   * @returns {{ resources: Array, total: number }}
   */
  static findAll({
    page = 1, pageSize = 20, search = '', category_id = '',
    status = '', file_type = '', course_id = ''
  } = {}) {
    const conditions = [];
    const params = [];

    if (search) {
      conditions.push('(r.title LIKE ? OR r.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category_id) {
      conditions.push('r.category_id = ?');
      params.push(category_id);
    }
    if (course_id) {
      conditions.push('r.course_id = ?');
      params.push(course_id);
    }
    if (status) {
      conditions.push('r.status = ?');
      params.push(status);
    }
    if (file_type) {
      conditions.push('r.file_type = ?');
      params.push(file_type);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const total = queryOne(`SELECT COUNT(*) as total FROM resources r ${whereClause}`, params).total;

    const offset = (page - 1) * pageSize;
    const resources = queryAll(
      `SELECT r.*, u.display_name as uploader_name, c.name as category_name, co.name as course_name
       FROM resources r
       LEFT JOIN users u ON r.uploader_id = u.id
       LEFT JOIN categories c ON r.category_id = c.id
       LEFT JOIN courses co ON r.course_id = co.id
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return { resources, total };
  }

  /**
   * List resources uploaded by a specific user
   * @param {number} userId
   * @param {Object} options
   * @returns {{ resources: Array, total: number }}
   */
  static findByUploader(userId, { page = 1, pageSize = 20 } = {}) {
    const total = queryOne(
      'SELECT COUNT(*) as total FROM resources WHERE uploader_id = ?',
      [userId]
    ).total;

    const offset = (page - 1) * pageSize;
    const resources = queryAll(
      `SELECT r.*, c.name as category_name, co.name as course_name
       FROM resources r
       LEFT JOIN categories c ON r.category_id = c.id
       LEFT JOIN courses co ON r.course_id = co.id
       WHERE r.uploader_id = ?
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, pageSize, offset]
    );

    return { resources, total };
  }

  /**
   * Update resource
   * @param {number} id
   * @param {Object} updates
   * @returns {Object} Updated resource
   */
  static update(id, updates) {
    const fields = [];
    const params = [];

    const allowedFields = ['title', 'description', 'course_id', 'category_id', 'status', 'review_note', 'reviewed_by', 'reviewed_at', 'file_path'];
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        fields.push(`${field} = ?`);
        params.push(updates[field]);
      }
    }

    if (fields.length === 0) return this.findById(id);

    fields.push("updated_at = datetime('now', 'localtime')");
    params.push(id);

    execute(`UPDATE resources SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }

  /**
   * Increment download count
   * @param {number} id
   */
  static incrementDownloadCount(id) {
    execute('UPDATE resources SET download_count = download_count + 1 WHERE id = ?', [id]);
  }

  /**
   * Unpublish resource (set is_visible = 0)
   * Resources become hidden from student view but remain in database
   * @param {number} id
   * @returns {Object} Updated resource
   */
  static unpublish(id) {
    execute("UPDATE resources SET is_visible = 0, updated_at = datetime('now', 'localtime') WHERE id = ?", [id]);
    return this.findById(id);
  }

  /**
   * Republish resource (set is_visible = 1)
   * @param {number} id
   * @returns {Object} Updated resource
   */
  static republish(id) {
    execute("UPDATE resources SET is_visible = 1, updated_at = datetime('now', 'localtime') WHERE id = ?", [id]);
    return this.findById(id);
  }

  /**
   * Delete resource (with download logs)
   * @param {number} id
   * @returns {Object|null} The deleted resource info (for file cleanup)
   */
  static delete(id) {
    const resource = queryOne('SELECT * FROM resources WHERE id = ?', [id]);
    if (!resource) return null;
    execute('DELETE FROM download_logs WHERE resource_id = ?', [id]);
    execute('DELETE FROM resources WHERE id = ?', [id]);
    return resource;
  }

  /**
   * Get dashboard statistics
   * @returns {Object}
   */
  static getStats() {
    const total = queryOne('SELECT COUNT(*) as count FROM resources');
    const approved = queryOne("SELECT COUNT(*) as count FROM resources WHERE status = 'approved'");
    const pending = queryOne("SELECT COUNT(*) as count FROM resources WHERE status = 'pending'");
    const hidden = queryOne("SELECT COUNT(*) as count FROM resources WHERE status = 'approved' AND is_visible = 0");
    const totalDownloads = queryOne('SELECT COALESCE(SUM(download_count), 0) as count FROM resources');
    const totalSize = queryOne("SELECT COALESCE(SUM(file_size), 0) as total FROM resources WHERE status = 'approved'");
    return {
      total: total.count,
      approved: approved.count,
      pending: pending.count,
      hidden: hidden.count,
      totalDownloads: totalDownloads.count,
      totalSizeBytes: totalSize.total,
    };
  }

  /**
   * Get recent resources
   * @param {number} limit
   * @returns {Array}
   */
  static getRecent(limit = 10) {
    return queryAll(
      `SELECT r.*, u.display_name as uploader_name, c.name as category_name, co.name as course_name
       FROM resources r
       LEFT JOIN users u ON r.uploader_id = u.id
       LEFT JOIN categories c ON r.category_id = c.id
       LEFT JOIN courses co ON r.course_id = co.id
       ORDER BY r.created_at DESC
       LIMIT ?`,
      [limit]
    );
  }

  /**
   * Get resource distribution by category
   * @returns {Array}
   */
  static getCategoryDistribution() {
    return queryAll(`
      SELECT c.name, COUNT(r.id) as count
      FROM categories c
      LEFT JOIN resources r ON c.id = r.category_id AND r.status = 'approved'
      GROUP BY c.id, c.name
    `);
  }
}

module.exports = Resource;
