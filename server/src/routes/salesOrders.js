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

// 批量发货：勾选的"新建"订单统一填发货日/经手人/发货单号 → 批量转"已发货"
// 同批次共享一个发货单号（适合一批货一起发的场景；需不同单号请逐条操作）
router.put(
  '/batch/ship',
  wrap(async (req, res) => {
    const { ids, actual_ship_date, ship_no, handler_ship } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return fail(res, '请选择订单');
    if (!actual_ship_date || !ship_no || !handler_ship) return fail(res, '发货日期/发货单号/发货经手人 必填');
    const date = String(actual_ship_date).slice(0, 10);
    const [r] = await pool.query(
      `UPDATE sales_orders
        SET actual_ship_date=?, ship_no=?, handler_ship=?, status='已发货'
       WHERE id IN (?) AND status='新建'`,
      [date, ship_no, handler_ship, ids]
    );
    const skipped = ids.length - r.affectedRows;
    ok(res, { success: r.affectedRows, skipped }, `批量发货完成：${r.affectedRows} 单成功${skipped ? `，${skipped} 单非"新建"已跳过` : ''}`);
  })
);

// 批量收款：勾选的"新建/已发货"订单统一填收款日/收据号/经手人 → 批量转"已收款"
// 兼容预付款(新建直接收款)与发货后收款(已发货)两种场景
// 决策2：批量默认全额结清（paid_amount=total_amount）；部分付款需逐单操作（多单金额不同无法统一）
router.put(
  '/batch/pay',
  wrap(async (req, res) => {
    const { ids, pay_date, receipt_no, handler_finance, pay_method } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return fail(res, '请选择订单');
    if (!pay_date || !receipt_no || !handler_finance) return fail(res, '收款日期/收据单号/收款经手人 必填');
    const date = String(pay_date).slice(0, 10);
    // paid_amount=total_amount：批量默认全额结清（每单金额不同，用子查询取各自应收额）
    const [r] = await pool.query(
      `UPDATE sales_orders
        SET pay_date=?, receipt_no=?, handler_finance=?, pay_method=?, paid_amount=total_amount, status='已收款'
       WHERE id IN (?) AND status IN ('新建','已发货')`,
      [date, receipt_no, handler_finance, pay_method || null, ids]
    );
    const skipped = ids.length - r.affectedRows;
    ok(res, { success: r.affectedRows, skipped }, `批量收款完成：${r.affectedRows} 单成功${skipped ? `，${skipped} 单已收款已跳过` : ''}`);
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
      handler_sale, order_date,
      // 台账对齐字段（ARE-105，开单时录入）
      door_h, door_w, wall_thick, style, board,
      remark, edge_band, frame_line, customer_type, address,
    } = req.body;
    if (!customer || !door_bom_id || !color || !qty || !unit_price || !handler_sale || !order_date)
      return fail(res, '客户/门型/颜色/数量/单价/经手人/下单日期 必填');

    const order_no = await genDocNo('sales_orders', 'SO', 'order');
    const total_amount = qty * Number(unit_price);

    // R4(ARE-107)：删除"约定发货日"录入，expected_ship_date 不再接收（DB字段保留给历史数据）
    const [r] = await pool.query(
      `INSERT INTO sales_orders
        (order_no, customer, door_bom_id, color, qty, unit_price, total_amount,
         handler_sale, order_date, status,
         door_h, door_w, wall_thick, style, board,
         remark, edge_band, frame_line, customer_type, address)
       VALUES (?,?,?,?,?,?,?,?,?, '新建', ?,?,?,?,?,?,?,?,?,?)`,
      [order_no, customer, door_bom_id, color, qty, unit_price, total_amount,
       handler_sale, order_date,
       door_h || null, door_w || null, wall_thick || null, style || null, board || null,
       remark || null, edge_band || null, frame_line || null, customer_type || null, address || null]
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
      actual_ship_date, ship_no, handler_ship,
      pay_date, receipt_no, handler_finance,
      // 台账对齐字段（ARE-105）
      door_h, door_w, wall_thick, style, board,
      remark, paid_amount, edge_band, frame_line,
      customer_type, address, hardware, pay_method,
      salesperson, installer, biz_fee,
    } = req.body;

    // 日期归一：兼容 'YYYY-MM-DD' 与 ISO 'YYYY-MM-DDTHH:mm:ss.sssZ' 两种格式
    // （订单详情返回的日期是 ISO，回传时 MySQL DATE 列严格模式会拒绝）
    const normDate = (v) => {
      if (!v) return null;
      const s = String(v);
      return s.length >= 10 ? s.slice(0, 10) : s;
    };

    // 状态自动流转（决策2：支持部分付款——paid_amount>0 即视为有收款记录）
    let status = '新建';
    if (pay_date && (paid_amount !== undefined && paid_amount !== null && Number(paid_amount) > 0)) {
      status = '已收款';
    } else if (actual_ship_date && ship_no) {
      status = '已发货';
    }

    const total_amount = qty ? qty * Number(unit_price) : undefined;

    await pool.query(
      `UPDATE sales_orders SET
        customer=?, door_bom_id=?, color=?, qty=?, unit_price=?, total_amount=?,
        actual_ship_date=?, ship_no=?, handler_ship=?,
        pay_date=?, receipt_no=?, handler_finance=?, paid_amount=?,
        door_h=?, door_w=?, wall_thick=?, style=?, board=?,
        remark=?, edge_band=?, frame_line=?,
        customer_type=?, address=?, hardware=?, pay_method=?,
        salesperson=?, installer=?, biz_fee=?,
        status=?
       WHERE id=?`,
      [customer, door_bom_id, color, qty, unit_price, total_amount,
       normDate(actual_ship_date), ship_no || null, handler_ship || null,
       normDate(pay_date), receipt_no || null, handler_finance || null, paid_amount || null,
       door_h || null, door_w || null, wall_thick || null, style || null, board || null,
       remark || null, edge_band || null, frame_line || null,
       customer_type || null, address || null, hardware || null, pay_method || null,
       salesperson || null, installer || null, biz_fee || null,
       status, req.params.id]
    );
    ok(res, { status }, '更新成功');
  })
);

module.exports = router;
