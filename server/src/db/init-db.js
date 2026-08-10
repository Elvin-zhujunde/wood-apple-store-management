// 数据库初始化：读取 init.sql 并执行（建库 + 建表）
const fs = require('fs');
const path = require('path');
const { rawPool } = require('./pool');

async function init() {
  const sqlPath = path.join(__dirname, 'init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  // 先去掉整行注释，再按分号拆分逐条执行
  const noComments = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  const statements = noComments
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await rawPool.query(stmt);
    console.log('OK >>', stmt.split('\n')[0].slice(0, 60));
  }
  console.log('\n✅ 数据库初始化完成：wood_store');
  await rawPool.end();
}

init().catch((e) => {
  console.error('❌ 初始化失败:', e.message);
  process.exit(1);
});
