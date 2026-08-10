// 日期格式化工具
// 解决：MySQL DATE/DATETIME 经 mysql2 序列化为 ISO 串（如 2026-08-09T16:00:00.000Z），
// 直接渲染会 ①带时分秒垃圾 ②T16:00Z=UTC午夜=CST次日零点，业务日期被显示成前一天。
// 策略：用 new Date() 本地时区取值（CST 正确还原业务日期）；已是干净 YYYY-MM-DD 字符串则直通。

// 日期 → YYYY-MM-DD
export function fmtDate(v) {
  if (!v) return ''
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 日期时间 → YYYY-MM-DD HH:mm
export function fmtDateTime(v) {
  if (!v) return ''
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s + ' 00:00'
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${fmtDate(d)} ${h}:${min}`
}

// el-table-column formatter 适配（签名 row, column, cellValue）
export const dateFmt = (_r, _c, v) => fmtDate(v)
export const dateTimeFmt = (_r, _c, v) => fmtDateTime(v)

// 本地今日 YYYY-MM-DD（避免 toISOString 取 UTC 导致凌晨 0-8 点返回昨天）
export function todayLocal() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
