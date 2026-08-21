const express = require('express');
const { pool } = require('../db/pool');
const { ok, wrap } = require('../utils/helpers');
const { auth } = require('../middlewares/auth');

const router = express.Router();
router.use(auth);

// 工作台看板聚合：一次返回所有指标卡 + 图表数据
router.get(
  '/',
  wrap(async (req, res) => {
    // --- 指标卡 ---
    // 销售额总计(应收)、已收款总计、欠款总计
    const [money] = await pool.query(
      `SELECT
         COALESCE(SUM(total_amount),0) AS total_receivable,
         COALESCE(SUM(paid_amount),0)  AS total_received,
         COALESCE(SUM(total_amount - paid_amount),0) AS total_unpaid
       FROM sales_orders WHERE deleted_at IS NULL`
    );
    // 本月销售额(按 order_date)
    const [monthMoney] = await pool.query(
      `SELECT COALESCE(SUM(total_amount),0) AS month_sales
       FROM sales_orders
       WHERE deleted_at IS NULL AND order_date >= DATE_FORMAT(DATE_SUB(NOW(),INTERVAL 0 MONTH),'%Y-%m-01')`
    );
    // 待发货金额、待收款金额（待收款含 已发货 + 赊账中：都未足额结清）
    const [pendingMoney] = await pool.query(
      `SELECT status,
              COALESCE(SUM(total_amount),0) AS amount,
              COALESCE(SUM(total_amount - paid_amount),0) AS unpaid
         FROM sales_orders
        WHERE deleted_at IS NULL AND status IN ('新建','已发货','赊账中')
        GROUP BY status`
    );
    let pendingShipAmount = 0, pendingPayAmount = 0;
    for (const r of pendingMoney) {
      if (r.status === '新建') pendingShipAmount = Number(r.amount);
      if (r.status === '已发货' || r.status === '赊账中') pendingPayAmount += Number(r.unpaid);
    }
    // 订单总数、待发货数、待收款数
    const [orderStat] = await pool.query(
      `SELECT status, COUNT(*) c FROM sales_orders WHERE deleted_at IS NULL GROUP BY status`
    );

    // --- 图表1：近6个月销售额趋势（按 order_date 月份）---
    const [trend] = await pool.query(
      `SELECT DATE_FORMAT(order_date,'%Y-%m') AS ym, COALESCE(SUM(total_amount),0) AS sales, COUNT(*) AS cnt
         FROM sales_orders
        WHERE deleted_at IS NULL AND order_date >= DATE_FORMAT(DATE_SUB(NOW(),INTERVAL 5 MONTH),'%Y-%m-01')
        GROUP BY ym ORDER BY ym`
    );

    // --- 图表2：订单状态分布 ---
    const statusMap = { '新建': 0, '已发货': 0, '赊账中': 0, '已收款': 0 };
    for (const r of orderStat) statusMap[r.status] = r.c;

    // --- 图表3：库存状态分布（同 inventory.js 口径）---
    const [mats] = await pool.query('SELECT stock_qty, safety_stock FROM materials');
    let sufficient = 0, low = 0, critical = 0;
    for (const m of mats) {
      const stock = Number(m.stock_qty), safety = Number(m.safety_stock);
      if (safety > 0) {
        if (stock <= safety * 0.5) critical++;
        else if (stock <= safety) low++;
        else sufficient++;
      } else if (stock <= 0) critical++;
      else sufficient++;
    }

    // --- 待办清单(复用现有各模块 list 接口逻辑,这里也聚合一份避免前端再发请求) ---
    const [urgentSug] = await pool.query(
      `SELECT ps.id, m.name, m.code, m.stock_qty, m.safety_stock, m.unit
         FROM purchase_suggestion ps JOIN materials m ON m.id = ps.material_id
        WHERE ps.status = '待采购' ORDER BY ps.id DESC LIMIT 5`
    );
    const [pendingInbound] = await pool.query(
      `SELECT pi.id, pi.inbound_no, pi.supplier, pi.qty, m.name AS material_name
         FROM purchase_inbound pi LEFT JOIN materials m ON m.id = pi.material_id
        WHERE pi.status = '待到货' ORDER BY pi.id DESC LIMIT 5`
    );
    const [pendingShip] = await pool.query(
      `SELECT o.id, o.order_no, o.customer, o.qty, o.order_date, d.name AS door_bom_name
         FROM sales_orders o LEFT JOIN door_bom d ON d.id = o.door_bom_id
        WHERE o.deleted_at IS NULL AND o.status = '新建' ORDER BY o.id DESC LIMIT 5`
    );
    const [pendingPay] = await pool.query(
      `SELECT id, order_no, customer, total_amount, paid_amount, actual_ship_date, pay_date, status
         FROM sales_orders WHERE deleted_at IS NULL AND status IN ('已发货','赊账中') ORDER BY id DESC LIMIT 5`
    );

    ok(res, {
      metrics: {
        totalReceivable: Number(money[0].total_receivable),
        totalReceived: Number(money[0].total_received),
        totalUnpaid: Number(money[0].total_unpaid),
        monthSales: Number(monthMoney[0].month_sales),
        pendingShipAmount,
        pendingPayAmount,
        orderCount: Object.values(statusMap).reduce((a, b) => a + b, 0),
        pendingShipCount: statusMap['新建'],
        pendingPayCount: statusMap['已发货'] + statusMap['赊账中'],
        shortageCount: low + critical,
      },
      salesTrend: trend.map((t) => ({ month: t.ym, sales: Number(t.sales), count: t.cnt })),
      orderStatus: [
        { name: '待发货(新建)', value: statusMap['新建'] },
        { name: '已发货待收款', value: statusMap['已发货'] },
        { name: '赊账中', value: statusMap['赊账中'] },
        { name: '已收款', value: statusMap['已收款'] },
      ],
      inventoryStatus: [
        { name: '充足', value: sufficient },
        { name: '不足', value: low },
        { name: '严重缺货', value: critical },
      ],
      todo: { urgentSug, pendingInbound, pendingShip, pendingPay },
    });
  })
);

module.exports = router;
