const express = require('express');
const { pool } = require('../db/pool');
const { ok, fail, wrap } = require('../utils/helpers');
const { auth } = require('../middlewares/auth');

const router = express.Router();
router.use(auth);

// 列表（分页+筛选）
router.get(
  '/',
  wrap(async (req, res) => {
    const { category, keyword, manufacturer, page = 1, pageSize = 20 } = req.query;
    const where = [];
    const params = [];
    if (category) {
      where.push('category = ?');
      params.push(category);
    }
    if (keyword) {
      where.push('(name LIKE ? OR code LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (manufacturer) {
      where.push('manufacturer LIKE ?');
      params.push(`%${manufacturer}%`);
    }
    const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const total = (
      await pool.query(`SELECT COUNT(*) c FROM materials ${clause}`, params)
    )[0][0].c;
    const rows = (
      await pool.query(
        `SELECT * FROM materials ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), (Number(page) - 1) * Number(pageSize)]
      )
    )[0];
    ok(res, { list: rows, total, page: Number(page), pageSize: Number(pageSize) });
  })
);

// 全部（不分页，供下拉）
router.get(
  '/all',
  wrap(async (req, res) => {
    const [rows] = await pool.query('SELECT id, code, name, category, spec, unit, stock_qty, safety_stock, origin_place, manufacturer, unit_price FROM materials ORDER BY id');
    ok(res, rows);
  })
);

// 详情
router.get(
  '/:id',
  wrap(async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM materials WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return fail(res, '物料不存在');
    ok(res, rows[0]);
  })
);

// 新增
router.post(
  '/',
  wrap(async (req, res) => {
    const { code, name, category, spec, unit, safety_stock = 0, origin_place, manufacturer, unit_price = 0 } = req.body;
    if (!code || !name || !category || !spec || !unit) return fail(res, '编码/名称/分类/规格/单位 必填');
    try {
      const [r] = await pool.query(
        'INSERT INTO materials (code, name, category, spec, unit, safety_stock, origin_place, manufacturer, unit_price) VALUES (?,?,?,?,?,?,?,?,?)',
        [code, name, category, spec, unit, safety_stock, origin_place || null, manufacturer || null, Number(unit_price) || 0]
      );
      ok(res, { id: r.insertId }, '新增成功');
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return fail(res, '物料编码已存在');
      throw e;
    }
  })
);

// 编辑
router.put(
  '/:id',
  wrap(async (req, res) => {
    const { name, category, spec, unit, safety_stock = 0, origin_place, manufacturer, unit_price = 0 } = req.body;
    await pool.query(
      'UPDATE materials SET name=?, category=?, spec=?, unit=?, safety_stock=?, origin_place=?, manufacturer=?, unit_price=? WHERE id=?',
      [name, category, spec, unit, safety_stock, origin_place || null, manufacturer || null, Number(unit_price) || 0, req.params.id]
    );
    ok(res, null, '更新成功');
  })
);

// 删除（校验是否被BOM引用）
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const [refs] = await pool.query('SELECT COUNT(*) c FROM door_bom_items WHERE material_id = ?', [req.params.id]);
    if (refs[0].c > 0) return fail(res, '该物料被门型BOM引用，不可删除');
    const [logs] = await pool.query('SELECT COUNT(*) c FROM inventory_log WHERE material_id = ?', [req.params.id]);
    if (logs[0].c > 0) return fail(res, '该物料已有库存变动记录，不可删除');
    await pool.query('DELETE FROM materials WHERE id = ?', [req.params.id]);
    ok(res, null, '删除成功');
  })
);

module.exports = router;
