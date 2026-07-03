const { queryAll, queryOne, execute } = require('../config/db');

class Category {
  /**
   * Create a new category
   * @param {Object} data - { name, description, sort_order }
   * @returns {Object} The created category
   */
  static create(data) {
    const result = execute(
      'INSERT INTO categories (name, description, sort_order) VALUES (?, ?, ?)',
      [data.name, data.description || null, data.sort_order || 0]
    );
    return this.findById(result.lastInsertRowid);
  }

  /**
   * Find category by ID
   * @param {number} id
   * @returns {Object|undefined}
   */
  static findById(id) {
    return queryOne('SELECT * FROM categories WHERE id = ?', [id]);
  }

  /**
   * List all categories, ordered by sort_order
   * @returns {Array}
   */
  static findAll() {
    return queryAll('SELECT * FROM categories ORDER BY sort_order ASC, id ASC');
  }

  /**
   * Update category
   * @param {number} id
   * @param {Object} updates - { name, description, sort_order }
   * @returns {Object} Updated category
   */
  static update(id, updates) {
    const fields = [];
    const params = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      params.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      params.push(updates.description);
    }
    if (updates.sort_order !== undefined) {
      fields.push('sort_order = ?');
      params.push(updates.sort_order);
    }

    if (fields.length === 0) return this.findById(id);

    params.push(id);
    execute(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }

  /**
   * Delete category (only if no resources reference it)
   * @param {number} id
   * @returns {{ success: boolean, message?: string }}
   */
  static delete(id) {
    const resourceCount = queryOne('SELECT COUNT(*) as count FROM resources WHERE category_id = ?', [id]);
    if (resourceCount.count > 0) {
      return {
        success: false,
        message: `该分类下有 ${resourceCount.count} 个资源，无法删除`,
      };
    }
    const result = execute('DELETE FROM categories WHERE id = ?', [id]);
    return { success: result.changes > 0 };
  }

  /**
   * Get resource count for each category
   * @returns {Array} [{ id, name, count }]
   */
  static getResourceCounts() {
    return queryAll(`
      SELECT c.id, c.name, COUNT(r.id) as count
      FROM categories c
      LEFT JOIN resources r ON c.id = r.category_id AND r.status = 'approved'
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.id ASC
    `);
  }
}

module.exports = Category;
