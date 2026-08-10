// ARE-95 Excel 历史数据导入 —— 订单→sales_orders、材料支出→purchase_inbound
// 用法:
//   node import_excel.js --dry     预演:只读库+解析,输出对账报告,不写库
//   node import_excel.js --formal  正式:事务批量插入
// 敏感:Excel 文件本地解析,不外发;金额/姓名不打印原值,仅对账计数
const XLSX = require('C:/Users/Lenovo/Desktop/wood-apple-store-management/server/node_modules/xlsx');
const MOD = 'C:/Users/Lenovo/Desktop/wood-apple-store-management/server/node_modules';
require(MOD + '/dotenv').config({ path: 'C:/Users/Lenovo/Desktop/wood-apple-store-management/server/.env' });
const mysql = require(MOD + '/mysql2/promise');

// 用法: node import_excel.js [--dry|--formal] [excel文件路径]
// Excel 文件含敏感数据,不入仓库,通过参数或环境变量传入
const FILE = process.env.EXCEL_FILE || process.argv.find(a => !a.startsWith('-') && a.endsWith('.xlsx')) || './2026年木果订单.xlsx';
const MODE = process.argv.includes('--formal') ? 'formal' : 'dry';

// ---- 工具 ----
// "3.1"/"3.10 " → "2026-03-01"；非此格式返回 null
function parseDate(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{1,2})\.(\d{1,2})$/);
  if (!m) return null;
  return `2026-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}
const num = (v) => { const n = Number(String(v == null ? '' : v).trim()); return isNaN(n) ? 0 : n; };
const str = (v) => (v == null ? '' : String(v).trim());

// ---- 解析订单 sheet ----
function parseOrders(wb) {
  const ws = wb.Sheets['订单'];
  const j = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
  // 行1分组标题 行2真表头 行3空 数据从行4(idx3)
  const rows = j.slice(3).filter(r => r.some(c => c != null && c !== ''));
  const VALID_DOORS = ['MG', 'YX', 'FS']; // 合法门型code,id运行时查door_bom
  // 列idx: 0月份 3客户 5订单号 6门型 7高 8宽 9墙厚 10款式 11颜色 13数量 14板材 17发货 19应收 20已付 21欠款 22收款 23收据 24经手人
  const orders = [], errs = [];
  let unknownDoor = 0;
  for (const r of rows) {
    const door = str(r[6]);
    if (!VALID_DOORS.includes(door)) { unknownDoor++; errs.push({ row: str(r[5]), door, msg: '未知门型' }); continue; }
    const qty = num(r[13]);
    if (qty <= 0) { errs.push({ row: str(r[5]), msg: '数量为0' }); continue; }
    const due = num(r[19]), owe = num(r[21]);
    // 状态推导(互斥): 欠款=0且应收>0→已收款; 有发货日期且未全款→已发货; 无发货→新建
    let status, shipDate = null, payDate = null;
    if (owe === 0 && due > 0) { status = '已收款'; shipDate = parseDate(r[17]); payDate = parseDate(r[22]); }
    else if (str(r[17])) { status = '已发货'; shipDate = parseDate(r[17]); }
    else { status = '新建'; }
    const mn = str(r[0]).replace(/[^0-9]/g, '');
    const mNum = Number(mn);
    const orderDate = (mNum >= 1 && mNum <= 12) ? `2026-${String(mNum).padStart(2, '0')}-01` : null;
    const handler = str(r[24]) || '历史导入';
    orders.push({
      order_no: str(r[5]),
      customer: str(r[3]) || '未填',
      door_code: door, door_bom_id: null, color: str(r[11]) || '默认',
      qty, unit_price: qty ? Math.round((due / qty) * 100) / 100 : 0, total_amount: due,
      handler_sale: handler, order_date: orderDate,
      actual_ship_date: shipDate, handler_ship: shipDate ? handler : null,
      pay_date: payDate, receipt_no: str(r[23]) || null, handler_finance: payDate ? handler : null,
      door_h: num(r[7]) || null, door_w: num(r[8]) || null, wall_thick: num(r[9]) || null,
      style: str(r[10]) || null, board: str(r[14]) || null, status
    });
  }
  return { orders, errs, unknownDoor, rawCount: rows.length };
}

// ---- 解析材料支出 sheet ----
function parseInbounds(wb) {
  const ws = wb.Sheets['材料支出'];
  const j = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
  const rows = j.slice(1).filter(r => r.some(c => c != null && c !== ''));
  // 列idx: 0日期 2供应商 3名称 8数量 9单价 12付款金额 13付款日期 14单号 15付款人
  const inbounds = [];
  const usedNo = new Set(); // inbound_no 全局去重(单号可能非连续重复)
  let curGroup = null, curDate = null, curPaid = 0, curPayDate = null, glc = 0, impC = 0;
  for (const r of rows) {
    const no = str(r[14]), dt = str(r[0]);
    if (no) {
      if (no === curGroup) { glc++; }
      else { curGroup = no; glc = 0; curDate = dt || null; curPaid = num(r[12]); curPayDate = str(r[13]); }
    } else if (dt) {
      impC++; curGroup = 'IMP-' + impC; glc = 0; curDate = dt; curPaid = num(r[12]); curPayDate = str(r[13]);
    } else { glc++; }
    let inbound_no = glc === 0 ? curGroup : `${curGroup}-${glc + 1}`;
    // 碰撞去重:已存在则追加 -seq
    if (usedNo.has(inbound_no)) {
      let s = 2; while (usedNo.has(`${curGroup}-${s}`)) s++;
      inbound_no = `${curGroup}-${s}`;
    }
    usedNo.add(inbound_no);
    // 历史支出:钱已花料已收,统一标已到货;到货日期=付款日期||采购日期
    // 采购日期兜底:curDate||本行dt||付款日期||2026-03-01(仅4行首行日期空)
    const pDate = parseDate(curDate) || parseDate(dt) || parseDate(curPayDate) || '2026-03-01';
    const arrDate = curPayDate ? parseDate(curPayDate) : pDate;
    const status = '已到货';
    const name = str(r[3]);
    if (!name) { continue; } // 跳过无名称行
    inbounds.push({
      inbound_no, name, supplier: str(r[2]) || '未知',
      qty: num(r[8]), unit_price: num(r[9]),
      purchase_date: pDate,
      actual_arrival: arrDate, handler: str(r[15]) || '历史导入', status
    });
  }
  return { inbounds, rawCount: rows.length };
}

// ---- 主流程 ----
(async () => {
  console.log(`\n===== ARE-95 Excel 导入 [${MODE.toUpperCase()}] =====`);
  const wb = XLSX.readFile(FILE, { cellDates: true });

  const { orders, errs, unknownDoor, rawCount: orderRaw } = parseOrders(wb);
  const { inbounds, rawCount: inbRaw } = parseInbounds(wb);

  // 订单号唯一性检查
  const noMap = {}; let dupNo = 0;
  for (const o of orders) { noMap[o.order_no] = (noMap[o.order_no] || 0) + 1; }
  const dupList = Object.entries(noMap).filter(([k, v]) => v > 1);
  dupNo = dupList.reduce((s, [, v]) => s + v, 0);

  // 状态分布
  const stStat = orders.reduce((a, o) => { a[o.status] = (a[o.status] || 0) + 1; return a; }, {});
  const doorStat = orders.reduce((a, o) => { a[o.door_code] = (a[o.door_code] || 0) + 1; return a; }, {});
  const inbStat = inbounds.reduce((a, x) => { a[x.status] = (a[x.status] || 0) + 1; return a; }, {});

  // 连库:读现有物料 + (formal时建新物料+插入)
  const pool = mysql.createPool({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, charset: 'utf8mb4'
  });
  const conn = await pool.getConnection();

  const [mRows] = await conn.query('SELECT id,code,name,unit FROM materials ORDER BY id');
  const matMap = new Map(mRows.map(m => [m.name, m.id]));
  const [bRows] = await conn.query('SELECT id,code,name FROM door_bom ORDER BY id');
  // 动态解析 door_code → door_bom_id(不硬编码id,换库不断)
  const bomMap = {}; bRows.forEach(b => { bomMap[b.code] = b.id; });
  let bomMiss = 0;
  for (const o of orders) {
    o.door_bom_id = bomMap[o.door_code];
    if (!o.door_bom_id) bomMiss++;
  }
  if (bomMiss) { console.error(`❌ door_bom 缺失 ${bomMiss} 个门型code,先在 door_bom 表建 MG/YX/FS`); await conn.release(); await pool.end(); process.exit(1); }

  // 物料匹配预演
  const needNames = [...new Set(inbounds.map(x => x.name))];
  const missNames = needNames.filter(n => !matMap.has(n));

  console.log('\n----- 订单对账 -----');
  console.log(`Excel有效行: ${orderRaw} | 可导入: ${orders.length} | 跳过(未知门型/数量0): ${errs.length}`);
  console.log(`未知门型行数: ${unknownDoor}`);
  console.log(`状态分布: ${JSON.stringify(stStat)}`);
  console.log(`门型分布(code): ${JSON.stringify(doorStat)} | BOM表: ${JSON.stringify(bRows.map(b => b.code))}`);
  console.log(`订单号重复: ${dupList.length}个单号共${dupNo}行 (将追加 -序号)`);
  if (dupList.length) console.log(`  重复单号样本: ${JSON.stringify(dupList.slice(0, 5))}`);
  console.log(`错误样本(前5): ${JSON.stringify(errs.slice(0, 5))}`);

  console.log('\n----- 材料支出对账 -----');
  console.log(`Excel有效行: ${inbRaw} | 可导入: ${inbounds.length}`);
  console.log(`状态分布: ${JSON.stringify(inbStat)}`);
  console.log(`唯一物料名: ${needNames.length} | 已匹配: ${needNames.length - missNames.length} | 待新建: ${missNames.length}`);
  console.log(`待新建物料(前15): ${JSON.stringify(missNames.slice(0, 15))}`);

  // 订单样本
  console.log('\n----- 订单样本(前2,脱敏金额量级) -----');
  orders.slice(0, 2).forEach((o, i) => {
    const mask = (n) => n >= 10000 ? `[${(n / 10000).toFixed(1)}万]` : n >= 1000 ? '[千元级]' : '[百元级]';
    console.log(`#${i + 1} ${o.order_no} 门型bom${o.door_bom_id} 数量${o.qty} 应收${mask(o.total_amount)} 状态${o.status} 下单${o.order_date} 发货${o.actual_ship_date} 收款${o.pay_date} 尺寸${o.door_h}x${o.door_w}x${o.wall_thick} 款式${o.style} 板材${o.board}`);
  });

  if (MODE === 'dry') {
    console.log('\n[DRY-RUN] 未写库。确认无误后运行: node import_excel.js --formal');
    await conn.release(); await pool.end();
    return;
  }

  // ===== 正式导入 =====
  console.log('\n----- 开始正式导入(事务) -----');
  await conn.beginTransaction();
  try {
    // 1. 建新物料
    let newMatSeq = 100;
    const newMatLog = [];
    for (const n of missNames) {
      const code = 'IMP-' + (newMatSeq++);
      const [r] = await conn.query(
        'INSERT INTO materials (code,name,category,spec,unit,stock_qty,safety_stock) VALUES (?,?,"主材","待补","张",0,0)',
        [code, n]
      );
      matMap.set(n, r.insertId);
      newMatLog.push({ code, name: n, id: r.insertId });
    }
    console.log(`✅ 新建物料 ${newMatLog.length} 条`);

    // 2. 插入订单(重复单号追加 -序号)
    const usedNo = new Set();
    let ordInsert = 0;
    const ordSQL = `INSERT INTO sales_orders
      (order_no,customer,door_bom_id,color,qty,unit_price,total_amount,handler_sale,order_date,
       expected_ship_date,actual_ship_date,ship_no,handler_ship,pay_date,receipt_no,handler_finance,
       door_h,door_w,wall_thick,style,board,status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    for (const o of orders) {
      let no = o.order_no || `IMP-ORD-${ordInsert + 1}`;
      if (usedNo.has(no)) {
        let s = 2; while (usedNo.has(`${no}-${s}`)) s++; no = `${no}-${s}`;
      }
      usedNo.add(no);
      await conn.query(ordSQL, [
        no, o.customer, o.door_bom_id, o.color, o.qty, o.unit_price, o.total_amount, o.handler_sale, o.order_date,
        null, o.actual_ship_date, null, o.handler_ship, o.pay_date, o.receipt_no, o.handler_finance,
        o.door_h, o.door_w, o.wall_thick, o.style, o.board, o.status
      ]);
      ordInsert++;
    }
    console.log(`✅ 插入订单 ${ordInsert} 条`);

    // 3. 插入采购入库 + 同步库存
    let inbInsert = 0, stockAdj = 0;
    const inbSQL = `INSERT INTO purchase_inbound
      (inbound_no,material_id,supplier,qty,unit_price,freight,purchase_date,expected_arrival,actual_arrival,handler,status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`;
    const logSQL = `INSERT INTO inventory_log (material_id,change_type,qty,ref_no,operator) VALUES (?,"in",?,?,?)`;
    for (const x of inbounds) {
      const mid = matMap.get(x.name);
      if (!mid) { continue; }
      const [r] = await conn.query(inbSQL, [
        x.inbound_no, mid, x.supplier, x.qty, x.unit_price, 0,
        x.purchase_date, null, x.actual_arrival, x.handler, x.status
      ]);
      if (x.status === '已到货') {
        await conn.query('UPDATE materials SET stock_qty = stock_qty + ? WHERE id = ?', [x.qty, mid]);
        await conn.query(logSQL, [mid, x.qty, x.inbound_no, '历史导入']);
        stockAdj++;
      }
      inbInsert++;
    }
    console.log(`✅ 插入采购入库 ${inbInsert} 条 (其中已到货同步库存 ${stockAdj} 条)`);

    await conn.commit();
    console.log('\n🎉 导入完成,事务已提交。');

    // 对账查询
    const [c1] = await conn.query('SELECT COUNT(*) c FROM sales_orders');
    const [c2] = await conn.query('SELECT COUNT(*) c FROM purchase_inbound');
    const [c3] = await conn.query('SELECT COUNT(*) c FROM materials');
    const [c4] = await conn.query('SELECT status, COUNT(*) c FROM sales_orders GROUP BY status');
    const [c5] = await conn.query('SELECT b.code, COUNT(*) c FROM sales_orders o JOIN door_bom b ON o.door_bom_id=b.id GROUP BY b.code');
    const [c6] = await conn.query("SELECT COUNT(*) c FROM sales_orders WHERE customer LIKE '%\uFFFD%' OR customer REGEXP '[^ -~\\u4e00-\\u9fa5]'");
    console.log(`\n----- 库内对账 -----`);
    console.log(`sales_orders: ${c1[0].c} | purchase_inbound: ${c2[0].c} | materials: ${c3[0].c}`);
    console.log(`订单状态: ${JSON.stringify(c4.map(x => x.status + ':' + x.c))}`);
    console.log(`门型分布: ${JSON.stringify(c5.map(x => x.code + ':' + x.c))}`);
    console.log(`乱码检查(U+FFFD/非常规字符): ${c6[0].c}`);
    await conn.release(); await pool.end();
  } catch (e) {
    await conn.rollback();
    console.error('\n❌ 导入失败,已回滚:', e.message);
    await conn.release(); await pool.end();
    process.exit(1);
  }
})();
