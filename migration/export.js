// 纯 Node.js 数据导出（不依赖 mysqldump 命令）
// 生成 wood_store_backup.sql，包含建表语句 + 全部数据
const fs = require('fs');
const path = require('path');
// 先加载 server/.env，再 require pool（pool 内部会读 env）
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const { rawPool } = require('../server/src/db/pool');

const dbName = process.env.DB_NAME || 'wood_store';
const outFile = path.join(__dirname, 'wood_store_backup.sql');

// 需要导出的表（按依赖顺序）
const TABLES = [
  'users', 'materials', 'door_bom', 'door_bom_items',
  'sales_orders', 'purchase_inbound', 'material_requisition',
  'inventory_log', 'purchase_suggestion',
];

async function exportDB() {
  console.log(`正在导出数据库 ${dbName} ...`);
  const lines = [];
  lines.push(`-- 木门库存与订单系统 数据备份`);
  lines.push(`-- 生成时间: ${new Date().toISOString()}`);
  lines.push(`-- 数据库: ${dbName}`);
  lines.push(`SET NAMES utf8mb4;`);
  lines.push(`SET FOREIGN_KEY_CHECKS=0;`);
  lines.push('');

  for (const table of TABLES) {
    // 建表语句
    const [ddl] = await rawPool.query(`SHOW CREATE TABLE ${dbName}.${table}`);
    lines.push(`-- ----------------------------`);
    lines.push(`-- 表结构: ${table}`);
    lines.push(`-- ----------------------------`);
    lines.push(`DROP TABLE IF EXISTS \`${table}\`;`);
    lines.push(ddl[0]['Create Table'] + ';');
    lines.push('');

    // 数据
    const [rows] = await rawPool.query(`SELECT * FROM ${dbName}.${table}`);
    if (rows.length === 0) {
      lines.push(`-- ${table}: 无数据`);
      lines.push('');
      continue;
    }
    const cols = Object.keys(rows[0]);
    lines.push(`-- ${table}: ${rows.length} 行数据`);
    lines.push(`INSERT INTO \`${table}\` (\`${cols.join('`,`')}\`) VALUES`);
    const valueLines = rows.map((r) => {
      const vals = cols.map((c) => {
        const v = r[c];
        if (v === null) return 'NULL';
        if (typeof v === 'number') return String(v);
        if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`;
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      return `  (${vals.join(',')})`;
    });
    lines.push(valueLines.join(',\n') + ';');
    lines.push('');
  }

  lines.push('SET FOREIGN_KEY_CHECKS=1;');

  fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
  const size = fs.statSync(outFile).size;
  console.log(`✅ 导出成功：${outFile} (${(size / 1024).toFixed(1)} KB)`);
  await rawPool.end();
}

exportDB().catch((e) => {
  console.error('❌ 导出失败:', e.message);
  console.error('请确认 server/.env 中的 DB_PASSWORD 正确，MySQL 正在运行。');
  process.exit(1);
});
