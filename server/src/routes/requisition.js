const express = require('express');
const { pool } = require('../db/pool');
const { ok, fail, wrap, genDocNo } = require('../utils/helpers');
const { auth } = require('../middlewares/auth');
const { checkSafetyStock } = require('../services/purchaseSuggestionService');

const router = express.Router();
router.use(auth);

// 列表
router.get(
  '/',
  wrap(async (req, res) => {
    const { order_id, material_id, order_no, handler, startDate, endDate, page = 1, pageSize = 20 } = req.query;
    const where = [];
    const params = [];
    if (order_id) { where.push('mr.order_id = ?'); params.push(order_id); }
    if (material_id) { where.push('mr.material_id = ?'); params.push(material_id); }
    if (order_no) { where.push('so.order_no LIKE ?'); params.push(`%${order_no}%`); }
    if (handler) { where.push('mr.handler LIKE ?'); params.push(`%${handler}%`); }
    if (startDate) { where.push('mr.req_date >= ?'); params.push(startDate); }
    if (endDate) { where.push('mr.req_date <= ?'); params.push(endDate); }
    const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const total = (await pool.query(`SELECT COUNT(*) c FROM material_requisition mr JOIN sales_orders so ON so.id = mr.order_id ${clause}`, params))[0][0].c;
    const rows = (
      await pool.query(
        `SELECT mr.*, m.name AS material_name, m.code, m.spec, m.unit,
                so.order_no, so.customer
           FROM material_requisition mr
           JOIN materials m ON m.id = mr.material_id
           JOIN sales_orders so ON so.id = mr.order_id
          ${clause} ORDER BY mr.id DESC LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), (Number(page) - 1) * Number(pageSize)]
      )
    )[0];
    ok(res, { list: rows, total, page: Number(page), pageSize: Number(pageSize) });
  })
);

// 新增 —— 库存 -= 领用数量（含库存不足校验），写流水
router.post(
  '/',
  wrap(async (req, res) => {
    const { order_id, material_id, qty, req_date, handler } = req.body;
    if (!order_id || !material_id || !qty || !req_date || !handler)
      return fail(res, '关联订单/物料/数量/领用日期/经手人 必填');

    const req_no = await genDocNo('material_requisition', 'LL', 'req');
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [mats] = await conn.query('SELECT stock_qty, name FROM materials WHERE id = ?', [material_id]);
      if (mats.length === 0) { await conn.rollback(); return fail(res, '物料不存在'); }
      if (Number(mats[0].stock_qty) < Number(qty)) {
        await conn.rollback();
        return fail(res, `库存不足，当前剩余 ${mats[0].stock_qty}`);
      }
      const [r] = await conn.query(
        `INSERT INTO material_requisition (req_no, order_id, material_id, qty, req_date, handler)
         VALUES (?,?,?,?,?,?)`,
        [req_no, order_id, material_id, qty, req_date, handler]
      );
      await conn.query('UPDATE materials SET stock_qty = stock_qty - ? WHERE id = ?', [qty, material_id]);
      await conn.query(
        'INSERT INTO inventory_log (material_id, change_type, qty, ref_no, operator) VALUES (?, ?, ?, ?, ?)',
        [material_id, 'out', qty, req_no, req.user.name]
      );
      await conn.commit();
      // ARE-108：领料扣库存后检查安全库存，可能触发采购建议
      let suggestion = null;
      try {
        suggestion = await checkSafetyStock(material_id, req.user.name);
      } catch (e) {
        console.error('安全库存检查失败:', e.message);
      }
      const msg = suggestion && suggestion.action === 'created'
        ? `领料成功，库存已减少；${suggestion.name} 库存 ${suggestion.stock_qty} ≤ 安全库存 ${suggestion.safety_stock}，已生成采购建议`
        : '领料成功，库存已减少';
      ok(res, { id: r.insertId, req_no, suggestion }, msg);
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

// 详情
router.get(
  '/:id',
  wrap(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT mr.*, m.name AS material_name, m.code, m.spec, m.unit, so.order_no
         FROM material_requisition mr
         JOIN materials m ON m.id = mr.material_id
         JOIN sales_orders so ON so.id = mr.order_id
        WHERE mr.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return fail(res, '领料单不存在');
    ok(res, rows[0]);
  })
);

module.exports = router;
