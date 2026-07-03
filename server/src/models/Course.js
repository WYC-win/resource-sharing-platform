const { queryAll, queryOne, execute } = require('../config/db');

class Course {
  /**
   * Create a new course
   * @param {Object} data - { name, sort_order }
   * @returns {Object} The created course
   */
  static create(data) {
    const result = execute(
      'INSERT INTO courses (name, sort_order) VALUES (?, ?)',
      [data.name, data.sort_order || 0]
    );
    return this.findById(result.lastInsertRowid);
  }

  /**
   * Find course by ID
   * @param {number} id
   * @returns {Object|undefined}
   */
  static findById(id) {
    return queryOne('SELECT * FROM courses WHERE id = ?', [id]);
  }

  /**
   * List all courses, ordered by sort_order
   * @returns {Array}
   */
  static findAll() {
    return queryAll('SELECT * FROM courses ORDER BY sort_order ASC, id ASC');
  }

  /**
   * Update course
   * @param {number} id
   * @param {Object} updates - { name, sort_order }
   * @returns {Object} Updated course
   */
  static update(id, updates) {
    const fields = [];
    const params = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      params.push(updates.name);
    }
    if (updates.sort_order !== undefined) {
      fields.push('sort_order = ?');
      params.push(updates.sort_order);
    }

    if (!fields.length) return this.findById(id);
    params.push(id);
    execute(`UPDATE courses SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }

  /**
   * Delete course (only if no resources reference it)
   * @param {number} id
   * @returns {{ success: boolean, message?: string }}
   */
  static delete(id) {
    const resourceCount = queryOne('SELECT COUNT(*) as count FROM resources WHERE course_id = ?', [id]);
    if (resourceCount.count > 0) {
      return {
        success: false,
        message: `该课程下有 ${resourceCount.count} 个资源，无法删除`,
      };
    }
    const result = execute('DELETE FROM courses WHERE id = ?', [id]);
    return { success: result.changes > 0 };
  }

  /**
   * Get resource count for each course
   * @returns {Array} [{ id, name, count }]
   */
  static getResourceCounts() {
    return queryAll(`
      SELECT c.id, c.name, COUNT(r.id) as count
      FROM courses c
      LEFT JOIN resources r ON c.id = r.course_id AND r.status = 'approved'
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.id ASC
    `);
  }
}

module.exports = Course;
