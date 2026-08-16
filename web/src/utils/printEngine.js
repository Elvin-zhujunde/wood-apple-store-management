/**
 * 标签打印引擎抽象层
 *
 * 当前实现 A：浏览器 window.print（DOM 布局，@page 控纸张尺寸）
 * 预留实现 B：专用标签打印机（TSCL/ESC 指令流），日后切换只改 printEngine 内部，组件/数据/入口不动
 *
 * 切换方式：将 ENGINE 由 'browser' 改为 'printer'，并实现 renderTSC()。
 */

export const ENGINE = 'browser' // 'browser' | 'printer'

// 4 种标签的尺寸/布局定义（忠实参考主人提供的标签打印 UI 截图）
// 字段映射见 LABEL_FIELD_MAP；null 表示该标签不显示该字段
export const LABEL_TYPES = {
  'door-in': {
    name: '门扇内标签',
    size: { w: 40, h: 50 }, // mm
    bigChar: '扇',
    fields: ['order_no', 'holeHW', 'color', 'style', 'lock_hole', 'remark'],
    foot: '门扇内标签，PC 40×50',
  },
  'door-out': {
    name: '门扇外标签',
    size: { w: 40, h: 80 },
    bigChar: '扇',
    fields: ['customer', 'order_no', 'holeHW', 'color', 'style', 'lock_hole', 'remark', 'sub_customer'],
    foot: '门扇外标签，PC 40×80',
  },
  'frame': {
    name: '门套标签',
    size: { w: 40, h: 80 },
    bigChar: '套',
    fields: ['customer', 'order_no', 'holeHWT', 'color', 'remark', 'sub_customer'],
    foot: '门套标签，PC 40×80',
  },
  'frame-in': {
    name: '门套内标签',
    size: { w: 40, h: 30 },
    bigChar: null,
    fields: ['order_no', 'holeHWT', 'color', 'remark'],
    foot: '门套内标签，PC 40×30',
  },
}

// 门洞尺寸取值：door-in/door-out = 高×宽；frame/frame-in = 高×宽×墙厚
function holeStr(row, withThick) {
  const h = row.hole_height ?? row.door_h
  const w = row.hole_width ?? row.door_w
  const t = row.wall_thick ?? row.wall_thickness
  let s = `${h ?? '-'}×${w ?? '-'}`
  if (withThick) s += `×${t ?? '-'}`
  return s
}

// 字段标签 + 取值函数（订单行 → 标签显示文本）
export const LABEL_FIELD_MAP = {
  customer: { label: '客户', get: (r) => r.customer || '-' },
  order_no: { label: '订单号', get: (r) => r.order_no || '-' },
  holeHW: { label: '门洞尺寸', get: (r) => holeStr(r, false) },
  holeHWT: { label: '门洞尺寸', get: (r) => holeStr(r, true) },
  color: { label: '颜色', get: (r) => r.color || '-' },
  style: { label: '款式', get: (r) => r.style || '-' },
  lock_hole: { label: '锁孔', get: (r) => r.lock_hole || '-' },
  remark: { label: '备注', get: (r) => r.remark || '-' },
  sub_customer: { label: '子客户', get: (r) => r.sub_customer || '-' },
}

/**
 * A 实现：浏览器打印
 * 组件已渲染好 DOM，这里仅触发 window.print()。
 * 抽象层存在的意义：日后 B 实现替换此处逻辑（生成指令 → 调打印机），组件只调 printEngine.print()。
 */
export function print() {
  window.print()
}

/**
 * B 预留：专用标签打印机（TSCL 指令流）
 * 切换 ENGINE='printer' 后由组件调用，此处生成 .tspl 指令文本供下载/直送打印机。
 * 当前为占位，未实现——切方案时补全。
 * @param {string} type 标签类型 key
 * @param {Array} rows 订单行
 */
export function renderTSC(type, rows) {
  // TODO(B): 按 LABEL_TYPES[type].size 生成 TSCL 指令
  // SIZE {w} mm,{h} mm / GAP 2 mm,0 mm / CLS / TEXT ... / PRINT N,1
  // 例：`SIZE 40 mm,50 mm\nGAP 2 mm,0 mm\nCLS\nTEXT 10,10,"TSS24.BF2",0,1,1,"扇"\n...\nPRINT 1,1\n`
  throw new Error('renderTSC 未实现（B 专用打印机方案，切方案时补全）')
}
