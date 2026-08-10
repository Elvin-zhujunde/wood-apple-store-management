const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'wood-store-demo-secret';
const EXPIRES = process.env.JWT_EXPIRES || '7d';

function sign(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES });
}

function verify(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { sign, verify, SECRET };
