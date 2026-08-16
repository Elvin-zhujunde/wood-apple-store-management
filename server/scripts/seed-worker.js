require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db/pool');
(async () => {
  const hash = await bcrypt.hash('123456', 10);
  await pool.query(
    "INSERT INTO users (username,password_hash,role,name) VALUES (?,?,?,?)",
    ['worker01', hash, 'worker', '测试工人']
  );
  console.log('worker 账号已创建: worker01 / 123456');
  process.exit(0);
})();
