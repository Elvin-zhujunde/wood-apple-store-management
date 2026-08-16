const express = require('express');
const { pool } = require('../db/pool');
const { ok, fail, wrap } = require('../utils/helpers');
const { auth } = require('../middlewares/auth');

const router = express.Router();
router.use(auth);

// 列表
router.get(
  '/',
  wrap(async (req, res) => {
    const { keyword } = req.query;
    const where = keyword ? 'WHERE name LIKE ? OR code LIKE ?' : '';
    const params = keyword ? [`%${keyword}%`, `%${keyword}%`] : [];
    const [rows] = await pool.query(
      `SELECT * FROM door_bom ${where} ORDER BY id DESC`,
      params
    );
    ok(res, rows);
  })
);

// 全部（下拉，供销售订单门型选择）
router.get(
  '/all',
  wrap(async (req, res) => {
    const [rows] = await pool.query('SELECT id, code, name, standard_size, colors FROM door_bom ORDER BY id');
    ok(res, rows);
  })
);

// 详情（含明细+物料信息）
router.get(
  '/:id',
  wrap(async (req, res) => {
    const [boms] = await pool.query('SELECT * FROM door_bom WHERE id = ?', [req.params.id]);
    if (boms.length === 0) return fail(res, '门型不存在');
    const [items] = await pool.query(
      `SELECT bi.id, bi.material_id, m.code, m.name, m.spec, m.unit, bi.unit_usage, bi.loss_rate
       FROM door_bom_items bi JOIN materials m ON m.id = bi.material_id
       WHERE bi.bom_id = ?`,
      [req.params.id]
    );
    ok(res, { ...boms[0], items });
  })
);

// 新增（含明细）
router.post(
  '/',
  wrap(async (req, res) => {
    const { code, name, standard_size, colors, nonstd_markup = 0, items = [] } = req.body;
    if (!code || !name || !standard_size || !colors) return fail(res, '编号/名称/标准尺寸/颜色 必填');
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [r] = await conn.query(
        'INSERT INTO door_bom (code, name, standard_size, colors, nonstd_markup) VALUES (?,?,?,?,?)',
        [code, name, standard_size, colors, nonstd_markup]
      );
      const bomId = r.insertId;
      for (const it of items) {
        await conn.query(
          'INSERT INTO door_bom_items (bom_id, material_id, unit_usage, loss_rate) VALUES (?,?,?,?)',
          [bomId, it.material_id, it.unit_usage, it.loss_rate || 0]
        );
      }
      await conn.commit();
      ok(res, { id: bomId }, '新增成功');
    } catch (e) {
      await conn.rollback();
      if (e.code === 'ER_DUP_ENTRY') return fail(res, '门型编号已存在');
      throw e;
    } finally {
      conn.release();
    }
  })
);

// 编辑（含明细：先删后插）
router.put(
  '/:id',
  wrap(async (req, res) => {
    const { name, standard_size, colors, nonstd_markup = 0, items = [] } = req.body;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        'UPDATE door_bom SET name=?, standard_size=?, colors=?, nonstd_markup=? WHERE id=?',
        [name, standard_size, colors, nonstd_markup, req.params.id]
      );
      await conn.query('DELETE FROM door_bom_items WHERE bom_id = ?', [req.params.id]);
      for (const it of items) {
        await conn.query(
          'INSERT INTO door_bom_items (bom_id, material_id, unit_usage, loss_rate) VALUES (?,?,?,?)',
          [req.params.id, it.material_id, it.unit_usage, it.loss_rate || 0]
        );
      }
      await conn.commit();
      ok(res, null, '更新成功');
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

// 删除（校验是否被销售订单引用）
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const [orderRefs] = await pool.query('SELECT COUNT(*) c FROM sales_orders WHERE door_bom_id = ?', [req.params.id]);
    if (orderRefs[0].c > 0) return fail(res, '该门型已被销售订单引用，不可删除');
    await pool.query('DELETE FROM door_bom WHERE id = ?', [req.params.id]);
    ok(res, null, '删除成功');
  })
);

module.exports = router;
