// 种子数据：3个用户 + 7种物料 + 1个门型BOM(含明细)
const bcrypt = require('bcryptjs');
const { pool } = require('./pool');

async function seed() {
  const conn = await pool.getConnection();
  try {
    // 用户（统一密码 123456）
    const hash = await bcrypt.hash('123456', 10);
    await conn.query('DELETE FROM users');
    await conn.query(
      `INSERT INTO users (username, password_hash, role, name) VALUES
        ('sale',    ?, 'sale',    '张销售'),
        ('stock',   ?, 'stock',   '李库管'),
        ('finance', ?, 'finance', '王财务')`,
      [hash, hash, hash]
    );
    console.log('✅ 用户: sale/stock/finance (密码均 123456)');

    // 物料档案（7种，含主材与耗材）—— 按依赖反序删除
    await conn.query('DELETE FROM purchase_suggestion');
    await conn.query('DELETE FROM inventory_log');
    await conn.query('DELETE FROM material_requisition');
    await conn.query('DELETE FROM purchase_inbound');
    await conn.query('DELETE FROM sales_orders');
    await conn.query('DELETE FROM door_bom_items');
    await conn.query('DELETE FROM door_bom');
    await conn.query('DELETE FROM materials');
    await conn.query(
      `INSERT INTO materials (code, name, category, spec, unit, stock_qty, safety_stock) VALUES
        ('CL-001','面板',    '主材','9mm 1220x2440mm','张',  20,  50),
        ('CL-002','大板',    '主材','18mm 1220x2440mm','张',  15,  30),
        ('CL-003','线条',    '主材','45mm','米',               200, 100),
        ('CL-004','封边条',  '主材','22mm','米',               300, 150),
        ('CL-005','杉木木板','耗材','15mm','张',               10,  20),
        ('CL-006','实木门芯','耗材','标准芯','块',             8,   15),
        ('CL-007','石墨烯填充','耗材','粉状','公斤',           25,  40)`
    );
    console.log('✅ 物料档案: 7种(面板/大板/线条/封边条/杉木木板/实木门芯/石墨烯填充)');

    // 门型BOM
    const [bomRes] = await conn.query(
      `INSERT INTO door_bom (code, name, standard_size, colors, nonstd_markup) VALUES
        ('M-101','现代极简平板门','2100x900x45mm','肤感白,黑胡桃,红橡', 10.00)`
    );
    const bomId = bomRes.insertId;
    // 取物料id映射
    const [mats] = await conn.query('SELECT id, code FROM materials');
    const codeToId = Object.fromEntries(mats.map((m) => [m.code, m.id]));
    await conn.query(
      `INSERT INTO door_bom_items (bom_id, material_id, unit_usage, loss_rate) VALUES
        (?, ?, 2.000, 5.00),
        (?, ?, 1.000, 5.00),
        (?, ?, 6.000, 3.00),
        (?, ?, 6.000, 3.00),
        (?, ?, 1.000, 8.00),
        (?, ?, 1.000, 5.00),
        (?, ?, 0.500, 10.00)`,
      [
        bomId, codeToId['CL-001'],
        bomId, codeToId['CL-002'],
        bomId, codeToId['CL-003'],
        bomId, codeToId['CL-004'],
        bomId, codeToId['CL-005'],
        bomId, codeToId['CL-006'],
        bomId, codeToId['CL-007'],
      ]
    );
    console.log('✅ 门型BOM: M-101 现代极简平板门 (7项明细)');

    console.log('\n种子数据写入完成。');
  } finally {
    conn.release();
    await pool.end();
  }
}

seed().catch((e) => {
  console.error('❌ 种子数据失败:', e.message);
  process.exit(1);
});
