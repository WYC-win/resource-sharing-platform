const express = require('express');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const upload = require('../middleware/upload');
const Resource = require('../models/Resource');
const DownloadLog = require('../models/DownloadLog');
const { formatFileSize, getFileType } = require('../utils/fileHelper');
const config = require('../config/index');

const router = express.Router();

/**
 * GET /api/v1/resources
 * List approved resources (student view)
 */
router.get('/', auth, (req, res) => {
  const {
    page = 1, pageSize = 20, search = '',
    category_id = '', file_type = '', sort = 'created_at', order = 'desc', course_id = '',
  } = req.query;

  const result = Resource.findApproved({
    page: parseInt(page, 10),
    pageSize: Math.min(parseInt(pageSize, 10), 100),
    search,
    category_id,
    file_type,
    sort,
    order,
    course_id,
  });

  // Add human-readable size
  const resources = result.resources.map((r) => ({
    ...r,
    sizeLabel: formatFileSize(r.file_size),
  }));

  res.json({
    code: 200,
    message: 'success',
    data: resources,
    meta: {
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      total: result.total,
      totalPages: Math.ceil(result.total / parseInt(pageSize, 10)),
    },
  });
});

/**
 * GET /api/v1/resources/mine
 * List current user's uploads
 */
router.get('/mine', auth, (req, res) => {
  const { page = 1, pageSize = 20 } = req.query;
  const result = Resource.findByUploader(req.user.id, {
    page: parseInt(page, 10),
    pageSize: parseInt(pageSize, 10),
  });

  const resources = result.resources.map((r) => ({
    ...r,
    sizeLabel: formatFileSize(r.file_size),
  }));

  res.json({
    code: 200,
    message: 'success',
    data: resources,
    meta: {
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      total: result.total,
      totalPages: Math.ceil(result.total / parseInt(pageSize, 10)),
    },
  });
});

/**
 * GET /api/v1/resources/admin
 * List all resources (admin view)
 */
router.get('/admin', auth, adminOnly, (req, res) => {
  const {
    page = 1, pageSize = 20, search = '',
    category_id = '', status = '', file_type = '', course_id = '',
  } = req.query;

  const result = Resource.findAll({
    page: parseInt(page, 10),
    pageSize: parseInt(pageSize, 10),
    search,
    category_id,
    status,
    file_type,
    course_id,
  });

  const resources = result.resources.map((r) => ({
    ...r,
    sizeLabel: formatFileSize(r.file_size),
  }));

  res.json({
    code: 200,
    message: 'success',
    data: resources,
    meta: {
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      total: result.total,
      totalPages: Math.ceil(result.total / parseInt(pageSize, 10)),
    },
  });
});

/**
 * POST /api/v1/resources
 * Upload a new resource (max 3 concurrent uploads)
 */
let activeUploads = 0;
const MAX_UPLOADS = 10;

router.post('/', auth, (req, res, next) => {
  if (activeUploads >= MAX_UPLOADS) {
    return res.status(429).json({ code: 429, message: '当前上传队列已满（最多3人同时上传），请稍后再试', data: null });
  }
  activeUploads++;

  upload.single('file')(req, res, (err) => {
    const done = () => { activeUploads = Math.max(0, activeUploads - 1); };

    if (err) {
      done();
      if (err.message && err.message.includes('不支持的文件格式')) {
        return res.status(400).json({ code: 400, message: err.message, data: null });
      }
      return next(err);
    }

    try {
      if (!req.file) {
        done();
        return res.status(400).json({ code: 400, message: '请选择要上传的文件', data: null });
      }

      const { title, description, category_id, course_id } = req.body;
      if (!title || !category_id) {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        done();
        return res.status(400).json({
          code: 400,
          message: '请填写资源标题和分类',
          data: null,
        });
      }

      const file = req.file;
      const ext = path.extname(file.originalname).toLowerCase();
      const fileType = getFileType(ext);

      const resource = Resource.create({
        title,
        description: description || null,
        course_id: course_id ? parseInt(course_id, 10) : null,
        category_id: parseInt(category_id, 10),
        file_name: file.originalname,
        file_path: file.path,
        file_size: file.size,
        file_type: fileType,
        mime_type: file.mimetype,
        uploader_id: req.user.id,
        status: 'pending',
      });

      res.status(201).json({
        code: 201,
        message: '上传成功，等待管理员审核',
        data: { ...resource, sizeLabel: formatFileSize(resource.file_size) },
      });
      done();
    } catch (error) {
      done();
      next(error);
    }
  });
});

/**
 * GET /api/v1/resources/:id
 * Get resource detail
 */
