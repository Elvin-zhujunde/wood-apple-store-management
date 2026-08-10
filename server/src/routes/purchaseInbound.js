const express = require('express');
const { pool } = require('../db/pool');
const { ok, fail, wrap, genDocNo } = require('../utils/helpers');
const { auth } = require('../middlewares/auth');

const router = express.Router();
router.use(auth);

// 列表
router.get(
  '/',
  wrap(async (req, res) => {
    const { status, material_id, supplier, startDate, endDate, page = 1, pageSize = 20 } = req.query;
    const where = [];
    const params = [];
    if (status) { where.push('pi.status = ?'); params.push(status); }
    if (material_id) { where.push('pi.material_id = ?'); params.push(material_id); }
    if (supplier) { where.push('pi.supplier LIKE ?'); params.push(`%${supplier}%`); }
    if (startDate) { where.push('pi.purchase_date >= ?'); params.push(startDate); }
    if (endDate) { where.push('pi.purchase_date <= ?'); params.push(endDate); }
    const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const total = (await pool.query(`SELECT COUNT(*) c FROM purchase_inbound pi ${clause}`, params))[0][0].c;
    const rows = (
      await pool.query(
        `SELECT pi.*, m.code AS material_code, m.name AS material_name, m.spec, m.unit
           FROM purchase_inbound pi JOIN materials m ON m.id = pi.material_id
          ${clause} ORDER BY pi.id DESC LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), (Number(page) - 1) * Number(pageSize)]
      )
    )[0];
    ok(res, { list: rows, total, page: Number(page), pageSize: Number(pageSize) });
  })
);

// 新增（待到货，库存不变）
router.post(
  '/',
  wrap(async (req, res) => {
    const {
      material_id, supplier, qty, unit_price, freight = 0,
      purchase_date, expected_arrival, handler,
    } = req.body;
    if (!material_id || !supplier || !qty || !unit_price || !purchase_date || !handler)
      return fail(res, '物料/厂家/数量/单价/进货日期/经手人 必填');
    const inbound_no = await genDocNo('purchase_inbound', 'RK', 'inbound');
    const [r] = await pool.query(
      `INSERT INTO purchase_inbound
        (inbound_no, material_id, supplier, qty, unit_price, freight,
         purchase_date, expected_arrival, handler, status)
       VALUES (?,?,?,?,?,?,?,?,?, '待到货')`,
      [inbound_no, material_id, supplier, qty, unit_price, freight,
       purchase_date, expected_arrival || null, handler]
    );
    ok(res, { id: r.insertId, inbound_no }, '入库单已创建（待到货）');
  })
);

// 确认到货 —— 填实际到货日期，库存 += 进货数量，写流水
router.put(
  '/:id/confirm',
  wrap(async (req, res) => {
    const { actual_arrival } = req.body;
    if (!actual_arrival) return fail(res, '请填写实际到货日期');
    const [rows] = await pool.query('SELECT * FROM purchase_inbound WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return fail(res, '入库单不存在');
    const pi = rows[0];
    if (pi.status === '已到货') return fail(res, '该入库单已确认到货，不可重复操作');

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        'UPDATE purchase_inbound SET actual_arrival=?, status=? WHERE id=?',
        [actual_arrival, '已到货', req.params.id]
      );
      await conn.query(
        'UPDATE materials SET stock_qty = stock_qty + ? WHERE id = ?',
        [pi.qty, pi.material_id]
      );
      await conn.query(
        'INSERT INTO inventory_log (material_id, change_type, qty, ref_no, operator) VALUES (?, ?, ?, ?, ?)',
        [pi.material_id, 'in', pi.qty, pi.inbound_no, req.user.name]
      );
      await conn.commit();
      ok(res, null, '已确认到货，库存已增加');
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

// 详情
router.get(
  '/:id',
  wrap(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT pi.*, m.name AS material_name, m.code, m.spec, m.unit
         FROM purchase_inbound pi JOIN materials m ON m.id = pi.material_id
        WHERE pi.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return fail(res, '入库单不存在');
    ok(res, rows[0]);
  })
);

module.exports = router;
