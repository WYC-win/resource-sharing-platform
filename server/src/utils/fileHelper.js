const path = require('path');

/**
 * Get file extension from filename
 * @param {string} filename
 * @returns {string} Lowercase extension
 */
function getExtension(filename) {
  return path.extname(filename).toLowerCase();
}

/**
 * Format file size to human-readable string
 * @param {number} bytes
 * @returns {string}
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
}

/**
 * Get file type category from extension
 * @param {string} ext - File extension with dot (e.g. '.pdf')
 * @returns {string}
 */
function getFileType(ext) {
  const extLower = ext.toLowerCase();
  const typeMap = {
    '.pdf': 'pdf',
    '.doc': 'doc',
    '.docx': 'docx',
    '.ppt': 'ppt',
    '.pptx': 'pptx',
    '.xls': 'xls',
    '.xlsx': 'xlsx',
  };
  return typeMap[extLower] || 'unknown';
}

/**
 * Map file extension to Chinese description
 * @param {string} ext
 * @returns {string}
 */
function getFileTypeLabel(ext) {
  const labelMap = {
    '.pdf': 'PDF 文档',
    '.doc': 'Word 文档',
    '.docx': 'Word 文档',
    '.ppt': 'PPT 演示',
    '.pptx': 'PPT 演示',
    '.xls': 'Excel 表格',
    '.xlsx': 'Excel 表格',
  };
  return labelMap[ext.toLowerCase()] || '未知格式';
}

module.exports = {
  getExtension,
  formatFileSize,
  getFileType,
  getFileTypeLabel,
};
