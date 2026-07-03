const { queryAll, queryOne, execute } = require('../config/db');

class DownloadLog {
  /**
   * Create a new download log entry
   * @param {Object} data - { resource_id, user_id, ip_address }
   * @returns {Object} Created log entry
   */
  static create(data) {
    const result = execute(
      'INSERT INTO download_logs (resource_id, user_id, ip_address) VALUES (?, ?, ?)',
      [data.resource_id, data.user_id, data.ip_address || null]
    );
    return queryOne('SELECT * FROM download_logs WHERE id = ?', [result.lastInsertRowid]);
  }

  /**
   * Get download logs for a specific resource
   * @param {number} resourceId
   * @param {Object} options
   * @returns {{ logs: Array, total: number }}
   */
  static findByResource(resourceId, { page = 1, pageSize = 20 } = {}) {
    const total = queryOne(
      'SELECT COUNT(*) as total FROM download_logs WHERE resource_id = ?',
      [resourceId]
    ).total;

    const offset = (page - 1) * pageSize;
    const logs = queryAll(
      `SELECT dl.*, u.display_name as user_name
       FROM download_logs dl
       LEFT JOIN users u ON dl.user_id = u.id
       WHERE dl.resource_id = ?
       ORDER BY dl.downloaded_at DESC
       LIMIT ? OFFSET ?`,
      [resourceId, pageSize, offset]
    );

    return { logs, total };
  }

  /**
   * Get download count by period
   * @param {string} period - 'today', 'week', 'month'
   * @returns {number}
   */
  static getDownloadCount(period = 'today') {
    let query;
    switch (period) {
      case 'today':
        query = "SELECT COUNT(*) as count FROM download_logs WHERE date(downloaded_at) = date('now', 'localtime')";
        break;
      case 'week':
        query = "SELECT COUNT(*) as count FROM download_logs WHERE downloaded_at >= datetime('now', 'localtime', '-7 days')";
        break;
      case 'month':
        query = "SELECT COUNT(*) as count FROM download_logs WHERE downloaded_at >= datetime('now', 'localtime', '-30 days')";
        break;
      default:
        query = 'SELECT COUNT(*) as count FROM download_logs';
    }
    return queryOne(query).count;
  }

  /**
   * Get download count per day for the last N days
   * @param {number} days
   * @returns {Array} [{ date, count }]
   */
  static getDailyDownloads(days = 7) {
    return queryAll(
      `SELECT date(downloaded_at) as date, COUNT(*) as count
       FROM download_logs
       WHERE downloaded_at >= datetime('now', 'localtime', ?)
       GROUP BY date(downloaded_at)
       ORDER BY date ASC`,
      [`-${days} days`]
    );
  }

  /**
   * Get top downloaded resources
   * @param {number} limit
   * @returns {Array}
   */
  static getTopDownloaded(limit = 10) {
    return queryAll(
      `SELECT r.id, r.title, r.download_count, r.file_type, u.display_name as uploader_name
       FROM resources r
       LEFT JOIN users u ON r.uploader_id = u.id
       WHERE r.status = 'approved'
       ORDER BY r.download_count DESC
       LIMIT ?`,
      [limit]
    );
  }
}

module.exports = DownloadLog;
