// 修复 Navicat 导出的 SQL：utf8mb4 字符集却配了 utf8_unicode_ci（属于 utf8mb3）排序规则，
// MySQL 8 导入报 ERROR 1253 (42000) ... is not valid for CHARACTER SET 'utf8mb4'。
//
// 修改规则：仅当排序规则与 utf8mb4 字符集成对出现时，把 utf8_unicode_ci 升级为 utf8mb4_unicode_ci；
//           真正的 utf8(=utf8mb3) 列上的 utf8_unicode_ci 是合法的，保持不动。
// 匹配两种 Navicat 写法（字符集与 collate 总是紧挨）：
//   列级  CHARACTER SET utf8mb4 COLLATE utf8_unicode_ci
//   表级  CHARACTER SET = utf8mb4 COLLATE = utf8_unicode_ci
// 全程按 Buffer 字节替换，不解码/重编码，绝不触碰中文或 mojibake 字节。
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

// 只修「utf8mb4 + utf8_unicode_ci」配对；真正的 utf8(utf8mb3) 列不会命中这两个模式
const PATTERNS = [
  { from: Buffer.from('utf8mb4 COLLATE utf8_unicode_ci'),   to: Buffer.from('utf8mb4 COLLATE utf8mb4_unicode_ci') },
  { from: Buffer.from('utf8mb4 COLLATE = utf8_unicode_ci'), to: Buffer.from('utf8mb4 COLLATE = utf8mb4_unicode_ci') },
];

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
const beforeBad = countOccurrences(buf, Buffer.from('utf8_unicode_ci'));

let fixed = 0;
for (const p of PATTERNS) {
  for (;;) {
    const idx = buf.indexOf(p.from);
    if (idx === -1) break;
    buf = Buffer.concat([buf.subarray(0, idx), p.to, buf.subarray(idx + p.from.length)]);
    fixed++;
  }
}

// 替换后仍残留的 utf8_unicode_ci = 真正的 utf8mb3 列，按规则不动，仅提示
const residual = countOccurrences(buf, Buffer.from('utf8_unicode_ci'));

if (!dryRun) fs.writeFileSync(file, buf);

const tag = dryRun ? '[dry-run] ' : '';
console.log('📂 文件:', file);
console.log(`${tag}✅ 已修复 ${fixed} 处  (utf8mb4 + utf8_unicode_ci → utf8mb4_unicode_ci)`);
if (residual > 0) {
  console.log(`${tag}ℹ️  剩余 ${residual} 处 utf8_unicode_ci 为真正的 utf8(utf8mb3) 列，按规则保持不动`);
} else {
  console.log(`${tag}✓ 无残留 utf8_unicode_ci`);
}
console.log(`${tag}修复前 bad 计数: ${beforeBad}    体积: ${beforeSize} → ${buf.length} 字节 (${buf.length - beforeSize >= 0 ? '+' : ''}${buf.length - beforeSize})`);
