// 纯 Node.js 数据导入（不依赖 mysql 命令）
// 读取 wood_store_backup.sql 写入数据库
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const { rawPool } = require('../server/src/db/pool');

const dbName = process.env.DB_NAME || 'wood_store';
const inFile = path.join(__dirname, 'wood_store_backup.sql');

async function importDB() {
  if (!fs.existsSync(inFile)) {
    console.error(`❌ 找不到备份文件：${inFile}`);
    console.error('   请先执行「导出数据.bat」，或把 wood_store_backup.sql 放到此目录。');
    process.exit(1);
  }

  console.log(`正在从 ${inFile} 导入到数据库 ${dbName} ...`);
  // 用单连接执行，确保 SET FOREIGN_KEY_CHECKS 在整个导入过程中生效
  const conn = await rawPool.getConnection();
  await conn.query(`CREATE DATABASE IF NOT EXISTS ${dbName} DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.changeUser({ database: dbName });

  const sql = fs.readFileSync(inFile, 'utf8');
  // 按分号拆分（忽略注释行和空行）
  const noComments = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  const stmts = noComments.split(';').map((s) => s.trim()).filter((s) => s.length > 0);

  let count = 0;
  let failed = 0;
  for (const stmt of stmts) {
    try {
      await conn.query(stmt);
      count++;
    } catch (e) {
      failed++;
      console.error(`语句执行失败: ${stmt.slice(0, 80)}...`);
      console.error(`错误: ${e.message}`);
    }
  }
  conn.release();
  await rawPool.end();
  console.log(`✅ 导入完成：成功 ${count} 条，失败 ${failed} 条，${dbName} 已恢复`);
}

importDB().catch((e) => {
  console.error('❌ 导入失败:', e.message);
  console.error('请确认 server/.env 中的 DB_PASSWORD 正确，MySQL 正在运行。');
  process.exit(1);
});
