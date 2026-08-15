// 采购建议生成服务（ARE-108：安全库存驱动，替代原 BOM 拆解引擎）
// 触发：领料出库后(扣库存)、入库确认后(加库存)调用 checkSafetyStock(materialId)
// 规则：库存 ≤ 安全库存 且 无"待采购"建议 → 生成一条建议(suggest_qty=0 不算量,采纳时用户自填)
//       库存 > 安全库存 → 该物料待采购建议标记"已采购"(已满足,消除)
const { pool } = require('../db/pool');

/**
 * 检查某物料库存是否触发/消除采购建议。
 * 领料出库后调（可能触发建议）；入库确认后调（可能消除建议）。
 * @param {number} materialId 物料id
 * @param {string} operator 操作人(仅日志用)
 * @returns {{action:'created'|'cleared'|'none', material_id, stock_qty, safety_stock}}
 */
async function checkSafetyStock(materialId, operator) {
  const [rows] = await pool.query(
    'SELECT id, name, stock_qty, safety_stock FROM materials WHERE id = ?',
    [materialId]
  );
  if (rows.length === 0) throw new Error('物料不存在');
  const m = rows[0];
  const stock = Number(m.stock_qty);
  const safety = Number(m.safety_stock);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // 该物料是否已有"待采购"建议
    const [exist] = await conn.query(
      "SELECT id FROM purchase_suggestion WHERE material_id = ? AND status = '待采购' LIMIT 1",
      [materialId]
    );

    if (safety > 0 && stock <= safety) {
      // 库存 ≤ 安全库存：若无待采购建议则生成一条（不重复）
      if (exist.length === 0) {
        await conn.query(
          'INSERT INTO purchase_suggestion (material_id, suggest_qty, order_id, priority, status) VALUES (?,?,?,?,?)',
          [materialId, 0, null, '常规', '待采购']
        );
        await conn.commit();
        return { action: 'created', material_id: materialId, name: m.name, stock_qty: stock, safety_stock: safety };
      }
      await conn.commit();
      return { action: 'none', material_id: materialId, name: m.name, stock_qty: stock, safety_stock: safety };
    } else {
      // 库存 > 安全库存：若有待采购建议则标记已采购（库存已恢复,消除）
      if (exist.length > 0) {
        await conn.query(
          "UPDATE purchase_suggestion SET status = '已采购' WHERE material_id = ? AND status = '待采购'",
          [materialId]
        );
        await conn.commit();
        return { action: 'cleared', material_id: materialId, name: m.name, stock_qty: stock, safety_stock: safety };
      }
      await conn.commit();
      return { action: 'none', material_id: materialId, name: m.name, stock_qty: stock, safety_stock: safety };
    }
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * 全量扫描所有低库存物料，生成采购建议（手动触发用，工作台"刷新建议"按钮）。
 * 幂等：已有待采购建议的物料不重复生成。
 * @returns {{created:number, cleared:number, details:[]}}
 */
async function scanAllLowStock(operator) {
  // 当前低库存(safety>0 且 stock<=safety)且无待采购建议的物料
  const [low] = await pool.query(
    `SELECT m.id, m.name, m.stock_qty, m.safety_stock FROM materials m
     WHERE m.safety_stock > 0 AND m.stock_qty <= m.safety_stock
       AND NOT EXISTS (SELECT 1 FROM purchase_suggestion ps WHERE ps.material_id = m.id AND ps.status = '待采购')
     ORDER BY (m.safety_stock - m.stock_qty) DESC`
  );
  // 库存已恢复(>安全库存)但仍有待采购建议的物料(消除)
  const [recover] = await pool.query(
    `SELECT ps.id, ps.material_id FROM purchase_suggestion ps
     JOIN materials m ON m.id = ps.material_id
     WHERE ps.status = '待采购' AND m.stock_qty > m.safety_stock`
  );

  const conn = await pool.getConnection();
  const details = [];
  try {
    await conn.beginTransaction();
    for (const m of low) {
      await conn.query(
        'INSERT INTO purchase_suggestion (material_id, suggest_qty, order_id, priority, status) VALUES (?,?,?,?,?)',
        [m.id, 0, null, '常规', '待采购']
      );
      details.push({ action: 'created', material_id: m.id, name: m.name, stock_qty: Number(m.stock_qty), safety_stock: Number(m.safety_stock) });
    }
    for (const r of recover) {
      await conn.query('UPDATE purchase_suggestion SET status = ? WHERE id = ?', ['已采购', r.id]);
    }
    await conn.commit();
    return { created: low.length, cleared: recover.length, details };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = { checkSafetyStock, scanAllLowStock };
