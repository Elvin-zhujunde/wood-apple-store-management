const express = require('express');
const { pool } = require('../db/pool');
const { ok, fail, wrap, genDocNo } = require('../utils/helpers');
const { auth } = require('../middlewares/auth');
const { generateForOrder } = require('../services/purchaseSuggestionService');

const router = express.Router();
router.use(auth);

// 列表
router.get(
  '/',
  wrap(async (req, res) => {
    const { status, priority, order_id, customer, material_name, page = 1, pageSize = 20 } = req.query;
    const where = [];
    const params = [];
    if (status) { where.push('ps.status = ?'); params.push(status); }
    if (priority) { where.push('ps.priority = ?'); params.push(priority); }
    if (order_id) { where.push('ps.order_id = ?'); params.push(order_id); }
    if (customer) { where.push('so.customer LIKE ?'); params.push(`%${customer}%`); }
    if (material_name) { where.push('m.name LIKE ?'); params.push(`%${material_name}%`); }
    const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const total = (
      await pool.query(`SELECT COUNT(*) c FROM purchase_suggestion ps JOIN materials m ON m.id = ps.material_id JOIN sales_orders so ON so.id = ps.order_id ${clause}`, params)
    )[0][0].c;
    const rows = (
      await pool.query(
        `SELECT ps.*, m.code, m.name, m.spec, m.unit, so.order_no, so.customer
           FROM purchase_suggestion ps
           JOIN materials m ON m.id = ps.material_id
           JOIN sales_orders so ON so.id = ps.order_id
          ${clause} ORDER BY ps.id DESC LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), (Number(page) - 1) * Number(pageSize)]
      )
    )[0];
    ok(res, { list: rows, total, page: Number(page), pageSize: Number(pageSize) });
  })
);

// 手动触发某订单的采购建议生成
router.post(
  '/generate',
  wrap(async (req, res) => {
    const { order_id } = req.body;
    if (!order_id) return fail(res, 'order_id 必填');
    const result = await generateForOrder(order_id, req.user.name);
    ok(res, result, '采购建议已生成');
  })
);

// 采纳建议 —— 生成一张"待到货"采购入库单，回填 inbound_id，建议转已采购
router.post(
  '/:id/adopt',
  wrap(async (req, res) => {
    const { supplier, unit_price, freight = 0, expected_arrival, handler, qty } = req.body;
    // 取建议
    const [rows] = await pool.query(
      `SELECT ps.*, m.code, m.name FROM purchase_suggestion ps
         JOIN materials m ON m.id = ps.material_id WHERE ps.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return fail(res, '建议不存在');
    const sug = rows[0];
    if (sug.status === '已采购') return fail(res, '该建议已采纳/已采购');
    if (!supplier || !unit_price || !handler)
      return fail(res, '厂家/进价/经手人 必填');

    const purchaseQty = qty || sug.suggest_qty;
    const purchase_date = new Date().toISOString().slice(0, 10);
    const inbound_no = await genDocNo('purchase_inbound', 'RK', 'inbound');

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // 1. 创建待到货采购入库单
      const [r] = await conn.query(
        `INSERT INTO purchase_inbound
          (inbound_no, material_id, supplier, qty, unit_price, freight,
           purchase_date, expected_arrival, handler, status)
         VALUES (?,?,?,?,?,?,?,?,?, '待到货')`,
        [inbound_no, sug.material_id, supplier, purchaseQty, unit_price, freight,
         purchase_date, expected_arrival || null, handler]
      );
      const inboundId = r.insertId;
      // 2. 回填建议 inbound_id + 转已采购
      await conn.query(
        'UPDATE purchase_suggestion SET inbound_id=?, status=? WHERE id=?',
        [inboundId, '已采购', sug.id]
      );
      await conn.commit();
      ok(res, { inbound_id: inboundId, inbound_no, suggest_id: sug.id, material: sug.name }, '已采纳，已生成采购入库单（待到货）');
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

// 更新状态
router.put(
  '/:id/status',
  wrap(async (req, res) => {
    const { status } = req.body;
    if (!['待采购', '已采购'].includes(status)) return fail(res, '状态非法');
    await pool.query('UPDATE purchase_suggestion SET status = ? WHERE id = ?', [status, req.params.id]);
    ok(res, null, '状态已更新');
  })
);

module.exports = router;
