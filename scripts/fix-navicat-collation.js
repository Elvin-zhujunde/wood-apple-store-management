// 修复 Navicat 导出 SQL 的 collation 不兼容问题，统一降到 utf8mb4_unicode_ci
// （MySQL 5.5+ / MariaDB / 8.x 通用）。解决两类导入报错：
//   1) ERROR 1253 ... is not valid for CHARACTER SET 'utf8mb4'
//      —— utf8mb4 字符集却配了 utf8_unicode_ci（属 utf8mb3），MySQL 8 拒收
//   2) ERROR 1273 Unknown collation: 'utf8mb4_0900_ai_ci'
//      —— MySQL 8.0+ 的 0900 collation，目标 <8.0 或 MariaDB 不认
//
// 修改规则：
//   - utf8_unicode_ci：仅当与 utf8mb4 成对出现才改（配对模式，needle 含 utf8mb4 前缀），
//     保护真正的 utf8(utf8mb3) 列上合法的 utf8_unicode_ci 不被误伤。
//   - utf8mb4_0900_*：0900 系列只有 utf8mb4 版本，不存在「真正 utf8mb3 上配 0900」的合法情况，
//     直接裸替换，安全。
// 全程 Buffer 字节替换，不解码/重编码，不碰中文/mojibake 字节，幂等可重复运行。
//
// 用法：
//   node fix-navicat-collation.js [sql文件路径] [--check]
//   不传路径默认修仓库根的 wood_store.sql；--check 只统计不写盘。
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const dryRun = args.includes('--check');
const file = args.find((a) => !a.startsWith('-')) || path.join(__dirname, '..', 'wood_store.sql');

if (!fs.existsSync(file)) {
  console.error('❌ 找不到文件:', file);
  process.exit(1);
}

// 替换规则：每条 {from, to, label}，统一 Buffer.indexOf 字节匹配。
// 规则 1/2 配对（含 utf8mb4 前缀）以保护真正的 utf8mb3 列；规则 3+ 0900 系列裸替换（必 utf8mb4）。
const RULES = [
  { from: 'utf8mb4 COLLATE utf8_unicode_ci',   to: 'utf8mb4 COLLATE utf8mb4_unicode_ci',   label: 'utf8_unicode_ci 列级(配utf8mb4)' },
  { from: 'utf8mb4 COLLATE = utf8_unicode_ci', to: 'utf8mb4 COLLATE = utf8mb4_unicode_ci', label: 'utf8_unicode_ci 表级(配utf8mb4)' },
  { from: 'utf8mb4_0900_ai_ci', to: 'utf8mb4_unicode_ci', label: 'utf8mb4_0900_ai_ci (MySQL8.0专有)' },
  { from: 'utf8mb4_0900_as_ci', to: 'utf8mb4_unicode_ci', label: 'utf8mb4_0900_as_ci (MySQL8.0专有)' },
  { from: 'utf8mb4_0900_as_cs', to: 'utf8mb4_unicode_ci', label: 'utf8mb4_0900_as_cs (MySQL8.0专有)' },
  { from: 'utf8mb4_0900_bin',   to: 'utf8mb4_unicode_ci', label: 'utf8mb4_0900_bin (MySQL8.0专有)' },
].map((r) => ({ ...r, from: Buffer.from(r.from), to: Buffer.from(r.to) }));

function countOccurrences(haystack, needle) {
  let n = 0;
  let i = 0;
  while ((i = haystack.indexOf(needle, i)) !== -1) {
    n++;
    i += needle.length;
  }
  return n;
}

let buf = fs.readFileSync(file);
const beforeSize = buf.length;

let totalFixed = 0;
const perRule = [];
for (const r of RULES) {
  let n = 0;
  for (;;) {
    const idx = buf.indexOf(r.from);
    if (idx === -1) break;
    buf = Buffer.concat([buf.subarray(0, idx), r.to, buf.subarray(idx + r.from.length)]);
    n++;
  }
  perRule.push({ label: r.label, n });
  totalFixed += n;
}

// 修复后 collation 分布：已知坏 collation 残留 + 目标 collation 计数
const CHECK = [
  'utf8_unicode_ci',
  'utf8mb4_0900_ai_ci', 'utf8mb4_0900_as_ci', 'utf8mb4_0900_as_cs', 'utf8mb4_0900_bin',
  'utf8mb4_unicode_ci',
];
const final = CHECK.map((c) => ({ c, n: countOccurrences(buf, Buffer.from(c)) }));

if (!dryRun) fs.writeFileSync(file, buf);

const tag = dryRun ? '[dry-run] ' : '';
console.log('📂 文件:', file);
console.log(`${tag}✅ 共修复 ${totalFixed} 处`);
for (const r of perRule) if (r.n > 0) console.log(`${tag}   · ${r.label}: ${r.n} 处`);
console.log(`${tag}修复后 collation 分布:`);
for (const f of final) if (f.n > 0) console.log(`${tag}   ${f.c}: ${f.n}`);
const badResidual = final.filter((f) => f.c !== 'utf8mb4_unicode_ci' && f.n > 0);
if (badResidual.length === 0) {
  console.log(`${tag}✓ 无残留不兼容 collation`);
} else {
  console.log(`${tag}⚠️  仍有不兼容 collation 残留(见上)，可能为真正的 utf8mb3 列或新变体，需手工确认`);
}
console.log(`${tag}体积: ${beforeSize} → ${buf.length} 字节 (${buf.length - beforeSize >= 0 ? '+' : ''}${buf.length - beforeSize})`);
