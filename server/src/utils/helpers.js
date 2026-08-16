// 统一响应 + 单据号生成
const { pool } = require('../db/pool');

function ok(res, data = null, msg = 'success') {
  res.json({ code: 0, msg, data });
}

function fail(res, msg = 'error', code = 1, status = 400) {
  res.status(status).json({ code, msg, data: null });
}

// 异步路由包装，自动捕获错误
function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch((e) => {
    console.error('ROUTE ERR:', e);
    fail(res, e.message || '服务器内部错误', 1, 500);
  });
}

/**
 * 生成单据号: prefix-YYYYMMDD-NNN
 * table: 表名, prefix: 前缀, dateField: 日期字段名
 */
async function genDocNo(table, prefix, dateField, conn) {
  const today = new Date();
  const ymd =
    today.getFullYear().toString() +
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0');
  const like = `${prefix}-${ymd}-%`;
  // conn 可选：事务内批量生成连续单号时须传事务连接，否则全局pool看不到未提交的前序单号会算出重复序号
  const q = conn || pool;
  const [rows] = await q.query(
    `SELECT ${dateField}_no AS no FROM ${table} WHERE ${dateField}_no LIKE ? ORDER BY id DESC LIMIT 1`,
    [like]
  );
  let seq = 1;
  if (rows.length > 0) {
    const lastSeq = parseInt(rows[0].no.split('-')[2], 10);
    seq = lastSeq + 1;
  }
  return `${prefix}-${ymd}-${String(seq).padStart(3, '0')}`;
}

module.exports = { ok, fail, wrap, genDocNo };
