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
        `SELECT mr.*, m.name AS material_name, m.code, m.spec, m.unit, m.unit_price,
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
      `SELECT mr.*, m.name AS material_name, m.code, m.spec, m.unit, m.unit_price, so.order_no
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

// 批量领料：一个物料总量分给多笔订单（一次弹窗提交 N 条领料记录）
// 单事务：校验总量≤库存→扣总量一次库存→写N条material_requisition(各自req_no)→1条汇总inventory_log流水→批末安全库存检查
// items:[{order_id,qty}] 共享 material_id/req_date/handler
router.post(
  '/batch',
  wrap(async (req, res) => {
    const { material_id, req_date, handler, items } = req.body;
    if (!material_id || !req_date || !handler) return fail(res, '物料/领用日期/经手人 必填');
    if (!Array.isArray(items) || items.length === 0) return fail(res, '缺少领料明细');
    for (const it of items) {
      if (!it.order_id || !Number(it.qty) || Number(it.qty) <= 0)
        return fail(res, '每条明细需含订单id与正数数量');
    }
    const totalQty = items.reduce((s, it) => s + Number(it.qty), 0);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [mats] = await conn.query('SELECT stock_qty, name FROM materials WHERE id = ?', [material_id]);
      if (mats.length === 0) { await conn.rollback(); return fail(res, '物料不存在'); }
      if (Number(mats[0].stock_qty) < totalQty) {
        await conn.rollback();
        return fail(res, `库存不足，当前剩余 ${mats[0].stock_qty}，需 ${totalQty}`);
      }
      // 校验订单存在
      const orderIds = items.map((it) => Number(it.order_id));
      const [ordRows] = await conn.query(
        `SELECT id FROM sales_orders WHERE id IN (${orderIds.map(() => '?').join(',')})`,
        orderIds
      );
      if (ordRows.length !== orderIds.length) {
        await conn.rollback();
        const found = new Set(ordRows.map((r) => r.id));
        const missing = orderIds.filter((id) => !found.has(id));
        return fail(res, `订单不存在：${missing.join(',')}`);
      }

      const results = [];
      const reqNos = [];
      for (const it of items) {
        const req_no = await genDocNo('material_requisition', 'LL', 'req', conn);
        const [r] = await conn.query(
          `INSERT INTO material_requisition (req_no, order_id, material_id, qty, req_date, handler)
           VALUES (?,?,?,?,?,?)`,
          [req_no, Number(it.order_id), material_id, Number(it.qty), req_date, handler]
        );
        results.push({ order_id: Number(it.order_id), req_no, qty: Number(it.qty), ok: true });
        reqNos.push(req_no);
      }
      // 一次扣总量库存（减少并发冲突，优于逐条减）
      await conn.query('UPDATE materials SET stock_qty = stock_qty - ? WHERE id = ?', [totalQty, material_id]);
      // 1 条汇总流水（明细已在 material_requisition 留痕，流水不膨胀）
      const summaryRef = reqNos[0] + (reqNos.length > 1 ? ` 等${reqNos.length}单` : '');
      await conn.query(
        'INSERT INTO inventory_log (material_id, change_type, qty, ref_no, operator) VALUES (?, ?, ?, ?, ?)',
        [material_id, 'out', totalQty, summaryRef, req.user.name]
      );
      await conn.commit();

      // 批末安全库存检查（事务外，失败不影响领料）
      let suggestion = null;
      try {
        suggestion = await checkSafetyStock(material_id, req.user.name);
      } catch (e) {
        console.error('安全库存检查失败:', e.message);
      }
      const msg = suggestion && suggestion.action === 'created'
        ? `批量领料完成：${results.length} 单，库存已减少；${suggestion.name} 库存 ${suggestion.stock_qty} ≤ 安全库存 ${suggestion.safety_stock}，已生成采购建议`
        : `批量领料完成：${results.length} 单，库存已减少`;
      ok(res, { results, success: results.length, total_qty: totalQty, suggestion }, msg);
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

module.exports = router;
