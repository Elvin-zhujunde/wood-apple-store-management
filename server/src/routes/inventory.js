const express = require('express');
const { pool } = require('../db/pool');
const { ok, fail, wrap } = require('../utils/helpers');
const { auth } = require('../middlewares/auth');

const router = express.Router();
router.use(auth);

// 实时库存查询（含状态自动判断）
router.get(
  '/',
  wrap(async (req, res) => {
    const { category, keyword } = req.query;
    const where = [];
    const params = [];
    if (category) { where.push('category = ?'); params.push(category); }
    if (keyword) { where.push('(name LIKE ? OR code LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }
    const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const [rows] = await pool.query(
      `SELECT id, code, name, category, spec, unit, stock_qty, safety_stock FROM materials ${clause} ORDER BY id`,
      params
    );
    const list = rows.map((m) => {
      const stock = Number(m.stock_qty);
      const safety = Number(m.safety_stock);
      let status = '充足';
      if (safety > 0) {
        if (stock <= safety * 0.5) status = '严重缺货';
        else if (stock <= safety) status = '不足';
      } else if (stock <= 0) status = '严重缺货';
      return { ...m, status };
    });
    ok(res, list);
  })
);

// 物料库存详情（含变动流水，支持检索+分页）
router.get(
  '/:id',
  wrap(async (req, res) => {
    const { change_type, ref_no, startDate, endDate, page = 1, pageSize = 20 } = req.query;
    const [mats] = await pool.query('SELECT * FROM materials WHERE id = ?', [req.params.id]);
    if (mats.length === 0) return fail(res, '物料不存在');
    const where = ['material_id = ?'];
    const params = [req.params.id];
    if (change_type) { where.push('change_type = ?'); params.push(change_type); }
    if (ref_no) { where.push('ref_no LIKE ?'); params.push(`%${ref_no}%`); }
    if (startDate) { where.push('created_at >= ?'); params.push(startDate); }
    if (endDate) { where.push('created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(endDate); }
    const clause = 'WHERE ' + where.join(' AND ');
    const total = (await pool.query(`SELECT COUNT(*) c FROM inventory_log ${clause}`, params))[0][0].c;
    const [logs] = await pool.query(
      `SELECT * FROM inventory_log ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, Number(pageSize), (Number(page) - 1) * Number(pageSize)]
    );
    ok(res, { ...mats[0], logs, log_total: total, page: Number(page), pageSize: Number(pageSize) });
  })
);

module.exports = router;