router.get('/:id', auth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const resource = Resource.findById(id);

  if (!resource) {
    return res.status(404).json({ code: 404, message: '资源不存在', data: null });
  }

  // Students can only view approved resources (or their own)
  if (req.user.role !== 'admin' && resource.status !== 'approved' && resource.uploader_id !== req.user.id) {
    return res.status(403).json({ code: 403, message: '资源不可访问', data: null });
  }

  res.json({
    code: 200,
    message: 'success',
    data: { ...resource, sizeLabel: formatFileSize(resource.file_size) },
  });
});

/**
 * POST /api/v1/resources/:id/review
 * Approve or reject a resource (admin only)
 */
router.post('/:id/review', auth, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, review_note } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        code: 400,
        message: '审核状态无效，请选择通过或驳回',
        data: null,
      });
    }

    const resource = Resource.findById(id);
    if (!resource) {
      return res.status(404).json({ code: 404, message: '资源不存在', data: null });
    }

    if (resource.status !== 'pending') {
      return res.status(400).json({
        code: 400,
        message: '该资源已被审核，无需重复操作',
        data: null,
      });
    }

    // Move file from pending to approved/rejected
    const oldPath = resource.file_path;
    const statusDir = status === 'approved' ? 'approved' : 'rejected';
    const fileName = path.basename(oldPath);
    const newPath = path.join(config.upload.dir, statusDir, fileName);

    try {
      if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
      }
    } catch (fileErr) {
      console.error('File move error:', fileErr);
      return res.status(500).json({
        code: 500,
        message: '文件处理失败，请重试',
        data: null,
      });
    }

    // Update resource record
    const updated = Resource.update(id, {
      status,
      review_note: review_note || null,
      reviewed_by: req.user.id,
      reviewed_at: new Date().toISOString(),
      file_path: newPath,
    });

    const statusLabel = status === 'approved' ? '审核通过' : '已驳回';
    res.json({
      code: 200,
      message: `${statusLabel}`,
      data: { ...updated, sizeLabel: formatFileSize(updated.file_size) },
    });
  } catch (err) {
    console.error('Review error:', err);
    res.status(500).json({ code: 500, message: '审核失败，请重试', data: null });
  }
});

/**
 * GET /api/v1/resources/:id/preview
 * Preview a resource (PDF inline, Office via Microsoft Online Viewer)
 */
router.get('/:id/preview', (req, res) => {
  // Auth check: support both header and query param token
  let userId = null, userRole = null;
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token;
  const token = queryToken || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null);
  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      userId = decoded.userId;
      userRole = decoded.role;
    } catch {}
  }
  if (!userId) {
    return res.status(401).json({ code: 401, message: '未登录，请先登录', data: null });
  }
  req.user = { id: userId, role: userRole || 'student' };

  const id = parseInt(req.params.id, 10);
  const resource = Resource.findById(id);

  if (!resource) {
    return res.status(404).json({ code: 404, message: '资源不存在', data: null });
  }

  if (resource.status !== 'approved' && req.user.role !== 'admin') {
    return res.status(403).json({ code: 403, message: '资源暂不可预览', data: null });
  }

  const filePath = resource.file_path;
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ code: 404, message: '文件不存在', data: null });
  }

  const ft = resource.file_type;

  // PDF - serve inline
  if (ft === 'pdf') {
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(resource.title + '.pdf')}`);
    res.setHeader('Content-Type', 'application/pdf');
    return res.sendFile(filePath);
  }

  // Office docs - convert to PDF using LibreOffice, then serve inline
  const officeTypes = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'];
  if (officeTypes.includes(ft)) {
    // Cache dir for preview PDFs
    const cacheDir = path.join(path.dirname(filePath), '..', 'preview_cache');
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

    const pdfName = path.basename(filePath, path.extname(filePath)) + '.pdf';
    const pdfPath = path.join(cacheDir, pdfName);

    // Convert if not cached
    if (!fs.existsSync(pdfPath)) {
      const { execSync } = require('child_process');
      execSync(
        `libreoffice --headless --convert-to pdf --outdir "${cacheDir}" "${filePath}"`,
        { timeout: 30000, stdio: 'pipe' }
      );
    }

    if (fs.existsSync(pdfPath)) {
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(resource.title + '.pdf')}`);
      res.setHeader('Content-Type', 'application/pdf');
      return res.sendFile(pdfPath);
    }
  }

  // Other types - fallback to download
  res.redirect(`/api/v1/resources/${id}/download`);
});

/**
 * GET /api/v1/resources/:id/file
 * Raw file proxy (for Office Online Viewer to fetch)
 */
