const express = require('express');
const { pool } = require('../db/pool');
const { ok, wrap } = require('../utils/helpers');
const { auth } = require('../middlewares/auth');

const router = express.Router();
router.use(auth);

// ARE-109：BOM 管理模块下线（决策1=B，保留 door_bom / door_bom_items 表 + sales_orders.door_bom_id）。
// 仅保留只读 /all，供销售订单「门型」下拉取数。列表/详情/增删改随 doorBom.vue 页面一并移除。
router.get(
  '/all',
  wrap(async (req, res) => {
    const [rows] = await pool.query('SELECT id, code, name, standard_size, colors FROM door_bom ORDER BY id');
    ok(res, rows);
  })
);

module.exports = router;
