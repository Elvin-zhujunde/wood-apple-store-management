const { verify } = require('../utils/jwt');
const { fail } = require('../utils/helpers');

// 校验 JWT，挂 req.user = { id, username, role, name }
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return fail(res, '未登录', 401, 401);
  try {
    req.user = verify(token);
    next();
  } catch (e) {
    return fail(res, '登录已过期，请重新登录', 401, 401);
  }
}

// 角色限制：requireRole('finance') 或 requireRole(['stock','finance'])
function requireRole(roles) {
  const list = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user || !list.includes(req.user.role)) {
      return fail(res, '无权限访问该功能', 403, 403);
    }
    next();
  };
}

module.exports = { auth, requireRole };
