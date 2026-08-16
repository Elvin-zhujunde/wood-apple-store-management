const express = require('express');
const { pool } = require('../db/pool');
const { ok, fail, wrap, genDocNo } = require('../utils/helpers');
const { auth, requireRole } = require('../middlewares/auth');

const router = express.Router();
router.use(auth);

// 我的测量记录列表（按 measured_by=JWT.name 过滤，分页）
router.get(
  '/',
  wrap(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(100, Number(req.query.size) || 20);
    const status = req.query.status || '';
    const where = ['m.measured_by = ?'];
    const params = [req.user.name];
    if (status) { where.push('m.status = ?'); params.push(status); }
    const [rows] = await pool.query(
      `SELECT m.id, m.customer_id, m.location_id, m.door_h, m.door_w, m.wall_thick,
              m.remark, m.measured_at, m.status, m.sales_order_id,
              c.name AS customer_name, l.name AS location_name,
              (SELECT COUNT(*) FROM attachments a WHERE a.entity_type='measure' AND a.entity_id=m.id) AS photo_count
       FROM measure_records m
       LEFT JOIN customers c ON c.id = m.customer_id
       LEFT JOIN customer_locations l ON l.id = m.location_id
       WHERE ${where.join(' AND ')}
       ORDER BY m.id DESC LIMIT ? OFFSET ?`,
      [...params, size, (page - 1) * size]
    );
    ok(res, rows);
  })
);

