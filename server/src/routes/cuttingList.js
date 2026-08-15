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

// 加工备注标签联想：全量去重数组（静态路径，须在 /:id 之前声明）
router.get(
  '/tags',
  wrap(async (req, res) => {
    const [rows] = await pool.query("SELECT remark_tags FROM cutting_list WHERE remark_tags IS NOT NULL AND remark_tags != ''");
    const set = new Set();
    for (const row of rows) {
      try {
        const arr = JSON.parse(row.remark_tags);
        if (Array.isArray(arr)) arr.forEach((s) => { if (typeof s === 'string' && s) set.add(s); });
      } catch {}
    }
    ok(res, [...set].sort());
  })
);

// 列表（分页+筛选，LEFT JOIN sales_orders 带 13 列展示字段）
router.get(
  '/',
  wrap(async (req, res) => {
    const { status, order_no, customer, startDate, endDate, ids, page = 1, pageSize = 20 } = req.query;
    const where = [];
    const params = [];
    if (status) { where.push('cl.status = ?'); params.push(status); }
    if (order_no) { where.push('so.order_no LIKE ?'); params.push(`%${order_no}%`); }
    if (customer) { where.push('so.customer LIKE ?'); params.push(`%${customer}%`); }
    if (startDate) { where.push('cl.created_at >= ?'); params.push(startDate); }
    if (endDate) { where.push('cl.created_at <= ?'); params.push(endDate); }
    // ARE-112：按 id 批量取数（打印单张/台账共用）
    if (ids) {
      const idArr = String(ids).split(',').map((s) => parseInt(s, 10)).filter((n) => !isNaN(n));
      if (idArr.length) {
        where.push(`cl.id IN (${idArr.map(() => '?').join(',')})`);
        params.push(...idArr);
      }
    }
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

// 生成下料单（ARE-111：双模式，普通按 config 默认值算，特殊手填）
router.post(
  '/',
  wrap(async (req, res) => {
    const { order_id, mode = 1, door_height, door_width, handler, remark_tags } = req.body;
    if (!order_id) return fail(res, '缺少订单 id');
    // 取订单门洞尺寸（快照源）
    const [orders] = await pool.query(
      'SELECT id, door_h, door_w, wall_thick FROM sales_orders WHERE id = ?',
      [order_id]
    );
    if (orders.length === 0) return fail(res, '订单不存在');
    const o = orders[0];
    if (o.door_h == null || o.door_w == null) return fail(res, '订单未录门洞尺寸，无法生成下料单');

    // 计算门扇尺寸
    let finalDoorH, finalDoorW;
    if (Number(mode) === 2) {
      // 特殊模式：手填
      if (door_height == null || door_width == null) return fail(res, '特殊模式需手填门扇高/宽');
      finalDoorH = Number(door_height);
      finalDoorW = Number(door_width);
    } else {
      // 普通模式：按 config 默认值自动扣尺
      finalDoorH = Number(o.door_h) - Number(config.cutting.defaultHeightCut);
      finalDoorW = Number(o.door_w) - Number(config.cutting.defaultWidthCut);
    }

    try {
      const [r] = await pool.query(
        `INSERT INTO cutting_list
          (order_id, hole_height, hole_width, wall_thickness, door_height, door_width, mode, handler, remark_tags)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [order_id, o.door_h, o.door_w, o.wall_thick, finalDoorH, finalDoorW, Number(mode) === 2 ? 2 : 1, handler || null, remark_tags || null]
      );
      ok(res, { id: r.insertId }, '下料单已生成');
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return fail(res, '该订单已有下料单，不可重复生成');
      throw e;
    }
  })
);

// 编辑（师傅微调门扇尺寸 + 状态流转 待下料→已下料填 cut_date）
router.put(
  '/:id',
  wrap(async (req, res) => {
    const { door_height, door_width, status, cut_date, handler, remark_tags } = req.body;
    const [rows] = await pool.query('SELECT * FROM cutting_list WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return fail(res, '下料单不存在');
    const cl = rows[0];

    // 状态流转校验：标记已下料必须填下料日期
    let finalStatus = cl.status;
    if (status === '已下料') {
      if (!cut_date) return fail(res, '标记已下料需填下料日期');
      finalStatus = '已下料';
    } else if (status === '待下料') {
      finalStatus = '待下料';
    }

    // remark_tags：undefined=不动；null/数组=写库（前端传 stringify 字符串数组）
    const finalTags = remark_tags === undefined ? cl.remark_tags : remark_tags || null;

    await pool.query(
      `UPDATE cutting_list SET door_height=?, door_width=?, status=?, cut_date=?, handler=?, remark_tags=? WHERE id=?`,
      [
        door_height != null ? Number(door_height) : cl.door_height,
        door_width != null ? Number(door_width) : cl.door_width,
        finalStatus,
        cut_date || cl.cut_date,
        handler || cl.handler,
        finalTags,
        req.params.id,
      ]
    );
    ok(res, null, '更新成功');
  })
);

// 删除下料单（一单一单可重建，物理删除）
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const [r] = await pool.query('DELETE FROM cutting_list WHERE id = ?', [req.params.id]);
    if (r.affectedRows === 0) return fail(res, '下料单不存在');
    ok(res, null, '已删除');
  })
);

module.exports = router;
