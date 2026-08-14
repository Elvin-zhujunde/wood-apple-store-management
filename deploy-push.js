#!/usr/bin/env node
/**
 * 本地一键部署脚本（打包 → 上传触发 webhook → 服务器自动备份/解压/pm2 reload）
 *
 * 用法：
 *   node deploy-push.js                 # 默认：打包 + 触发 webhook
 *   node deploy-push.js --skip-build    # 跳过打包，直接用已有的 deploy-*.zip（改完代码只重传时用）
 *   node deploy-push.js --dry-run       # 只打包，不触发 webhook（看包是否正常）
 *
 * 配置来源（优先级：命令行/环境变量 > deploy-push.config.json > 默认）：
 *   WEBHOOK_URL   webhook 地址，如 http://47.120.58.23/deploy-hook/deploy
 *   DEPLOY_TOKEN  鉴权 token（与服务器 deploy-hook/.env 的 DEPLOY_TOKEN 一致）
 *
 * token 含敏感信息，不要写死在脚本里。两种安全注入方式：
 *   1. 项目根建 deploy-push.config.json（已 gitignore，不提交）：
 *        { "webhook": "http://...", "token": "xxx" }
 *   2. 环境变量：set DEPLOY_TOKEN=xxx  /  $env:DEPLOY_TOKEN="xxx"
 *   3. 交互输入：未配置时脚本会提示输入（不回显）
 */
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const https = require('https');
const http = require('http');

const ROOT = __dirname;
const CFG_FILE = path.join(ROOT, 'deploy-push.config.json');
const DEPLOY_DIR = path.join(ROOT, 'deploy');

// ---------- 配置加载 ----------
function loadConfig() {
  const cfg = { webhook: '', token: '' };
  // 1. config.json（本地私有，已 gitignore）
  if (fs.existsSync(CFG_FILE)) {
    try {
      const f = JSON.parse(fs.readFileSync(CFG_FILE, 'utf8'));
      cfg.webhook = f.webhook || cfg.webhook;
      cfg.token = f.token || cfg.token;
    } catch (e) {
      console.warn('⚠️ deploy-push.config.json 解析失败，已忽略：' + e.message);
    }
  }
  // 2. 环境变量覆盖
  cfg.webhook = process.env.WEBHOOK_URL || cfg.webhook;
  cfg.token = process.env.DEPLOY_TOKEN || cfg.token;
  return cfg;
}

