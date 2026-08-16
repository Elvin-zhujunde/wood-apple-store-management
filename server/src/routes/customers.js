const express = require('express');
const { pool } = require('../db/pool');
const { ok, fail, wrap } = require('../utils/helpers');
const { auth, requireRole } = require('../middlewares/auth');

const router = express.Router();
router.use(auth);

// 列表（keyword 搜 name/phone）
router.get(
  '/',
  wrap(async (req, res) => {
    const { keyword } = req.query;
    const where = keyword ? 'WHERE name LIKE ? OR phone LIKE ?' : '';
    const params = keyword ? [`%${keyword}%`, `%${keyword}%`] : [];
    const [rows] = await pool.query(
      `SELECT * FROM customers ${where} ORDER BY id DESC`,
      params
    );
    ok(res, rows);
  })
);

// 下拉（H5+桌面）：{id,name,customer_type}
router.get(
  '/all',
  wrap(async (req, res) => {
    const [rows] = await pool.query(
      'SELECT id, name, customer_type FROM customers ORDER BY id'
    );
    ok(res, rows);
  })
);

// 新增（boss）
router.post(
  '/',
  requireRole('boss'),
  wrap(async (req, res) => {
    const { name, customer_type, phone, address, remark } = req.body;
    if (!name) return fail(res, '客户名称必填');
    const [r] = await pool.query(
      'INSERT INTO customers (name, customer_type, phone, address, remark) VALUES (?,?,?,?,?)',
      [name, customer_type || null, phone || null, address || null, remark || null]
    );
    ok(res, { id: r.insertId }, '新增成功');
  })
);

// 编辑（boss）
router.put(
  '/:id',
  requireRole('boss'),
  wrap(async (req, res) => {
    const { name, customer_type, phone, address, remark } = req.body;
    if (!name) return fail(res, '客户名称必填');
    await pool.query(
      'UPDATE customers SET name=?, customer_type=?, phone=?, address=?, remark=? WHERE id=?',
      [name, customer_type || null, phone || null, address || null, remark || null, req.params.id]
    );
    ok(res, null, '更新成功');
  })
);

// 删除（boss，校验引用）
router.delete(
  '/:id',
  requireRole('boss'),
  wrap(async (req, res) => {
    const [locRef] = await pool.query(
      'SELECT COUNT(*) c FROM customer_locations WHERE customer_id = ?',
      [req.params.id]
    );
    if (locRef[0].c > 0) return fail(res, '该客户下有安装定位，不可删除');
    const [measRef] = await pool.query(
      'SELECT COUNT(*) c FROM measure_records WHERE customer_id = ?',
      [req.params.id]
    );
    if (measRef[0].c > 0) return fail(res, '该客户已被测量记录引用，不可删除');
    await pool.query('DELETE FROM customers WHERE id = ?', [req.params.id]);
    ok(res, null, '删除成功');
  })
);

// 某客户的安装定位列表（静态，须在 /:id/locations 的 :id 之前无冲突；此处 :id 是参数故放动态段）
// 注意：/:id/locations 与 /:id 同为动态，Express 按声明顺序匹配，/locations 子路径需显式声明
router.get(
  '/:id/locations',
  wrap(async (req, res) => {
    const [rows] = await pool.query(
      'SELECT id, name, remark FROM customer_locations WHERE customer_id = ? ORDER BY id',
      [req.params.id]
    );
    ok(res, rows);
  })
);

// 新增定位（worker 现场可调，故不限 boss）
router.post(
  '/:id/locations',
  wrap(async (req, res) => {
    const { name, remark } = req.body;
    if (!name) return fail(res, '定位名称必填');
    const [cust] = await pool.query('SELECT id FROM customers WHERE id = ?', [req.params.id]);
    if (cust.length === 0) return fail(res, '客户不存在');
    const [r] = await pool.query(
      'INSERT INTO customer_locations (customer_id, name, remark) VALUES (?,?,?)',
      [req.params.id, name, remark || null]
    );
    ok(res, { id: r.insertId }, '定位新增成功');
  })
);

// 删除定位（boss）
router.delete(
  '/locations/:lid',
  requireRole('boss'),
  wrap(async (req, res) => {
    const [measRef] = await pool.query(
      'SELECT COUNT(*) c FROM measure_records WHERE location_id = ?',
      [req.params.lid]
    );
    if (measRef[0].c > 0) return fail(res, '该定位已被测量记录引用，不可删除');
    await pool.query('DELETE FROM customer_locations WHERE id = ?', [req.params.lid]);
    ok(res, null, '删除成功');
  })
);

module.exports = router;