router.get('/:id/file', (req, res) => {
  // Auth check: support both header and query param token
  let userId = null, userRole = null;
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token;
  const token = queryToken || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null);
  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      userId = decoded.userId;
      userRole = decoded.role;
    } catch {}
  }
  if (!userId) {
    return res.status(401).json({ code: 401, message: '未登录，请先登录', data: null });
  }
  req.user = { id: userId, role: userRole || 'student' };

  const id = parseInt(req.params.id, 10);
  const resource = Resource.findById(id);

  if (!resource) {
    return res.status(404).json({ code: 404, message: '资源不存在', data: null });
  }

  if (resource.status !== 'approved' && req.user.role !== 'admin') {
    return res.status(403).json({ code: 403, message: '资源暂不可访问', data: null });
  }

  const filePath = resource.file_path;
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ code: 404, message: '文件不存在', data: null });
  }

  res.sendFile(filePath);
});

const { Transform } = require('stream');

// Download speed throttle: 200KB/s per connection
function createThrottle(bytesPerSecond) {
  let totalSent = 0;
  const startTime = Date.now();

  return new Transform({
    transform(chunk, encoding, callback) {
      totalSent += chunk.length;
      const elapsed = (Date.now() - startTime) / 1000;
      const expectedMin = bytesPerSecond * elapsed;
      const excess = totalSent - expectedMin;

      if (excess > bytesPerSecond * 0.5) {
        // We're ahead by more than 0.5s worth of data
        const delay = Math.ceil((excess / bytesPerSecond) * 1000);
        setTimeout(() => callback(null, chunk), Math.min(delay, 500));
      } else {
        callback(null, chunk);
      }
    }
  });
}

/**
 * GET /api/v1/resources/:id/download
 * Download a resource
 */
router.get('/:id/download', (req, res) => {
  // Auth check: support both header and query param token
  let userId = null;
  let userRole = null;
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token;
  const token = queryToken || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null);
  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      userId = decoded.userId;
      userRole = decoded.role;
    } catch {}
  }
  if (!userId) {
    return res.status(401).json({ code: 401, message: '未登录，请先登录', data: null });
  }
  req.user = { id: userId, role: userRole || 'student' };

  const id = parseInt(req.params.id, 10);
  const resource = Resource.findById(id);

  if (!resource) {
    return res.status(404).json({ code: 404, message: '资源不存在', data: null });
  }

  if (resource.status !== 'approved' && req.user.role !== 'admin') {
    return res.status(403).json({ code: 403, message: '资源暂不可下载', data: null });
  }

  const filePath = resource.file_path;
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ code: 404, message: '文件不存在，可能已被删除', data: null });
  }

  // Increment download count
  Resource.incrementDownloadCount(id);

  // Log download
  DownloadLog.create({
    resource_id: id,
    user_id: req.user.id,
    ip_address: req.ip,
  });

  // Send file with speed throttle (5MB/s per connection)
  const dlName = resource.title + '.' + (resource.file_type || 'pdf');
  const encodedName = encodeURIComponent(dlName);
  res.setHeader('Content-Disposition', `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);

  const stat = fs.statSync(filePath);
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Type', resource.mime_type || 'application/octet-stream');

  const readStream = fs.createReadStream(filePath);
  const throttle = createThrottle(600 * 1024); // 600KB/s
  readStream.pipe(throttle).pipe(res);
});

/**
 * DELETE /api/v1/resources/:id
 * Delete a resource
 */
router.delete('/:id', auth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const resource = Resource.findById(id);

  if (!resource) {
    return res.status(404).json({ code: 404, message: '资源不存在', data: null });
  }

  // Only owner or admin can delete
  if (req.user.role !== 'admin' && resource.uploader_id !== req.user.id) {
    return res.status(403).json({ code: 403, message: '无权删除此资源', data: null });
  }

  // Delete file from disk
  try {
    if (fs.existsSync(resource.file_path)) {
      fs.unlinkSync(resource.file_path);
    }
  } catch (err) {
    console.error('File delete error:', err);
  }

  Resource.delete(id);

  res.json({ code: 200, message: '删除成功', data: null });
});

/**
 * PUT /api/v1/resources/:id
 * Update resource metadata (owner or admin)
 */
router.put('/:id', auth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const resource = Resource.findById(id);

  if (!resource) {
    return res.status(404).json({ code: 404, message: '资源不存在', data: null });
  }

  // Only owner or admin can edit
  if (req.user.role !== 'admin' && resource.uploader_id !== req.user.id) {
    return res.status(403).json({ code: 403, message: '无权修改此资源', data: null });
  }

  // Only allow editing pending resources (or admin can edit any)
  if (resource.status !== 'pending' && req.user.role !== 'admin') {
    return res.status(400).json({ code: 400, message: '已审核资源不可修改', data: null });
  }

  const { title, description, category_id } = req.body;
  const updates = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (category_id !== undefined) updates.category_id = parseInt(category_id, 10);

  const updated = Resource.update(id, updates);
  res.json({ code: 200, message: '修改成功', data: updated });
});

module.exports = router;
