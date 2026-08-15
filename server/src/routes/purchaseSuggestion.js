const express = require('express');
const { pool } = require('../db/pool');
const { ok, fail, wrap, genDocNo } = require('../utils/helpers');
const { auth } = require('../middlewares/auth');
const { scanAllLowStock } = require('../services/purchaseSuggestionService');

const router = express.Router();
router.use(auth);

// 列表（ARE-108：安全库存驱动，order_id 可空，LEFT JOIN 订单；带出当前库存/安全库存）
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
      await pool.query(`SELECT COUNT(*) c FROM purchase_suggestion ps JOIN materials m ON m.id = ps.material_id LEFT JOIN sales_orders so ON so.id = ps.order_id ${clause}`, params)
    )[0][0].c;
    const rows = (
      await pool.query(
        `SELECT ps.*, m.code, m.name, m.spec, m.unit, m.stock_qty, m.safety_stock,
                so.order_no, so.customer
           FROM purchase_suggestion ps
           JOIN materials m ON m.id = ps.material_id
           LEFT JOIN sales_orders so ON so.id = ps.order_id
          ${clause} ORDER BY ps.id DESC LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), (Number(page) - 1) * Number(pageSize)]
      )
    )[0];
    ok(res, { list: rows, total, page: Number(page), pageSize: Number(pageSize) });
  })
);

// 手动全量扫描低库存物料生成采购建议（ARE-108：安全库存驱动，替代原按订单生成）
router.post(
  '/generate',
  wrap(async (req, res) => {
    const result = await scanAllLowStock(req.user.name);
    ok(res, result, `扫描完成：新增 ${result.created} 条建议${result.cleared ? `，消除 ${result.cleared} 条已满足建议` : ''}`);
  })
);

// 采纳建议 —— 生成一张"待到货"采购入库单，回填 inbound_id，建议转已采购
// ARE-108：建议数量不算(suggest_qty=0)，采购数量由用户必填
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
    if (!qty || Number(qty) <= 0) return fail(res, '采购数量必填（系统不再自动算建议量）');

    const purchaseQty = qty;
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
