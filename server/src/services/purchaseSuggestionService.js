// 采购建议生成服务（系统核心算法）
// 触发：销售订单保存时调用 generateForOrder(orderId)
const { pool } = require('../db/pool');

/**
 * 为某笔销售订单按 BOM 拆解物料需求，对比库存算缺口，生成采购建议。
 * 算法：
 *   物料需求总量 = 订单数量 × BOM单位用量 × (1 + 损耗系数/100)
 *   可用库存 = 当前库存 - 安全库存（安全库存作为缓冲保留）
 *   库存缺口 = 物料需求总量 - 可用库存
 *   若缺口 > 0，生成采购建议（紧急/常规按约定发货日期判断）
 */
async function generateForOrder(orderId, operator) {
  // 取订单 + BOM明细 + 物料库存
  const [orders] = await pool.query(
    `SELECT so.id, so.order_no, so.qty, so.expected_ship_date, so.door_bom_id
       FROM sales_orders so WHERE so.id = ?`,
    [orderId]
  );
  if (orders.length === 0) throw new Error('订单不存在');

  const order = orders[0];
  const [items] = await pool.query(
    `SELECT bi.material_id, bi.unit_usage, bi.loss_rate,
            m.stock_qty, m.safety_stock, m.name
       FROM door_bom_items bi JOIN materials m ON m.id = bi.material_id
      WHERE bi.bom_id = ?`,
    [order.door_bom_id]
  );

  // 优先级：约定发货日期距今 ≤ 3 天为紧急
  let priority = '常规';
  if (order.expected_ship_date) {
    const days = (new Date(order.expected_ship_date) - new Date()) / 86400000;
    if (days <= 3) priority = '紧急';
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // 先删除该订单旧的待采购建议（避免重复生成）
    await conn.query(
      "DELETE FROM purchase_suggestion WHERE order_id = ? AND status = '待采购'",
      [orderId]
    );

    const suggestions = [];
    for (const it of items) {
      const demand = order.qty * Number(it.unit_usage) * (1 + Number(it.loss_rate) / 100);
      const available = Number(it.stock_qty) - Number(it.safety_stock);
      const gap = demand - available;
      if (gap > 0) {
        const [r] = await conn.query(
          'INSERT INTO purchase_suggestion (material_id, suggest_qty, order_id, priority, status) VALUES (?,?,?,?,?)',
          [it.material_id, Math.ceil(gap * 1000) / 1000, orderId, priority, '待采购']
        );
        suggestions.push({
          id: r.insertId,
          material_id: it.material_id,
          material_name: it.name,
          suggest_qty: Math.ceil(gap * 1000) / 1000,
          order_no: order.order_no,
          priority,
        });
      }
    }
    await conn.commit();
    return { order_no: order.order_no, generated: suggestions.length, suggestions };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = { generateForOrder };
