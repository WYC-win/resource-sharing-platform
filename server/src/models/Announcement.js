const { queryAll, queryOne, execute } = require('../config/db');

class Announcement {
  /**
   * Create a new announcement
   * @param {Object} data - { title, content, created_by }
   * @returns {Object} The created announcement
   */
  static create(data) {
    const result = execute(
      'INSERT INTO announcements (title, content, created_by) VALUES (?, ?, ?)',
      [data.title, data.content, data.created_by]
    );
    return this.findById(result.lastInsertRowid);
  }

  /**
   * Find announcement by ID, with creator name
   * @param {number} id
   * @returns {Object|undefined}
   */
  static findById(id) {
    return queryOne(`
      SELECT a.*, u.display_name as creator_name
      FROM announcements a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.id = ?
    `, [id]);
  }

  /**
   * List all announcements for admin (paginated)
   * @param {Object} options - { page, pageSize, status }
   * @returns {{ items: Array, meta: { total, page, pageSize } }}
   */
  static findAll(options = {}) {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;

    let whereClause = '';
    const params = [];
    if (options.status) {
      whereClause = 'WHERE a.status = ?';
      params.push(options.status);
    }

    const total = queryOne(
      `SELECT COUNT(*) as count FROM announcements a ${whereClause}`, params
    ).count;

    const items = queryAll(`
      SELECT a.*, u.display_name as creator_name
      FROM announcements a
      LEFT JOIN users u ON a.created_by = u.id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, pageSize, offset]);

    return { items, meta: { total, page, pageSize } };
  }

  /**
   * Get published announcements for students
   * Ordered by: pinned first, then by publish time desc. Max 10.
   * @returns {Array}
   */
  static findPublished() {
    return queryAll(`
      SELECT a.*, u.display_name as creator_name
      FROM announcements a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.status = 'published'
      ORDER BY a.is_pinned DESC, a.published_at DESC
      LIMIT 10
    `);
  }

  /**
   * Update announcement
   * @param {number} id
   * @param {Object} updates - { title, content }
   * @returns {Object} Updated announcement
   */
  static update(id, updates) {
    const fields = [];
    const params = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      params.push(updates.title);
    }
    if (updates.content !== undefined) {
      fields.push('content = ?');
      params.push(updates.content);
    }

    if (fields.length === 0) return this.findById(id);

    fields.push("updated_at = datetime('now', 'localtime')");
    params.push(id);
    execute(`UPDATE announcements SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }

  /**
   * Delete announcement
   * @param {number} id
   * @returns {{ success: boolean }}
   */
  static delete(id) {
    const result = execute('DELETE FROM announcements WHERE id = ?', [id]);
    return { success: result.changes > 0 };
  }

  /**
   * Publish announcement
   * @param {number} id
   * @returns {Object} Updated announcement
   */
  static publish(id) {
    execute(`
      UPDATE announcements
      SET status = 'published', published_at = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [id]);
    return this.findById(id);
  }

  /**
   * Unpublish announcement (revert to draft)
   * @param {number} id
   * @returns {Object} Updated announcement
   */
  static unpublish(id) {
    execute(`
      UPDATE announcements
      SET status = 'draft', published_at = NULL, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [id]);
    return this.findById(id);
  }

  /**
   * Toggle pinned status
   * @param {number} id
   * @returns {Object} Updated announcement
   */
  static togglePin(id) {
    execute(`
      UPDATE announcements
      SET is_pinned = CASE WHEN is_pinned = 1 THEN 0 ELSE 1 END,
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [id]);
    return this.findById(id);
  }
}

module.exports = Announcement;
