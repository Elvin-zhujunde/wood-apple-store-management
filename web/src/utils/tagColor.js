// 标签配色：按文本 hash 取固定色，相同文本同色（颜色区分）
// 屏幕展示用 el-tag type（TAG_TYPES）；打印/纯 CSS 用十六进制（TAG_HEX，与 type 同色系）
export const TAG_TYPES = ['', 'success', 'warning', 'danger', 'info']
export const TAG_HEX = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399']

export function hashIndex(text) {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0
  return h % TAG_TYPES.length
}
export function tagType(text) {
  return TAG_TYPES[hashIndex(text)]
}
export function tagHex(text) {
  return TAG_HEX[hashIndex(text)]
}
