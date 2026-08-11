#!/usr/bin/env node
/**
 * 部署打包脚本（纯 Node，无第三方依赖）
 *
 * 在仓库根目录执行：  node deploy.js
 *
 * 作用：
 *   1. 构建前端（web/ → 仓库根 dist/）
 *   2. 拷贝前端产物 → deploy/dist
 *   3. 拷贝后端代码（server/，排除 node_modules 与 uploads 运行时数据）→ deploy/server
 *   4. 生成 deploy/部署说明.md
 *   5. 打包成 deploy-YYYYMMDD.zip，方便上传服务器
 *
 * 说明：内网 demo，server/.env（含 DB_PASSWORD）按用户选择一并打包。
 *      uploads 为运行时数据（用户上传图片），不打包，仅建空目录占位。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const WEB = path.join(ROOT, 'web');
const SERVER = path.join(ROOT, 'server');
const DIST = path.join(ROOT, 'dist');
const DEPLOY = path.join(ROOT, 'deploy');

// 部署说明内容（缩进式代码块，避免反引号转义）
const DEPLOY_README = [
  '# 木门加工企业库存与订单管理系统 - 部署说明',
  '',
  '> 内网 demo · Node.js 全栈',
  '',
  '## 目录结构',
  '',
  '    deploy/',
  '    ├── dist/                 # 前端构建产物（静态文件）',
  '    ├── server/               # 后端（Express + mysql2）',
  '    │   ├── src/',
  '    │   ├── .env              # 数据库配置（已从开发环境带入，按需修改）',
  '    │   ├── .env.example',
  '    │   ├── package.json',
  '    │   └── package-lock.json',
  '    └── 部署说明.md           # 本文件',
  '',
  '## 前置环境',
  '',
  '- Node.js >= 18',
  '- MySQL 5.7+ / 8.x',
  '',
  '## 后端部署',
  '',
  '    cd server',
  '    npm install                 # 安装依赖',
  '    # .env 已带入，按服务器实际情况修改：',
  '    #   DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME / JWT_SECRET',
  '    npm run db:init             # 建表（首次）',
  '    npm run db:seed             # 种子数据与默认账号（可选，仅首次）',
  '    npm start                   # 启动，默认 http://127.0.0.1:3001',
  '',
  '默认账号：sale / stock / finance，密码 123456。',
  '',
  '> uploads 目录用于存放上传的图片附件，已建空目录，首次上传自动写入。',
  '',
  '## 前端部署',
  '',
  'dist/ 为纯静态文件，用任意静态服务器托管：',
  '',
  '- Nginx：root 指向 dist/，并反代 /api 到后端：',
  '',
  '      location /api { proxy_pass http://127.0.0.1:3001; }',
  '',
  '- 或用 Node 简易托管：npx serve dist（仅内网临时）',
  '',
  '生产环境前后端同源（VITE_IMG_BASE= 留空），图片走相对路径 /uploads，由后端提供。',
  '',
  '## 备注',
  '',
  '- 本部署包为内网 demo，server/.env 含明文数据库密码，请勿公网暴露。',
  '- 如开放外网，需在 server/src/app.js 的 /uploads 路由加鉴权中间件。',
  '',
].join('\n');

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function step(msg) {
  console.log('\n■ ' + msg);
}

function stamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

// ---------- 0. 清理旧产物 ----------
step('清理旧 deploy/ 与 deploy-*.zip');
if (fs.existsSync(DEPLOY)) {
  fs.rmSync(DEPLOY, { recursive: true, force: true });
}
for (const f of fs.readdirSync(ROOT)) {
  if (/^deploy-\d{8}\.zip$/.test(f)) {
    fs.rmSync(path.join(ROOT, f), { force: true });
  }
}
fs.mkdirSync(DEPLOY, { recursive: true });

// ---------- 1. 构建前端 ----------
step('构建前端 (web/)');
if (!fs.existsSync(path.join(WEB, 'node_modules'))) {
  console.log('web/node_modules 不存在，先 npm install ...');
  run('npm install', WEB);
}
run('npm run build', WEB);
if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('✗ 前端构建失败：未找到 dist/index.html');
  process.exit(1);
}
console.log('✓ 前端构建完成 → dist/');

// ---------- 2. 拷贝前端产物 ----------
step('拷贝前端产物 → deploy/dist');
fs.cpSync(DIST, path.join(DEPLOY, 'dist'), { recursive: true });
console.log('✓ deploy/dist');

// ---------- 3. 拷贝后端代码（排除 node_modules、uploads 运行时数据）----------
step('拷贝后端代码 → deploy/server（排除 node_modules、uploads）');
fs.cpSync(SERVER, path.join(DEPLOY, 'server'), {
  recursive: true,
  filter: (src) => {
    const rel = path.relative(SERVER, src);
    if (!rel) return true; // server 根本身
    const top = rel.split(path.sep)[0];
    if (top === 'node_modules') return false;
    if (top === 'uploads') return false;
    return true;
  },
});
// 重建空 uploads 占位目录（multer 首次上传需要目录存在）
fs.mkdirSync(path.join(DEPLOY, 'server', 'uploads'), { recursive: true });
console.log('✓ deploy/server（含 .env、src/、package.json 等；uploads 为空占位）');

// ---------- 4. .env.example 放到 deploy 根（快速参考）----------
if (fs.existsSync(path.join(SERVER, '.env.example'))) {
  fs.cpSync(path.join(SERVER, '.env.example'), path.join(DEPLOY, '.env.example'));
}

// ---------- 5. 生成部署说明 ----------
step('生成 deploy/部署说明.md');
fs.writeFileSync(path.join(DEPLOY, '部署说明.md'), DEPLOY_README, 'utf8');
console.log('✓ deploy/部署说明.md');

// ---------- 6. 打包 zip ----------
const zipName = `deploy-${stamp()}.zip`;
const zipPath = path.join(ROOT, zipName);
step(`打包 zip → ${zipName}`);
try {
  // Compress-Archive -Path 'deploy' 把 deploy 目录本身打入（解压得到 deploy/）
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path 'deploy' -DestinationPath '${zipName}' -Force"`,
    { cwd: ROOT, stdio: 'inherit' }
  );
  console.log('✓ ' + zipPath);
} catch (e) {
  console.error('✗ 压缩失败（可手动压缩 deploy/ 目录）： ' + e.message);
}

// ---------- 汇总 ----------
console.log('\n============== 部署包完成 ==============');
console.log('目录: ' + DEPLOY);
console.log('压缩: ' + (fs.existsSync(zipPath) ? zipPath : '（失败，见上方提示）'));
console.log('下一步: 上传 zip 到服务器 → 解压 → 按 部署说明.md 操作');
console.log('======================================\n');
