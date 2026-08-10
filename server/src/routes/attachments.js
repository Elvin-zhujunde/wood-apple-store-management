const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { pool } = require('../db/pool');
const { ok, fail, wrap } = require('../utils/helpers');
const { auth } = require('../middlewares/auth');

const router = express.Router();
router.use(auth); // 上传/管理附件需登录；静态文件访问由 app.js 的 express.static 提供，无需登录

// 上传目录（按月份分子目录，避免单目录文件过多）
const UPLOAD_ROOT = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

// multer 配置：限图片类型 + 5MB + 按月份目录 + 时间戳重命名
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const d = new Date();
    const monthDir = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const dir = path.join(UPLOAD_ROOT, monthDir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const d = new Date();
    const ts = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
    const rand = Math.random().toString(36).slice(2, 8);
    // 取原扩展名，统一小写
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
    cb(null, `${ts}-${rand}${ext}`);
  },
});

// 类型白名单：仅图片
const fileFilter = (req, file, cb) => {
  const allow = /image\/(jpeg|png|webp|gif)/;
  if (allow.test(file.mimetype)) cb(null, true);
  else cb(new Error('仅支持 jpg/png/webp/gif 图片'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// 上传单图（附带 entity_type + entity_id 关联，可不传先上传后绑定）
router.post(
  '/upload',
  upload.single('file'),
  wrap(async (req, res) => {
    if (!req.file) return fail(res, '未收到文件或类型不符');
    const { entity_type = '', entity_id = '' } = req.body;
    // 相对路径（DB只存这个，前端拼前缀）
    const relPath = 'uploads/' + path.relative(UPLOAD_ROOT, req.file.path).split(path.sep).join('/');
    const [r] = await pool.query(
      `INSERT INTO attachments (entity_type, entity_id, file_path, file_name, file_size, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        entity_type || '',
        entity_id ? Number(entity_id) : 0,
        relPath,
        req.file.originalname,
        req.file.size,
        req.user.name,
      ]
    );
    ok(res, { id: r.insertId, file_path: relPath, file_name: req.file.originalname }, '上传成功');
  })
);

// 按业务实体查附件列表
router.get(
  '/',
  wrap(async (req, res) => {
    const { entity_type, entity_id } = req.query;
    if (!entity_type || !entity_id) return fail(res, '缺少 entity_type / entity_id');
    const [rows] = await pool.query(
      `SELECT * FROM attachments WHERE entity_type = ? AND entity_id = ? ORDER BY id DESC`,
      [entity_type, Number(entity_id)]
    );
    ok(res, rows);
  })
);

// 删除附件（同时删物理文件）
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const [rows] = await pool.query('SELECT file_path FROM attachments WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return fail(res, '附件不存在');
    const filePath = rows[0].file_path;
    const abs = path.join(UPLOAD_ROOT, path.relative('uploads', filePath));
    await pool.query('DELETE FROM attachments WHERE id = ?', [req.params.id]);
    // 删物理文件（失败不阻塞，记录日志）
    fs.unlink(abs, (e) => {
      if (e) console.error('删除物理文件失败:', abs, e.message);
    });
    ok(res, null, '删除成功');
  })
);

module.exports = router;
