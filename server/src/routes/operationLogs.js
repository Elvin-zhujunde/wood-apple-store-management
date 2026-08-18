const express = require('express');
const { pool } = require('../db/pool');
const { ok, fail, wrap } = require('../utils/helpers');
const { auth, requireRole } = require('../middlewares/auth');

const router = express.Router();
router.use(auth, requireRole('boss'));

// 日志列表（boss only）：筛选 user_name/module/method/status/dateRange + 分页
router.get(
  '/',
  wrap(async (req, res) => {
    const { user_name, module, method, status, start, end, page = 1, size = 50 } = req.query;
    const where = [];
    const params = [];
    if (user_name) { where.push('user_name LIKE ?'); params.push(`%${user_name}%`); }
    if (module) { where.push('module = ?'); params.push(module); }
    if (method) { where.push('method = ?'); params.push(method); }
    if (status) { where.push('status = ?'); params.push(status); }
    if (start) { where.push('created_at >= ?'); params.push(start + ' 00:00:00'); }
    if (end) { where.push('created_at <= ?'); params.push(end + ' 23:59:59'); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const p = Number(page) || 1;
    const s = Math.min(Number(size) || 50, 200);
    const offset = (p - 1) * s;
    const [rows] = await pool.query(
      `SELECT * FROM operation_logs ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, s, offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM operation_logs ${whereSql}`,
      params
    );
    ok(res, { list: rows, total, page: p, size: s });
  })
);

// 模块枚举（前端筛选用）
router.get(
  '/modules',
  wrap(async (req, res) => {
    const [rows] = await pool.query(
      'SELECT DISTINCT module FROM operation_logs WHERE module IS NOT NULL ORDER BY module'
    );
    ok(res, rows.map((r) => r.module));
  })
);

module.exports = router;