function step(msg) { console.log('\n■ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

// ---------- 1. 打包（调 deploy.js） ----------
function build() {
  step('打包（执行 node deploy.js）');
  if (!fs.existsSync(path.join(ROOT, 'deploy.js'))) {
    console.error('✗ 未找到 deploy.js，请确认在仓库根目录运行');
    process.exit(1);
  }
  try {
    execSync('node deploy.js', { cwd: ROOT, stdio: 'inherit' });
  } catch (e) {
    console.error('✗ 打包失败');
    process.exit(1);
  }
  // deploy.js 产物是 deploy-YYYYMMDD.zip
  const zips = fs.readdirSync(ROOT)
    .filter(f => /^deploy-\d{8}\.zip$/.test(f))
    .map(f => ({ f, mtime: fs.statSync(path.join(ROOT, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (zips.length === 0) {
    console.error('✗ 打包后未找到 deploy-YYYYMMDD.zip');
    process.exit(1);
  }
  const zip = path.join(ROOT, zips[0].f);
  const size = (fs.statSync(zip).size / 1024 / 1024).toFixed(1);
  ok(`包：${zips[0].f} (${size} MB)`);
  return zip;
}

// 找已有 zip（--skip-build 用）
function findExistingZip() {
  const zips = fs.readdirSync(ROOT)
    .filter(f => /^deploy-\d{8}\.zip$/.test(f))
    .map(f => ({ f, mtime: fs.statSync(path.join(ROOT, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (zips.length === 0) {
    console.error('✗ 未找到已存在的 deploy-YYYYMMDD.zip，去掉 --skip-build 先打包');
    process.exit(1);
  }
  return path.join(ROOT, zips[0].f);
}

// ---------- 2. 触发 webhook（multipart 上传 zip） ----------
// 手搓 multipart/form-data，避免引入额外依赖；与 deploy-hook/server.js 的 multer 字段名 package 对齐
function triggerWebhook(url, token, zipPath) {
  return new Promise((resolve, reject) => {
    const boundary = '----wood-store-deploy' + Math.random().toString(16).slice(2);
    const fileName = path.basename(zipPath);
    const fileBuf = fs.readFileSync(zipPath);

    const head = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="package"; filename="${fileName}"\r\n` +
      `Content-Type: application/zip\r\n\r\n`
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([head, fileBuf, tail]);

    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
          'X-Deploy-Token': token,
        },
        timeout: 180000, // 3 分钟，部署含 npm install 可能较慢
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`webhook 返回 ${res.statusCode}: ${data.slice(0, 500)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('webhook 请求超时（>3分钟，可能部署仍在进行，查 pm2 logs deploy-hook）')); });
    req.write(body);
    req.end();
  });
}

// ---------- 主流程 ----------
async function main() {
  const args = process.argv.slice(2);
  const skipBuild = args.includes('--skip-build');
  const dryRun = args.includes('--dry-run');

  const cfg = loadConfig();

  const zipPath = skipBuild ? findExistingZip() : build();
  const size = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
  step(`准备部署包：${path.basename(zipPath)} (${size} MB)${skipBuild ? '（跳过打包，用已有）' : ''}`);

  if (dryRun) {
    ok('--dry-run 模式：不触发 webhook，打包完成即结束');
    console.log(`\n包路径：${zipPath}`);
    return;
  }

  // 校验配置：webhook 与 token 缺一不可
  if (!cfg.webhook || !cfg.token) {
    step('配置 webhook 地址与 token');
    if (!cfg.webhook) {
      process.stdout.write('  webhook 地址 (如 http://47.120.58.23/deploy-hook/deploy): ');
      cfg.webhook = readLine();
    }
    if (!cfg.token) {
      // token 敏感：建议走 config.json 或环境变量；这里兜底交互输入（Windows 终端会回显，属可接受折中）
      process.stdout.write('  DEPLOY_TOKEN: ');
      cfg.token = readLine();
    }
    console.log('\n  💡 免重复输入：建 deploy-push.config.json（已 gitignore，不提交）：');
    console.log(`  { "webhook": "${cfg.webhook}", "token": "<your-token>" }`);
  }

  step(`触发 webhook → ${cfg.webhook}`);
  console.log('  上传中（含 npm install 可能需 1-3 分钟，请耐心等待）...');
  try {
    const resp = await triggerWebhook(cfg.webhook, cfg.token, zipPath);
    ok('webhook 触发成功');
    // 尝试解析返回的部署日志
    try {
      const r = JSON.parse(resp);
      if (r.ok) {
        console.log('\n  📋 部署日志：');
        console.log(r.log.split('\n').map(l => '    ' + l).join('\n'));
      } else {
        console.log('  返回：' + resp.slice(0, 1000));
      }
    } catch {
      console.log('  返回：' + resp.slice(0, 1000));
    }
    console.log('\n✅ ====== 部署完成 ======');
  } catch (e) {
    console.error('\n✗ 部署失败：' + e.message);
    console.error('  排查：1) token 是否匹配服务器 deploy-hook/.env');
    console.error('       2) webhook 地址是否通（curl $WEBHOOK_URL/health）');
    console.error('       3) 服务器日志：pm2 logs deploy-hook --lines 50');
    process.exit(1);
  }
}

// 简易行读取（同步读 stdin，避免引入 readline-sync 依赖）
function readLine() {
  const buf = Buffer.alloc(1);
  let line = '';
  while (true) {
    const n = fs.readSync(0, buf, 0, 1);
    if (n === 0 || buf[0] === 0x0a || buf[0] === 0x0d) {
      if (buf[0] === 0x0d) { fs.readSync(0, buf, 0, 1); } // 吞掉 \r
      break;
    }
    line += buf.toString();
  }
  return line.trim();
}

main().catch((e) => { console.error('✗', e); process.exit(1); });
