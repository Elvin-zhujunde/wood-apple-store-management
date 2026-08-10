// 创建空数据库（仅建库，不建表，用于迁移前置）
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const { rawPool } = require('../server/src/db/pool');

const dbName = process.env.DB_NAME || 'wood_store';

async function createDB() {
  try {
    await rawPool.query(`CREATE DATABASE IF NOT EXISTS ${dbName} DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ 数据库 ${dbName} 已就绪`);
    await rawPool.end();
  } catch (e) {
    console.error('❌ 建库失败，请检查 MySQL 是否运行、密码是否正确。');
    console.error('错误:', e.message);
    process.exit(1);
  }
}
createDB();
