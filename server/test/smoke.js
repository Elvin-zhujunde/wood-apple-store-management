// 端到端冒烟测试：完整业务闭环验证
const BASE = 'http://127.0.0.1:3001';
let token = '';
let saleToken = '', financeToken = '', stockToken = '';

async function req(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers.Authorization = 'Bearer ' + token;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  const j = await res.json();
  return j;
}
function log(label, j) {
  const ok = j.code === 0;
  console.log(`${ok ? '✅' : '❌'} ${label}: ${ok ? j.msg || 'ok' : j.msg}`);
  return j;
}

(async () => {
  console.log('=== 1. 三角色登录 ===');
  let r = await req('POST', '/api/auth/login', { username: 'sale', password: '123456' });
  saleToken = r.data.token;
  log('sale登录', r);
  r = await req('POST', '/api/auth/login', { username: 'stock', password: '123456' });
  stockToken = r.data.token;
  log('stock登录', r);
  r = await req('POST', '/api/auth/login', { username: 'finance', password: '123456' });
  financeToken = r.data.token;
  log('finance登录', r);

  // 用 stock 角色做物料/采购/领料操作（有权限）
  token = stockToken;

  console.log('\n=== 2. 查物料+BOM ===');
  r = await req('GET', '/api/materials/all');
  log('物料all(' + r.data.length + '种)', r);
  const panel = r.data.find(m => m.code === 'CL-001');
  r = await req('GET', '/api/door-bom/all');
  log('门型all', r);
  const bomId = r.data[0].id;
  r = await req('GET', '/api/door-bom/' + bomId);
  log('BOM详情(明细' + r.data.items.length + '项)', r);

  console.log('\n=== 3. 采购入库 -> 确认到货(库存+) ===');
  const stockBefore = (await req('GET', '/api/inventory')).data.find(m => m.id === panel.id).stock_qty;
  console.log('   面板库存前:', stockBefore);
  r = await req('POST', '/api/purchase-inbound', {
    material_id: panel.id, supplier: '测试板材厂', qty: 100, unit_price: 80,
    freight: 200, purchase_date: '2026-08-10', expected_arrival: '2026-08-12', handler: '李库管'
  });
  log('创建入库单', r);
  const inboundId = r.data.id;
  r = await req('PUT', '/api/purchase-inbound/' + inboundId + '/confirm', { actual_arrival: '2026-08-12' });
  log('确认到货', r);
  const stockAfter = (await req('GET', '/api/inventory')).data.find(m => m.id === panel.id).stock_qty;
  console.log('   面板库存后:', stockAfter, '(应 +100)');

  console.log('\n=== 4. 销售订单(接单) -> 自动采购建议 ===');
  token = saleToken;
  r = await req('POST', '/api/sales-orders', {
    customer: '张老板家装', door_bom_id: bomId, color: '肤感白',
    qty: 50, unit_price: 1200, handler_sale: '张销售',
    order_date: '2026-08-10', expected_ship_date: '2026-08-13'
  });
  log('接单', r);
  const orderId = r.data.id;
  console.log('   采购建议生成数:', r.data.suggestion ? r.data.suggestion.generated : 0);
  if (r.data.suggestion && r.data.suggestion.suggestions.length) {
    r.data.suggestion.suggestions.forEach(s => console.log('   -', s.material_name, '建议采购', s.suggest_qty, s.unit || '', s.priority));
  }

  console.log('\n=== 5. 查采购建议列表 ===');
  r = await req('GET', '/api/purchase-suggestion?status=待采购');
  log('采购建议列表(' + r.data.list.length + '条)', r);

  console.log('\n=== 6. 生产领料(库存-) + 库存不足校验 ===');
  token = stockToken;
  r = await req('POST', '/api/requisition', {
    order_id: orderId, material_id: panel.id, qty: 5, req_date: '2026-08-10', handler: '生产老王'
  });
  log('领料5张', r);
  const stockAfterReq = (await req('GET', '/api/inventory')).data.find(m => m.id === panel.id).stock_qty;
  console.log('   面板库存领料后:', stockAfterReq, '(应 -5)');
  // 故意领超
  r = await req('POST', '/api/requisition', {
    order_id: orderId, material_id: panel.id, qty: 999999, req_date: '2026-08-10', handler: '生产老王'
  });
  log('领料超量(应失败)', r);

  console.log('\n=== 7. 发货回填 -> 状态流转 ===');
  token = saleToken;
  r = await req('PUT', '/api/sales-orders/' + orderId, {
    customer: '张老板家装', door_bom_id: bomId, color: '肤感白',
    qty: 50, unit_price: 1200, expected_ship_date: '2026-08-13',
    actual_ship_date: '2026-08-13', ship_no: 'SF20260813001', handler_ship: '李库管'
  });
  log('发货回填(应已发货)', r);

  console.log('\n=== 8. 收款回填 -> 状态流转(财务角色) ===');
  token = financeToken;
  r = await req('PUT', '/api/sales-orders/' + orderId, {
    customer: '张老板家装', door_bom_id: bomId, color: '肤感白',
    qty: 50, unit_price: 1200, expected_ship_date: '2026-08-13',
    actual_ship_date: '2026-08-13', ship_no: 'SF20260813001', handler_ship: '李库管',
    pay_date: '2026-08-14', receipt_no: 'REC-001', handler_finance: '王财务'
  });
  log('收款回填(应已收款)', r);

  console.log('\n=== 9. 订单详情+库存总表 ===');
  r = await req('GET', '/api/sales-orders/' + orderId);
  log('订单详情(状态=' + r.data.status + ')', r);
  r = await req('GET', '/api/inventory');
  log('库存总表(' + r.data.length + '种)', r);

  console.log('\n=== 全流程冒烟测试完成 ===');
})().catch(e => { console.error('💥 测试异常:', e.message); process.exit(1); });
