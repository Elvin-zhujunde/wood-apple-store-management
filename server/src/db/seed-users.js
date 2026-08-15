// 仅创建登录用户，不清业务表（生产/迁移安全用）
// 非破坏性：只补登录账号，不清业务表、不插示例数据（生产数据通过 .sql 导入）
const bcrypt = require('bcryptjs');
const { pool } = require('./pool');

async function seedUsers() {
  const conn = await pool.getConnection();
  try {
    const hash = await bcrypt.hash('123456', 10);
    // 幂等：已存在的用户跳过，不重复插入也不覆盖密码
    const [rows] = await conn.query('SELECT username FROM users WHERE username IN (?, ?, ?)', ['sale', 'stock', 'finance']);
    const existing = new Set(rows.map((r) => r.username));
    const toCreate = [
      ['sale', 'sale', '张销售'],
      ['stock', 'stock', '李库管'],
      ['finance', 'finance', '王财务'],
    ].filter(([u]) => !existing.has(u));

    if (toCreate.length === 0) {
      console.log('✅ 3个用户已存在，无需创建');
    } else {
      for (const [username, role, name] of toCreate) {
        await conn.query(
          'INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)',
          [username, hash, role, name]
        );
        console.log(`✅ 创建用户: ${username} (${name})`);
      }
    }
    console.log('用户: sale / stock / finance（密码均 123456）');
    console.log('⚠️ 生产环境请登录后立即修改默认密码');
  } finally {
    conn.release();
    await pool.end();
  }
}

seedUsers().catch((e) => {
  console.error('❌ 创建用户失败:', e.message);
  process.exit(1);
});