// 待转单全量列表（桌面转单用，boss）
router.get(
  '/pending',
  requireRole('boss'),
  wrap(async (req, res) => {
    const keyword = req.query.keyword || '';
    const where = ["m.status = '待转单'"];
    const params = [];
    if (keyword) {
      where.push('(c.name LIKE ? OR l.name LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    const [rows] = await pool.query(
      `SELECT m.id, m.customer_id, m.location_id, m.door_h, m.door_w, m.wall_thick,
              m.remark, m.measured_at, m.measured_by,
              c.name AS customer_name, l.name AS location_name,
              (SELECT COUNT(*) FROM attachments a WHERE a.entity_type='measure' AND a.entity_id=m.id) AS photo_count
       FROM measure_records m
       LEFT JOIN customers c ON c.id = m.customer_id
       LEFT JOIN customer_locations l ON l.id = m.location_id
       WHERE ${where.join(' AND ')}
       ORDER BY m.id DESC`,
      params
    );
    ok(res, rows);
  })
);

// 详情（含照片）
router.get(
  '/:id',
  wrap(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT m.*, c.name AS customer_name, l.name AS location_name
       FROM measure_records m
       LEFT JOIN customers c ON c.id = m.customer_id
       LEFT JOIN customer_locations l ON l.id = m.location_id
       WHERE m.id = ? AND (m.measured_by = ? OR ? = 'boss')`,
      [req.params.id, req.user.name, req.user.role]
    );
    if (rows.length === 0) return fail(res, '测量记录不存在');
    const [photos] = await pool.query(
      `SELECT id, file_path, file_name FROM attachments WHERE entity_type='measure' AND entity_id=? ORDER BY id DESC`,
      [req.params.id]
    );
    ok(res, { ...rows[0], photos });
  })
);

// 新建（核心）
router.post(
  '/',
  wrap(async (req, res) => {
    const { customer_id, location_id, door_h, door_w, wall_thick, remark, photo_ids = [] } = req.body;
    if (!customer_id || !location_id || door_h == null || door_w == null || wall_thick == null)
      return fail(res, '客户/安装定位/门洞高宽/墙厚 必填');
    // 校验 location 归属 customer
    const [locs] = await pool.query(
      'SELECT id FROM customer_locations WHERE id = ? AND customer_id = ?',
      [location_id, customer_id]
    );
    if (locs.length === 0) return fail(res, '安装定位不存在或不属于该客户');
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [r] = await conn.query(
        `INSERT INTO measure_records (customer_id, location_id, door_h, door_w, wall_thick, remark, measured_by, measured_at, status)
         VALUES (?,?,?,?,?,?,?,?, '待转单')`,
        [customer_id, location_id, door_h, door_w, wall_thick, remark || null, req.user.name, new Date()]
      );
      const id = r.insertId;
      // 回填照片 entity_id
      if (photo_ids.length > 0) {
        const placeholders = photo_ids.map(() => '?').join(',');
        await conn.query(
          `UPDATE attachments SET entity_id=? WHERE id IN (${placeholders}) AND entity_type='measure'`,
          [id, ...photo_ids]
        );
      }
      await conn.commit();
      ok(res, { id }, '测量记录已保存');
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

// 编辑（仅待转单 + 本人）
router.put(
  '/:id',
  wrap(async (req, res) => {
    const { door_h, door_w, wall_thick, remark } = req.body;
    const [rows] = await pool.query(
      "SELECT measured_by, status FROM measure_records WHERE id = ?",
      [req.params.id]
    );
    if (rows.length === 0) return fail(res, '记录不存在');
    if (rows[0].measured_by !== req.user.name) return fail(res, '只能编辑自己的记录');
    if (rows[0].status !== '待转单') return fail(res, '已转单记录不可编辑');
    await pool.query(
      'UPDATE measure_records SET door_h=?, door_w=?, wall_thick=?, remark=? WHERE id=?',
      [door_h, door_w, wall_thick, remark || null, req.params.id]
    );
    ok(res, null, '更新成功');
  })
);

// 删除（仅待转单 + 本人，同时删其照片）
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const [rows] = await pool.query(
      'SELECT measured_by, status FROM measure_records WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) return fail(res, '记录不存在');
    if (rows[0].measured_by !== req.user.name) return fail(res, '只能删除自己的记录');
    if (rows[0].status !== '待转单') return fail(res, '已转单记录不可删除');
    // 删关联照片（DB 行 + 物理文件）
    const [photos] = await pool.query(
      "SELECT id, file_path FROM attachments WHERE entity_type='measure' AND entity_id=?",
      [req.params.id]
    );
    const fs = require('fs');
    const path = require('path');
    for (const p of photos) {
      await pool.query('DELETE FROM attachments WHERE id = ?', [p.id]);
      const abs = path.join(__dirname, '../../', p.file_path);
      fs.unlink(abs, () => {});
    }
    await pool.query('DELETE FROM measure_records WHERE id = ?', [req.params.id]);
    ok(res, null, '删除成功');
  })
);

// 转单（boss，单事务）
router.post(
  '/:id/convert',
  requireRole('boss'),
  wrap(async (req, res) => {
    const { door_bom_id, color, qty, unit_price, handler_sale, order_date,
            lock_hole, style, board } = req.body;
    if (!door_bom_id || !color || !qty || !unit_price || !handler_sale || !order_date)
      return fail(res, '门型/颜色/数量/单价/经手人/下单日期 必填');

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [ms] = await conn.query(
        `SELECT m.*, c.name AS customer_name, l.name AS location_name
         FROM measure_records m
         JOIN customers c ON c.id = m.customer_id
         JOIN customer_locations l ON l.id = m.location_id
         WHERE m.id = ? FOR UPDATE`,
        [req.params.id]
      );
      if (ms.length === 0) { await conn.rollback(); return fail(res, '测量记录不存在'); }
      const m = ms[0];
      if (m.status !== '待转单') { await conn.rollback(); return fail(res, '该记录已转单，不可重复转单'); }

      const order_no = await genDocNo('sales_orders', 'SO', 'order', conn);
      const total_amount = qty * Number(unit_price);
      const remarkMerged = (m.remark ? `[现场测量] ${m.remark}` : '[现场测量]') ;

      // 字段顺序对照 salesOrders.js 接单 INSERT + init.sql sales_orders 表结构（命名列插入，列名对齐表定义）
      // brief 原 VALUES 缺 order_date 的 ?（19列18值），已修正为 19列19值（17?+2字面量）
      const [r] = await conn.query(
        `INSERT INTO sales_orders
          (order_no, customer, sub_customer, door_bom_id, color, qty, unit_price, total_amount,
           handler_sale, order_date, status,
           door_h, door_w, wall_thick, remark, hardware, lock_hole, style, board)
         VALUES (?,?,?,?,?,?,?,?,?,?, '新建', ?,?,?,?, NULL, ?, ?, ?)`,
        [order_no, m.customer_name, m.location_name, door_bom_id, color, qty, unit_price, total_amount,
         handler_sale, order_date,
         m.door_h, m.door_w, m.wall_thick, remarkMerged,
         lock_hole || null, style || null, board || null]
      );
      const soId = r.insertId;

      // 照片迁移到订单（单一归属）
      await conn.query(
        "UPDATE attachments SET entity_type='sales_order', entity_id=? WHERE entity_type='measure' AND entity_id=?",
        [soId, req.params.id]
      );
      // 测量记录状态更新
      await conn.query(
        "UPDATE measure_records SET status='已转单', sales_order_id=? WHERE id=?",
        [soId, req.params.id]
      );

      await conn.commit();
      ok(res, { order_no, sales_order_id: soId }, '转单成功');
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

module.exports = router;
