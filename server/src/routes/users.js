const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');
const { ok, fail, wrap } = require('../utils/helpers');
const { auth, requireRole } = require('../middlewares/auth');

const router = express.Router();
router.use(auth, requireRole('boss'));

// 列表（不返回密码）
router.get(
  '/',
  wrap(async (req, res) => {
    const [rows] = await pool.query(
      'SELECT id, username, role, name, created_at FROM users ORDER BY id'
    );
    ok(res, rows);
  })
);

// 新增
router.post(
  '/',
  wrap(async (req, res) => {
    const { username, password, role, name } = req.body;
    if (!username || !password || !role || !name)
      return fail(res, '账号/密码/角色/姓名 必填');
    if (!['boss', 'worker'].includes(role)) return fail(res, '角色只能是 boss 或 worker');
    const hash = await bcrypt.hash(password, 10);
    try {
      const [r] = await pool.query(
        'INSERT INTO users (username, password_hash, role, name) VALUES (?,?,?,?)',
        [username, hash, role, name]
      );
      ok(res, { id: r.insertId }, '账号新增成功');
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return fail(res, '账号已存在');
      throw e;
    }
  })
);

// 改基本信息
router.put(
  '/:id',
  wrap(async (req, res) => {
    const { role, name } = req.body;
    if (role && !['boss', 'worker'].includes(role)) return fail(res, '角色只能是 boss 或 worker');
    if (Number(req.params.id) === req.user.id && role && role !== 'boss') return fail(res, '不能降级自己');
    await pool.query(
      'UPDATE users SET role=COALESCE(?, role), name=COALESCE(?, name) WHERE id=?',
      [role || null, name || null, req.params.id]
    );
    ok(res, null, '更新成功');
  })
);

// 重置密码
router.put(
  '/:id/password',
  wrap(async (req, res) => {
    const { new_password } = req.body;
    if (!new_password) return fail(res, '新密码必填');
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash=? WHERE id=?', [hash, req.params.id]);
    ok(res, null, '密码已重置');
  })
);

// 删除（不能删自己）
router.delete(
  '/:id',
  wrap(async (req, res) => {
    if (Number(req.params.id) === req.user.id) return fail(res, '不能删除自己');
    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    ok(res, null, '删除成功');
  })
);

module.exports = router;
