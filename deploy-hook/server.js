/**
 * 部署 Webhook 服务（独立轻量进程，与主业务服务隔离）
 *
 * 流程：收到带 token 的 POST /deploy（multipart zip 包）
 *       → 保存包 → 调 deploy.sh（备份原包/保留.env与uploads/解压新包/npm install/pm2 reload）
 *
 * 启动：node server.js  （建议 pm2 守护，见 ecosystem.config.js）
 *
 * 安全：X-Deploy-Token 头鉴权 + 仅接受 zip + 文件大小限制
 *       execFile 调脚本（不走 shell，防命令注入）
 */
const express = require('express');
const multer = require('multer');
const { execFile } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.HOOK_PORT || 3100;
const TOKEN = process.env.DEPLOY_TOKEN;
const SCRIPT = process.env.DEPLOY_SCRIPT || path.join(__dirname, 'deploy.sh');
const MAX_SIZE = Number(process.env.MAX_PKG_MB || 300) * 1024 * 1024;
const TMP_DIR = path.join(__dirname, 'uploads');

if (!TOKEN) {
  console.error('✗ 未配置 DEPLOY_TOKEN，请在 .env 设置随机长字符串后重启');
  process.exit(1);
}
fs.mkdirSync(TMP_DIR, { recursive: true });

// 固定时间比较，防时序攻击
function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// 鉴权中间件
app.use((req, res, next) => {
  if (!safeEqual(req.headers['x-deploy-token'] || '', TOKEN)) {
    return res.status(401).json({ error: 'token 无效或缺失' });
  }
  next();
});

// multer：随机文件名（防路径穿越/命令注入）+ 仅 zip + 大小限制
const upload = multer({
  storage: multer.diskStorage({
    destination: TMP_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext !== '.zip') return cb(new Error('仅支持 .zip 包'));
      // 不用原文件名，用随机串，避免中文/特殊字符进文件系统或 shell
      crypto.randomBytes(8, (e, buf) => {
        if (e) return cb(e);
        cb(null, `pkg-${buf.toString('hex')}.zip`);
      });
    },
  }),
  limits: { fileSize: MAX_SIZE },
});

// 触发部署
app.post('/deploy', upload.single('package'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未收到 package 文件（字段名须为 package）' });
  const pkg = req.file.path;

  // execFile：参数数组传递，不经 shell，避免命令注入
  execFile('bash', [SCRIPT, pkg], { maxBuffer: 4 * 1024 * 1024, timeout: 180000 }, (err, stdout, stderr) => {
    // 无论成败，清理临时包
    fs.rm(pkg, { force: true }, () => {});

    if (err) {
      console.error('[deploy] 失败:', err.message);
      return res.status(500).json({
        error: '部署失败（详见 log）',
        exit: err.code,
        stdout: stdout.toString(),
        stderr: stderr.toString(),
      });
    }
    res.json({ ok: true, log: stdout.toString() });
  });
});

// 健康检查（pm2/nginx 探活用，不鉴权，仅返回 ok）
app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`✓ deploy-hook listening on :${PORT}`);
  console.log(`  POST /deploy   (Header: X-Deploy-Token, field: package=@xxx.zip)`);
});
