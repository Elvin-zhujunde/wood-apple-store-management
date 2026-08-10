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

// 物料库存详情（含变动流水）
router.get(
  '/:id',
  wrap(async (req, res) => {
    const [mats] = await pool.query('SELECT * FROM materials WHERE id = ?', [req.params.id]);
    if (mats.length === 0) return fail(res, '物料不存在');
    const [logs] = await pool.query(
      'SELECT * FROM inventory_log WHERE material_id = ? ORDER BY id DESC LIMIT 100',
      [req.params.id]
    );
    ok(res, { ...mats[0], logs });
  })
);

module.exports = router;
