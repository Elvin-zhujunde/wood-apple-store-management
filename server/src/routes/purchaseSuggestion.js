const express = require('express');
const { pool } = require('../db/pool');
const { ok, fail, wrap } = require('../utils/helpers');
const { auth } = require('../middlewares/auth');
const { generateForOrder } = require('../services/purchaseSuggestionService');

const router = express.Router();
router.use(auth);

// 列表
router.get(
  '/',
  wrap(async (req, res) => {
    const { status, priority, order_id, page = 1, pageSize = 20 } = req.query;
    const where = [];
    const params = [];
    if (status) { where.push('ps.status = ?'); params.push(status); }
    if (priority) { where.push('ps.priority = ?'); params.push(priority); }
    if (order_id) { where.push('ps.order_id = ?'); params.push(order_id); }
    const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const total = (
      await pool.query(`SELECT COUNT(*) c FROM purchase_suggestion ps ${clause}`, params)
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
