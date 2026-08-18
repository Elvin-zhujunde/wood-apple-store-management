// 操作日志中间件：拦截 POST/PUT/DELETE，请求结束后异步写 operation_logs 表
// 零业务侵入：挂在 app.js 所有 /api/* 路由前，业务路由代码完全不动
// 策略：只记写操作(GET 不记)；全量保留(不清理)；只存关键摘要不存完整 body
const { pool } = require('../db/pool');

// 路径前缀 → 业务模块名映射（module/action 用于日志可读性）
const MODULE_MAP = [
  ['/api/auth', '认证'],
  ['/api/materials', '物料档案'],
  ['/api/door-bom', '门型BOM'],
  ['/api/sales-orders', '销售订单'],
  ['/api/cutting-list', '下料单'],
  ['/api/purchase-inbound', '采购入库'],
  ['/api/requisition', '生产领料'],
  ['/api/inventory', '库存'],
  ['/api/dashboard', '工作台'],
  ['/api/purchase-suggestion', '采购建议'],
  ['/api/attachments', '图片附件'],
  ['/api/customers', '客户档案'],
  ['/api/measure', '测量记录'],
  ['/api/users', '用户管理'],
  ['/api/operation-logs', '操作日志'],
];

function resolveModule(path) {
  for (const [prefix, name] of MODULE_MAP) {
    if (path.startsWith(prefix)) return name;
  }
  return '其他';
}

// method + 路径特征 → 动作
function resolveAction(method, path) {
  // 路径末段是纯数字 → 针对 :id 的更新/删除
  const segs = path.split('/').filter(Boolean);
  const last = segs[segs.length - 1];
  const lastIsId = /^\d+$/.test(last);
  if (method === 'DELETE') return '删除';
  if (method === 'POST') {
    // POST 到 :id/子动作 视为操作（如 /measure/:id/convert 转单）
    if (segs.includes('batch') || last === 'batch') return '批量操作';
    if (lastIsId) return '操作';
    return '创建';
  }
  if (method === 'PUT') {
    if (segs.includes('batch') || last === 'batch') return '批量操作';
    if (last === 'confirm') return '确认到货';
    if (last === 'reopen') return '反结';
    if (last === 'status') return '改状态';
    if (last === 'password') return '重置密码';
    if (last === 'ship') return '发货';
    if (last === 'pay') return '收款';
    if (last === 'adopt') return '采纳建议';
    if (lastIsId) return '更新';
    return '更新';
  }
  return method;
}

// 从路径取 target_id（第一个纯数字段，通常是 :id）
function resolveTargetId(path) {
  const segs = path.split('/').filter(Boolean);
  for (const s of segs) {
    if (/^\d+$/.test(s)) return Number(s);
  }
  return null;
}

// 从 body 取关键摘要（按模块挑有用字段，不存全 body，防敏感泄露）
function resolveDetail(method, path, body) {
  if (!body || typeof body !== 'object') return null;
  const parts = [];
  // 通用关键字段
  if (body.order_no) parts.push(`单号:${body.order_no}`);
  if (body.inbound_no) parts.push(`单号:${body.inbound_no}`);
  if (body.req_no) parts.push(`单号:${body.req_no}`);
  if (body.customer) parts.push(`客户:${body.customer}`);
  if (body.customer_name) parts.push(`客户:${body.customer_name}`);
  if (body.name && !body.customer) parts.push(`名称:${body.name}`);
  if (body.username) parts.push(`账号:${body.username}`);
  if (body.code) parts.push(`编码:${body.code}`);
  if (body.status) parts.push(`状态:${body.status}`);
  if (body.qty != null) parts.push(`数量:${body.qty}`);
  if (body.unit_price != null) parts.push(`单价:${body.unit_price}`);
  // 批量操作存条数
  if (Array.isArray(body.ids)) parts.push(`选中:${body.ids.length}条`);
  if (Array.isArray(body.items)) parts.push(`选中:${body.items.length}条`);
  return parts.length ? parts.join(' ') : null;
}

function operationLog(req, res, next) {
  // 只记写操作，GET 放行不记
  const method = req.method;
  if (method !== 'POST' && method !== 'PUT' && method !== 'DELETE') {
    return next();
  }
  const path = req.path;
  // 健康检查 / 非业务路径不记
  if (path === '/' || path === '/api' || !path.startsWith('/api/')) {
    return next();
  }

  // 响应结束后异步写日志（不阻塞业务响应）
  // 记录原始 end 引用，在 finish 事件里取 status code
  res.on('finish', () => {
    const status = res.statusCode >= 200 && res.statusCode < 300 ? '成功' : '失败';
    const log = {
      userId: req.user ? req.user.id : null,
      userName: req.user ? req.user.name : null,
      method,
      path,
      module: resolveModule(path),
      action: resolveAction(method, path),
      targetId: resolveTargetId(path),
      status,
      ip: req.ip || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null,
      detail: resolveDetail(method, path, req.body),
    };
    // 异步写，失败仅控制台告警，不影响业务
    pool
      .query(
        `INSERT INTO operation_logs
         (user_id, user_name, method, path, module, action, target_id, status, ip, detail)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [log.userId, log.userName, log.method, log.path, log.module, log.action, log.targetId, log.status, log.ip, log.detail]
      )
      .catch((e) => console.error('LOG WRITE ERR:', e.message));
  });

  next();
}

module.exports = operationLog;
