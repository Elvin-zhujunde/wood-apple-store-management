const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');
const { sign } = require('../utils/jwt');
const { ok, fail, wrap } = require('../utils/helpers');
const { auth } = require('../middlewares/auth');

const router = express.Router();

// 登录
router.post(
  '/login',
  wrap(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return fail(res, '请输入账号和密码');
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) return fail(res, '账号不存在');
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return fail(res, '密码错误');
    const token = sign({ id: user.id, username: user.username, role: user.role, name: user.name });
    ok(res, { token, user: { id: user.id, username: user.username, role: user.role, name: user.name } });
  })
);

// 当前用户信息
router.get(
  '/me',
  auth,
  wrap(async (req, res) => {
    ok(res, req.user);
  })
);

module.exports = router;
