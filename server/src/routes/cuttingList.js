const express = require('express');
const { pool } = require('../db/pool');
const { ok, fail, wrap } = require('../utils/helpers');
const { auth } = require('../middlewares/auth');
const config = require('../config');

const router = express.Router();
router.use(auth);

// 全局扣尺默认配置（只读，改值编辑 server/src/config.js 后重启）
router.get(
  '/config',
  wrap(async (req, res) => {
    ok(res, config.cutting);
  })
);

// 列表（分页+筛选，LEFT JOIN sales_orders 带 13 列展示字段）
router.get(
  '/',
  wrap(async (req, res) => {
    const { status, order_no, customer, startDate, endDate, page = 1, pageSize = 20 } = req.query;
    const where = [];
    const params = [];
    if (status) { where.push('cl.status = ?'); params.push(status); }
    if (order_no) { where.push('so.order_no LIKE ?'); params.push(`%${order_no}%`); }
    if (customer) { where.push('so.customer LIKE ?'); params.push(`%${customer}%`); }
    if (startDate) { where.push('cl.created_at >= ?'); params.push(startDate); }
    if (endDate) { where.push('cl.created_at <= ?'); params.push(endDate); }
    const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const total = (await pool.query(`SELECT COUNT(*) c FROM cutting_list cl LEFT JOIN sales_orders so ON so.id = cl.order_id ${clause}`, params))[0][0].c;
    const rows = (
      await pool.query(
        `SELECT cl.*, so.order_no, so.customer, so.style, so.color, so.frame_line, so.remark, so.board,
                so.door_h AS hole_height_src, so.door_w AS hole_width_src, so.wall_thick
           FROM cutting_list cl LEFT JOIN sales_orders so ON so.id = cl.order_id
          ${clause} ORDER BY cl.id DESC LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), (Number(page) - 1) * Number(pageSize)]
      )
    )[0];
    ok(res, { list: rows, total, page: Number(page), pageSize: Number(pageSize) });
  })
);

// 详情（含订单关联字段）
router.get(
  '/:id',
  wrap(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT cl.*, so.order_no, so.customer, so.style, so.color, so.frame_line, so.remark, so.board,
              so.door_h AS hole_height_src, so.door_w AS hole_width_src, so.wall_thick
         FROM cutting_list cl LEFT JOIN sales_orders so ON so.id = cl.order_id
        WHERE cl.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return fail(res, '下料单不存在');
    ok(res, rows[0]);
  })
);

module.exports = router;
