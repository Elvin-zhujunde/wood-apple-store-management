const express = require('express');
const { pool } = require('../db/pool');
const { ok, fail, wrap, genDocNo } = require('../utils/helpers');
const { auth } = require('../middlewares/auth');
const { generateForOrder } = require('../services/purchaseSuggestionService');

const router = express.Router();
router.use(auth);

// 列表（分页+筛选）
router.get(
  '/',
  wrap(async (req, res) => {
    const { status, customer, order_no, keyword, door_bom_id, handler_sale, startDate, endDate, page = 1, pageSize = 20 } = req.query;
    const where = [];
    const params = [];
    if (status) {
      where.push('so.status = ?');
      params.push(status);
    }
    if (customer) {
      where.push('so.customer LIKE ?');
      params.push(`%${customer}%`);
    }
    if (order_no) {
      where.push('so.order_no LIKE ?');
      params.push(`%${order_no}%`);
    }
    if (keyword) {
      where.push('(so.order_no LIKE ? OR so.customer LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (door_bom_id) {
      where.push('so.door_bom_id = ?');
      params.push(Number(door_bom_id));
    }
    if (handler_sale) {
      where.push('so.handler_sale LIKE ?');
      params.push(`%${handler_sale}%`);
    }
    if (startDate) {
      where.push('so.order_date >= ?');
      params.push(startDate);
    }
    if (endDate) {
      where.push('so.order_date <= ?');
      params.push(endDate);
    }
    const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const total = (
      await pool.query(`SELECT COUNT(*) c FROM sales_orders so ${clause}`, params)
    )[0][0].c;
    const rows = (
      await pool.query(
        `SELECT so.*, b.name AS door_bom_name, b.standard_size
           FROM sales_orders so LEFT JOIN door_bom b ON b.id = so.door_bom_id
          ${clause} ORDER BY so.id DESC LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), (Number(page) - 1) * Number(pageSize)]
      )
    )[0];
    ok(res, { list: rows, total, page: Number(page), pageSize: Number(pageSize) });
  })
);

// 详情
router.get(
  '/:id',
  wrap(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT so.*, b.name AS door_bom_name, b.standard_size, b.code AS door_bom_code
         FROM sales_orders so LEFT JOIN door_bom b ON b.id = so.door_bom_id
        WHERE so.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return fail(res, '订单不存在');
    ok(res, rows[0]);
  })
);

// 新增（接单）—— 生成单据号、算总金额、触发采购建议
router.post(
  '/',
  wrap(async (req, res) => {
    const {
      customer, door_bom_id, color, qty, unit_price,
      handler_sale, order_date, expected_ship_date,
    } = req.body;
    if (!customer || !door_bom_id || !color || !qty || !unit_price || !handler_sale || !order_date)
      return fail(res, '客户/门型/颜色/数量/单价/经手人/下单日期 必填');

    const order_no = await genDocNo('sales_orders', 'SO', 'order');
    const total_amount = qty * Number(unit_price);

    const [r] = await pool.query(
      `INSERT INTO sales_orders
        (order_no, customer, door_bom_id, color, qty, unit_price, total_amount,
         handler_sale, order_date, expected_ship_date, status)
       VALUES (?,?,?,?,?,?,?,?,?,?, '新建')`,
      [order_no, customer, door_bom_id, color, qty, unit_price, total_amount,
       handler_sale, order_date, expected_ship_date || null]
    );

    // 触发采购建议生成（核心）
    let suggestion = null;
    try {
      suggestion = await generateForOrder(r.insertId, req.user.name);
    } catch (e) {
      console.error('采购建议生成失败:', e.message);
    }

    ok(res, { id: r.insertId, order_no, suggestion }, '接单成功');
  })
);

// 编辑（含发货回填、收款回填），自动状态流转
router.put(
  '/:id',
  wrap(async (req, res) => {
    const {
      customer, door_bom_id, color, qty, unit_price,
      expected_ship_date,
      actual_ship_date, ship_no, handler_ship,
      pay_date, receipt_no, handler_finance,
    } = req.body;

    // 日期归一：兼容 'YYYY-MM-DD' 与 ISO 'YYYY-MM-DDTHH:mm:ss.sssZ' 两种格式
    // （订单详情返回的日期是 ISO，回传时 MySQL DATE 列严格模式会拒绝）
    const normDate = (v) => {
      if (!v) return null;
      const s = String(v);
      return s.length >= 10 ? s.slice(0, 10) : s;
    };

    // 状态自动流转
    let status = '新建';
    if (pay_date && receipt_no) status = '已收款';
    else if (actual_ship_date && ship_no) status = '已发货';

    const total_amount = qty ? qty * Number(unit_price) : undefined;

    await pool.query(
      `UPDATE sales_orders SET
        customer=?, door_bom_id=?, color=?, qty=?, unit_price=?, total_amount=?,
        expected_ship_date=?,
        actual_ship_date=?, ship_no=?, handler_ship=?,
        pay_date=?, receipt_no=?, handler_finance=?,
        status=?
       WHERE id=?`,
      [customer, door_bom_id, color, qty, unit_price, total_amount,
       normDate(expected_ship_date),
       normDate(actual_ship_date), ship_no || null, handler_ship || null,
       normDate(pay_date), receipt_no || null, handler_finance || null,
       status, req.params.id]
    );
    ok(res, { status }, '更新成功');
  })
);

module.exports = router;
