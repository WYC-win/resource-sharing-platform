const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/index');
const { getExtension, getFileType } = require('../utils/fileHelper');

/**
 * Multer configuration
 * Stores files on disk with UUID-based filenames to prevent collisions
 * Validates file types and size
 */

// Ensure upload directories exist
function ensureUploadDirs() {
  const dirs = ['pending', 'approved', 'rejected'];
  for (const dir of dirs) {
    const fullPath = path.join(config.upload.dir, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }
}

ensureUploadDirs();

// Disk storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Files always go to pending first, moved on review
    const pendingDir = path.join(config.upload.dir, 'pending');
    cb(null, pendingDir);
  },
  filename: (req, file, cb) => {
    const ext = getExtension(file.originalname);
    const uuid = uuidv4();
    // Preserve original extension for proper MIME handling
    cb(null, `${uuid}${ext}`);
  },
});

// File filter: only allow allowed file types
function fileFilter(req, file, cb) {
  const ext = getExtension(file.originalname);
  const mime = file.mimetype.toLowerCase();

  if (config.upload.allowedExtensions.includes(ext) && config.upload.allowedTypes.includes(mime)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件格式: ${ext}，仅支持 PDF、Word、PPT、Excel 文档`));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 1, // Only one file per upload
  },
});

module.exports = upload;
