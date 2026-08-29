const express = require('express');
const { pool } = require('../db/pool');
const { ok, fail, wrap, genDocNo } = require('../utils/helpers');
const { auth, requireRole } = require('../middlewares/auth');

const router = express.Router();
router.use(auth);

// 列表（分页+筛选）
router.get(
  '/',
  wrap(async (req, res) => {
    const { status, customer, order_no, keyword, door_bom_id, handler_sale, cut_status, ids, startDate, endDate, page = 1, pageSize = 20 } = req.query;
    const where = ['so.deleted_at IS NULL'];
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
    if (cut_status) {
      if (cut_status === '未下料') where.push('so.cut_status IS NULL');
      else if (cut_status === '已下料') where.push('so.cut_status IS NOT NULL');
    }
    if (ids) {
      // 标签打印等场景按指定订单 id 批量取（逗号分隔），与 cutting-list /:ids 同款
      const idArr = String(ids).split(',').map((s) => parseInt(s, 10)).filter((n) => !isNaN(n));
      if (idArr.length) {
        where.push(`so.id IN (${idArr.map(() => '?').join(',')})`);
        params.push(...idArr);
      }
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

// 锁孔常用联想：近期 N 条订单 lock_hole 去重（近期优先），供表单备选芯片
// 静态路径，须在 /:id 之前声明，否则被参数路由吞
router.get(
  '/lock-holes',
  wrap(async (req, res) => {
    const SAMPLE = 500;
    const [rows] = await pool.query(
      "SELECT lock_hole FROM sales_orders WHERE lock_hole IS NOT NULL AND lock_hole != '' ORDER BY id DESC LIMIT ?",
      [SAMPLE]
    );
    const seen = new Set();
    const list = [];
    for (const row of rows) {
      if (row.lock_hole && !seen.has(row.lock_hole)) {
        seen.add(row.lock_hole);
        list.push(row.lock_hole);
      }
    }
    ok(res, list);
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
       WHERE id IN (?) AND status IN ('新建','已发货','赊账中')`,
      [date, receipt_no, handler_finance, pay_method || null, ids]
    );
    const skipped = ids.length - r.affectedRows;
    ok(res, { success: r.affectedRows, skipped }, `批量收款完成：${r.affectedRows} 单成功${skipped ? `，${skipped} 单已收款已跳过` : ''}`);
  })
);

// 批量编辑：勾选若干单，统一改台账字段（经手人/业务员/安装师傅/客户类别/付款方式等）+ 可改状态
// 台账字段全改（所有选中单）；状态走状态机前向校验（只前向流转，已收款锁，回退跳过，不到已收款——已收款需金额配套走批量收款）
// 空串视为清空（写 NULL）；未勾选的字段不传不改动
router.put(
  '/batch/update',
  wrap(async (req, res) => {
    const { ids, fields } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return fail(res, '请选择订单');
    if (!fields || typeof fields !== 'object') return fail(res, '缺少更新字段');

    // 台账字段白名单（不含金额/数量/门型等订单核心，不含状态——状态单独守卫）
    const ALLOWED = [
      'handler_sale', 'salesperson', 'installer', 'customer_type',
      'handler_ship', 'handler_finance', 'pay_method', 'remark',
      'address', 'hardware', 'biz_fee', 'edge_band', 'frame_line',
    ];
    const sets = [];
    const vals = [];
    for (const k of ALLOWED) {
      if (fields[k] !== undefined) {
        sets.push(`${k}=?`);
        vals.push(fields[k] === '' ? null : fields[k]);
      }
    }

    // 状态前向校验（FIELD 函数比状态序号：新建<已发货<赊账中<已收款，只更新 current<target 的单）
    let statusResult = null;
    if (fields.status !== undefined) {
      const TARGET = ['新建', '已发货', '赊账中'];
      if (fields.status === '已收款') return fail(res, '批量改"已收款"请用「批量收款」按钮（需金额配套）');
      if (!TARGET.includes(fields.status)) return fail(res, '非法状态：' + fields.status);
      const [sr] = await pool.query(
        `UPDATE sales_orders SET status=?
          WHERE id IN (?)
            AND FIELD(status,'新建','已发货','赊账中','已收款') < FIELD(?,'新建','已发货','赊账中','已收款')`,
        [fields.status, ids, fields.status]
      );
      const skipped = ids.length - sr.affectedRows;
      statusResult = { success: sr.affectedRows, skipped };
    }

    // 台账字段：所有选中单全改（不受状态限制）
    let fieldResult = null;
    if (sets.length > 0) {
      const [fr] = await pool.query(`UPDATE sales_orders SET ${sets.join(', ')} WHERE id IN (?)`, [...vals, ids]);
      fieldResult = { success: fr.affectedRows };
    }

    if (!fieldResult && !statusResult) return fail(res, '未勾选任何字段');

    const msgs = [];
    if (fieldResult) msgs.push(`${fieldResult.success} 单台账字段已更新`);
    if (statusResult) msgs.push(`状态：${statusResult.success} 单前向流转${statusResult.skipped ? `，${statusResult.skipped} 单已为目标或更靠后，跳过` : ''}`);
    ok(res, { fieldResult, statusResult }, `批量编辑完成：${msgs.join('；')}`);
  })
);

// 全量备份导出 CSV（boss only，含已删订单，DB 原始列名，用于数据备份）
router.get(
  '/export-all',
  requireRole('boss'),
  wrap(async (req, res) => {
    // 列名取 INFORMATION_SCHEMA 保证顺序与表定义一致（空表也安全）
    const [cols] = await pool.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales_orders' ORDER BY ORDINAL_POSITION"
    );
    const headers = cols.map((c) => c.COLUMN_NAME);
    const [rows] = await pool.query('SELECT * FROM sales_orders ORDER BY id');
    const esc = (v) => {
      if (v == null) return '';
      const s = String(v);
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [headers.map(esc).join(',')];
    for (const row of rows) lines.push(headers.map((h) => esc(row[h])).join(','));
    // UTF-8 BOM 防中文乱码
    const csv = '﻿' + lines.join('\r\n');
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="orders-backup-${stamp}.csv"`);
    res.send(csv);
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
      // 标签相关字段（lock_hole/sub_customer）
      lock_hole, sub_customer,
    } = req.body;
    if (!customer || !door_bom_id || !color || !qty || !handler_sale || !order_date)
      return fail(res, '客户/门型/颜色/数量/经手人/下单日期 必填');

    const order_no = await genDocNo('sales_orders', 'SO', 'order');
    // 单价非必填(免费送可为0/空),后端兜底归一为数字(DB列NOT NULL,空落0)
    const total_amount = qty * (Number(unit_price) || 0);

    // R4(ARE-107)：删除"约定发货日"录入，expected_ship_date 不再接收（DB字段保留给历史数据）
    const [r] = await pool.query(
      `INSERT INTO sales_orders
        (order_no, customer, sub_customer, door_bom_id, color, qty, unit_price, total_amount,
         handler_sale, order_date, status,
         door_h, door_w, wall_thick, style, board,
         remark, edge_band, frame_line, customer_type, address,
         hardware, lock_hole)
       VALUES (?,?,?,?,?,?,?,?,?,?, '新建', ?,?,?,?,?,?,?,?,?,?, ?, ?)`,
      [order_no, customer, sub_customer || null, door_bom_id, color, qty, Number(unit_price) || 0, total_amount,
       handler_sale, order_date,
       door_h || null, door_w || null, wall_thick || null, style || null, board || null,
       remark || null, edge_band || null, frame_line || null, customer_type || null, address || null,
       null, lock_hole || null]
    );

    // ARE-108：采购建议改为安全库存驱动，接单不再触发（领料/入库时触发）
    ok(res, { id: r.insertId, order_no }, '接单成功');
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
      // 标签相关字段（lock_hole/sub_customer）
      lock_hole, sub_customer,
    } = req.body;

    // 日期归一：兼容 'YYYY-MM-DD' 与 ISO 'YYYY-MM-DDTHH:mm:ss.sssZ' 两种格式
    // （订单详情返回的日期是 ISO，回传时 MySQL DATE 列严格模式会拒绝）
    const normDate = (v) => {
      if (!v) return null;
      const s = String(v);
      return s.length >= 10 ? s.slice(0, 10) : s;
    };

    // 取当前订单（单调守卫用：已收款订单不可被普通编辑拖回状态/收款信息）
    const [cur] = await pool.query(
      'SELECT status, paid_amount, pay_date, receipt_no, handler_finance, pay_method FROM sales_orders WHERE id = ?',
      [req.params.id]
    );
    if (cur.length === 0) return fail(res, '订单不存在');
    const curRow = cur[0];

    // 状态自动流转（赊账中间态：部分付款=赊账中，足额=已收款）
    // pay_date+paid>=total → 已收款(已完成)；pay_date+0<paid<total → 赊账中；仅发货 → 已发货；否则新建
    const paid = (paid_amount !== undefined && paid_amount !== null) ? Number(paid_amount) : 0;
    const total = qty ? qty * (Number(unit_price) || 0) : 0;
    let derived = '新建';
    if (pay_date && paid > 0) {
      derived = paid >= total ? '已收款' : '赊账中';
    } else if (actual_ship_date && ship_no) {
      derived = '已发货';
    }

    // 单调守卫：已收款订单经普通编辑若被推导回非已收款（误改收款信息/清收款日等）→ 状态保持已收款，
    // 且收款相关字段（paid_amount/pay_date/receipt_no/handler_finance/pay_method）锁回 DB 原值，
    // 防止出现"status=已收款 但 paid<total"的自相矛盾脏数据。要回退须走显式反结 PUT /:id/reopen。
    const locked = curRow.status === '已收款' && derived !== '已收款';
    const status = locked ? '已收款' : derived;
    const finalPaidAmount = locked ? curRow.paid_amount : (paid_amount || null);
    const finalPayDate = locked ? curRow.pay_date : normDate(pay_date);
    const finalReceiptNo = locked ? curRow.receipt_no : (receipt_no || null);
    const finalHandlerFinance = locked ? curRow.handler_finance : (handler_finance || null);
    const finalPayMethod = locked ? curRow.pay_method : (pay_method || null);

    const total_amount = qty ? qty * (Number(unit_price) || 0) : undefined;

    await pool.query(
      `UPDATE sales_orders SET
        customer=?, sub_customer=?, door_bom_id=?, color=?, qty=?, unit_price=?, total_amount=?,
        actual_ship_date=?, ship_no=?, handler_ship=?,
        pay_date=?, receipt_no=?, handler_finance=?, paid_amount=?,
        door_h=?, door_w=?, wall_thick=?, style=?, board=?,
        remark=?, edge_band=?, frame_line=?,
        customer_type=?, address=?, hardware=?, pay_method=?,
        salesperson=?, installer=?, biz_fee=?, lock_hole=?,
        status=?
       WHERE id=?`,
      [customer, sub_customer || null, door_bom_id, color, qty, Number(unit_price) || 0, total_amount,
       normDate(actual_ship_date), ship_no || null, handler_ship || null,
       finalPayDate, finalReceiptNo, finalHandlerFinance, finalPaidAmount,
       door_h || null, door_w || null, wall_thick || null, style || null, board || null,
       remark || null, edge_band || null, frame_line || null,
       customer_type || null, address || null, hardware || null, finalPayMethod,
       salesperson || null, installer || null, biz_fee || null, lock_hole || null,
       status, req.params.id]
    );
    ok(res, { status }, locked ? '已完成订单收款信息已锁定，状态保持已收款（如需修正请反结）' : '更新成功');
  })
);

// 反结：已收款订单显式回退到赊账中（保留已付金额，回到可重新核对收款的状态）
// 仅已收款可反结；防误操作的状态回退统一收口到此显式入口，普通 PUT 不回退已收款
router.put(
  '/:id/reopen',
  wrap(async (req, res) => {
    const [cur] = await pool.query('SELECT status FROM sales_orders WHERE id = ?', [req.params.id]);
    if (cur.length === 0) return fail(res, '订单不存在');
    if (cur[0].status !== '已收款') return fail(res, '仅"已收款"订单可反结');
    await pool.query("UPDATE sales_orders SET status='赊账中' WHERE id = ?", [req.params.id]);
    ok(res, { status: '赊账中' }, '已反结，回到赊账中，可重新核对收款');
  })
);

// 软删除：标记 deleted_at，列表/统计排除。关联测量记录回待转单、采购建议解绑，防悬空引用。
// 软删不校验状态/FK(数据保留可恢复)，权限 boss+本人经手人(对齐 measure 删除模式)
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const [cur] = await pool.query('SELECT handler_sale, deleted_at FROM sales_orders WHERE id = ?', [req.params.id]);
    if (cur.length === 0) return fail(res, '订单不存在');
    if (cur[0].deleted_at) return fail(res, '订单已删除');
    if (req.user.role !== 'boss' && cur[0].handler_sale !== req.user.name)
      return fail(res, '只能删除本人经手的订单(或联系 boss)');
    await pool.query('UPDATE sales_orders SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
    // 解绑关联：转单的测量记录回待转单可重转；采购建议 order_id 回 NULL(历史BOM驱动遗留)
    await pool.query("UPDATE measure_records SET status='待转单', sales_order_id=NULL WHERE sales_order_id = ?", [req.params.id]);
    await pool.query('UPDATE purchase_suggestion SET order_id=NULL WHERE order_id = ?', [req.params.id]);
    ok(res, null, '删除成功');
  })
);

module.exports = router;
