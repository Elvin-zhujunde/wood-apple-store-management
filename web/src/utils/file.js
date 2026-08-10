// 图片地址拼接：DB只存相对路径（uploads/2026-08/xxx.jpg），前缀由环境变量拼接
// dev: VITE_IMG_BASE=http://127.0.0.1:3001
// 生产同源托管: VITE_IMG_BASE=（空，走相对路径）
const IMG_BASE = import.meta.env.VITE_IMG_BASE || ''

export function imgUrl(path) {
  if (!path) return ''
  // 已是完整URL（http/https开头）直通
  if (/^https?:\/\//.test(path)) return path
  // 相对路径拼接，避免重复斜杠
  const base = IMG_BASE.replace(/\/$/, '')
  const p = path.replace(/^\//, '')
  return `${base}/${p}`
}
