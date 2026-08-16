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

// 加工备注标签联想：近期 N 条已下料订单 cut_remark_tags 去重（近期优先）
// 静态路径，须在 /:id 之前声明，否则被参数路由吞
router.get(
  '/tags',
  wrap(async (req, res) => {
    const TAG_SAMPLE = 500;
    const [rows] = await pool.query(
      "SELECT cut_remark_tags FROM sales_orders WHERE cut_remark_tags IS NOT NULL AND cut_remark_tags != '' ORDER BY id DESC LIMIT ?",
      [TAG_SAMPLE]
    );
    const seen = new Set();
    const list = [];
    for (const row of rows) {
      try {
        const arr = JSON.parse(row.cut_remark_tags);
        if (Array.isArray(arr)) {
          for (const s of arr) {
            if (typeof s === 'string' && s && !seen.has(s)) {
              seen.add(s);
              list.push(s);
            }
          }
        }
      } catch {}
    }
    ok(res, list);
  })
);

// 列表（分页+筛选，只列已下料的订单 cut_status 非空）
// 字段映射回前端原命名：door_h→hole_height / door_w→hole_width / cut_*→原下料字段名
router.get(
  '/',
  wrap(async (req, res) => {
    const { status, order_no, customer, startDate, endDate, ids, page = 1, pageSize = 20 } = req.query;
    const where = ["so.cut_status IS NOT NULL"];
    const params = [];
    if (status) { where.push('so.cut_status = ?'); params.push(status); }
    if (order_no) { where.push('so.order_no LIKE ?'); params.push(`%${order_no}%`); }
    if (customer) { where.push('so.customer LIKE ?'); params.push(`%${customer}%`); }
    if (startDate) { where.push('so.cut_date >= ?'); params.push(startDate); }
    if (endDate) { where.push('so.cut_date <= ?'); params.push(endDate); }
    if (ids) {
      const idArr = String(ids).split(',').map((s) => parseInt(s, 10)).filter((n) => !isNaN(n));
      if (idArr.length) {
        where.push(`so.id IN (${idArr.map(() => '?').join(',')})`);
        params.push(...idArr);
      }
    }
    const clause = 'WHERE ' + where.join(' AND ');
    const total = (await pool.query(`SELECT COUNT(*) c FROM sales_orders so ${clause}`, params))[0][0].c;
    const rows = (
      await pool.query(
        `SELECT so.id, so.order_no, so.customer, so.style, so.color, so.frame_line, so.board, so.remark,
                so.door_h AS hole_height, so.door_w AS hole_width, so.wall_thick,
                so.cut_door_height AS door_height, so.cut_door_width AS door_width,
                so.cut_mode AS mode, so.cut_status AS status, so.cut_date, so.cut_handler AS handler,
                so.cut_remark_tags AS remark_tags
           FROM sales_orders so
          ${clause} ORDER BY so.cut_date DESC, so.id DESC LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), (Number(page) - 1) * Number(pageSize)]
      )
    )[0];
    ok(res, { list: rows, total, page: Number(page), pageSize: Number(pageSize) });
  })
);

// 详情（按订单 id 取下料数据，字段映射回前端原命名）
router.get(
  '/:id',
  wrap(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT so.id, so.order_no, so.customer, so.style, so.color, so.frame_line, so.board, so.remark,
              so.door_h AS hole_height, so.door_w AS hole_width, so.wall_thick,
              so.cut_door_height AS door_height, so.cut_door_width AS door_width,
              so.cut_mode AS mode, so.cut_status AS status, so.cut_date, so.cut_handler AS handler,
              so.cut_remark_tags AS remark_tags
         FROM sales_orders so WHERE so.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return fail(res, '订单不存在');
    if (!rows[0].status) return fail(res, '该订单未生成下料单');
    ok(res, rows[0]);
  })
);

// 生成下料单（双模式：普通按 config 默认值算，特殊手填）
// 改为 UPDATE sales_orders 写下料字段（不再 INSERT 独立表）
router.post(
  '/',
  wrap(async (req, res) => {
    const { order_id, mode = 1, door_height, door_width, handler, remark_tags } = req.body;
    if (!order_id) return fail(res, '缺少订单 id');
    const [orders] = await pool.query(
      'SELECT id, door_h, door_w, wall_thick, cut_status FROM sales_orders WHERE id = ?',
      [order_id]
    );
    if (orders.length === 0) return fail(res, '订单不存在');
    const o = orders[0];
    if (o.cut_status) return fail(res, '该订单已有下料单，不可重复生成');
    if (o.door_h == null || o.door_w == null) return fail(res, '订单未录门洞尺寸，无法生成下料单');

    let finalDoorH, finalDoorW;
    if (Number(mode) === 2) {
      if (door_height == null || door_width == null) return fail(res, '特殊模式需手填门扇高/宽');
      finalDoorH = Number(door_height);
      finalDoorW = Number(door_width);
    } else {
      finalDoorH = Number(o.door_h) - Number(config.cutting.defaultHeightCut);
      finalDoorW = Number(o.door_w) - Number(config.cutting.defaultWidthCut);
    }

    await pool.query(
      `UPDATE sales_orders SET
        cut_door_height=?, cut_door_width=?, cut_mode=?, cut_status='待下料',
        cut_handler=?, cut_remark_tags=?
       WHERE id=?`,
      [finalDoorH, finalDoorW, Number(mode) === 2 ? 2 : 1, handler || null, remark_tags || null, order_id]
    );
    ok(res, { id: order_id }, '下料单已生成');
  })
);

// 编辑（师傅微调门扇尺寸 + 状态流转 待下料→已下料填 cut_date）
router.put(
  '/:id',
  wrap(async (req, res) => {
    const { door_height, door_width, status, cut_date, handler, remark_tags } = req.body;
    const [rows] = await pool.query('SELECT cut_status, cut_door_height, cut_door_width, cut_remark_tags, cut_date, cut_handler FROM sales_orders WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return fail(res, '订单不存在');
    const o = rows[0];
    if (!o.cut_status) return fail(res, '该订单未生成下料单');

    let finalStatus = o.cut_status;
    if (status === '已下料') {
      if (!cut_date) return fail(res, '标记已下料需填下料日期');
      finalStatus = '已下料';
    } else if (status === '待下料') {
      finalStatus = '待下料';
    }

    const finalTags = remark_tags === undefined ? o.cut_remark_tags : remark_tags || null;

    await pool.query(
      `UPDATE sales_orders SET
        cut_door_height=?, cut_door_width=?, cut_status=?, cut_date=?, cut_handler=?, cut_remark_tags=?
       WHERE id=?`,
      [
        door_height != null ? Number(door_height) : o.cut_door_height,
        door_width != null ? Number(door_width) : o.cut_door_width,
        finalStatus,
        cut_date || o.cut_date,
        handler || o.cut_handler,
        finalTags,
        req.params.id,
      ]
    );
    ok(res, null, '更新成功');
  })
);

// 删除下料单（清空订单的下料字段，订单本身保留）
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const [r] = await pool.query(
      `UPDATE sales_orders SET
        cut_door_height=NULL, cut_door_width=NULL, cut_mode=NULL, cut_status=NULL,
        cut_date=NULL, cut_handler=NULL, cut_remark_tags=NULL
       WHERE id=? AND cut_status IS NOT NULL`,
      [req.params.id]
    );
    if (r.affectedRows === 0) return fail(res, '下料单不存在');
    ok(res, null, '已删除下料单（订单保留）');
  })
);

module.exports = router;
