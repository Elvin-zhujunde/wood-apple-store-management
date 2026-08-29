<template>
  <div class="print-root">
    <!-- 工具栏：仅屏幕预览，打印时隐藏 -->
    <div class="print-toolbar no-print">
      <span class="ttl">下料单打印 · {{ mode === 'single' ? '单张' : '批量' }} · 共 {{ list.length }} 条</span>
      <div class="toolbar-right">
        <el-radio-group v-model="orientation" size="small">
          <el-radio-button value="portrait">A4 纵向</el-radio-button>
          <el-radio-button value="landscape">A4 横向</el-radio-button>
        </el-radio-group>
        <el-button @click="goBack">返回</el-button>
        <el-button type="primary" :disabled="!list.length" @click="doPrint">打印</el-button>
        <el-button type="success" :disabled="!list.length" @click="doExportExcel">导出Excel</el-button>
      </div>
    </div>

    <div v-if="loading" class="state-tip no-print">加载中…</div>
    <div v-else-if="!list.length" class="state-tip no-print">未找到下料单数据（可能未选择或已删除）。</div>

    <template v-if="list.length">
      <!-- 单张/批量统一合并一张连续表（表头一次 + N 行），page-break 自动分页一页多单省纸 -->
      <section class="cut-sheet ledger">
        <div class="sheet-title">{{ mode === 'single' ? '下料单' : '下料单台账' }} · 共 {{ list.length }} 条</div>
        <table class="cut-table">
          <thead v-html="headHtml"></thead>
          <tbody>
            <tr v-for="row in list" :key="row.id" v-html="rowHtml(row)"></tr>
          </tbody>
        </table>
        <div class="sheet-foot">共 {{ list.length }} 条　下料日区间：{{ ledgerDateRange }}　经手人：{{ ledgerHandlers }}</div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { cuttingApi } from '../api'
import { fmtDate } from '../utils/date'
import { ElMessage } from 'element-plus'
import * as XLSX from 'xlsx'

const route = useRoute()
const router = useRouter()
const mode = ref('single')
const list = ref([])
const loading = ref(true)

// remark_tags：DB 存 JSON.stringify 字符串数组，解析回数组
function parseTags(raw) {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((s) => typeof s === 'string' && s) : []
  } catch {
    return []
  }
}

// 表头（门洞合并单列 高*宽*墙厚，门扇合并单列 高*宽 + 板材独立列；备注拆订单备注+加工备注两列；mm 标表头，值取整无小数 DB 照存）
const headHtml = `
  <tr>
    <th>客户名称</th>
    <th>订单号</th>
    <th>门洞(mm)<br>高*宽*墙厚</th>
    <th>款式</th>
    <th>颜色</th>
    <th>套板线条</th>
    <th>订单备注</th>
    <th>加工备注</th>
    <th>原始尺寸(mm)<br>高*宽</th>
    <th>板材</th>
  </tr>`

// 毫米取整：DB 存 DECIMAL 带小数，展示取整无小数点（DB 照存原值）
function mmInt(v) { return v != null && v !== '' ? Math.round(Number(v)) : null }

// 单行 HTML：10 列；门洞=高*宽*墙厚(取整)，门扇=高*宽(取整加粗)，板材独立列，
// 订单备注独立列 + 加工备注独立列(标签【】拆出单独成列，醒目)
function rowHtml(row) {
  const tags = parseTags(row.remark_tags)
  // 每个标签独立 span 块 + 间距隔开渲染（加工备注重要，须清晰可辨，不连成一串）
  const tagText = tags.length ? tags.map((t) => '<span class="tag-item">【' + t + '】</span>').join(' ') : ''
  const remark = row.remark || ''
  const cell = (v) => `<td>${v != null && v !== '' ? v : '-'}</td>`
  const wall = row.wall_thick != null ? row.wall_thick : (row.wall_thickness != null ? row.wall_thickness : null)
  const holeParts = [mmInt(row.hole_height), mmInt(row.hole_width), mmInt(wall)]
  const holeText = holeParts.some((p) => p !== null) ? holeParts.map((p) => (p === null ? '-' : p)).join('*') : '-'
  const doorParts = [mmInt(row.door_height), mmInt(row.door_width)]
  const doorText = doorParts.some((p) => p !== null) ? doorParts.map((p) => (p === null ? '-' : p)).join('*') : '-'
  return `
    ${cell(row.customer)}
    ${cell(row.order_no)}
    <td>${holeText}</td>
    ${cell(row.style)}
    ${cell(row.color)}
    ${cell(row.frame_line)}
    <td>${remark.trim() || '-'}</td>
    <td>${tagText || '-'}</td>
    <td class="door"><strong>${doorText}</strong></td>
    ${cell(row.board)}`
}

// 批量表底汇总：下料日区间 + 去重经手人
const ledgerDateRange = computed(() => {
  const dates = list.value
    .map((r) => (r.cut_date ? String(r.cut_date).slice(0, 10) : ''))
    .filter(Boolean)
    .sort()
  if (dates.length === 0) return '-'
  if (dates.length === 1 || dates[0] === dates[dates.length - 1]) return dates[0]
  return `${dates[0]} ~ ${dates[dates.length - 1]}`
})
const ledgerHandlers = computed(() => {
  const set = [...new Set(list.value.map((r) => r.handler).filter(Boolean))]
  return set.length ? set.join('、') : '-'
})

function goBack() {
  router.push('/orders')
}
function doPrint() {
  window.print()
}

// 导出 Excel：复刻打印表 10 列取值逻辑（取整/null→'-'/标签【】），与页面一致
function doExportExcel() {
  if (!list.value.length) { ElMessage.warning('没有可导出的数据'); return }
  const header = ['客户名称', '订单号', '门洞(mm) 高*宽*墙厚', '款式', '颜色', '套板线条', '订单备注', '加工备注', '原始尺寸(mm) 高*宽', '板材']
  const cells = (v) => (v != null && v !== '' ? v : '-')
  const data = list.value.map((row) => {
    const tags = parseTags(row.remark_tags)
    const tagText = tags.length ? tags.map((t) => '【' + t + '】').join(' ') : '-'
    const remark = (row.remark || '').trim() || '-'
    const wall = row.wall_thick != null ? row.wall_thick : (row.wall_thickness != null ? row.wall_thickness : null)
    const holeParts = [mmInt(row.hole_height), mmInt(row.hole_width), mmInt(wall)]
    const holeText = holeParts.some((p) => p !== null) ? holeParts.map((p) => (p === null ? '-' : p)).join('*') : '-'
    const doorParts = [mmInt(row.door_height), mmInt(row.door_width)]
    const doorText = doorParts.some((p) => p !== null) ? doorParts.map((p) => (p === null ? '-' : p)).join('*') : '-'
    return [
      cells(row.customer), cells(row.order_no), holeText, cells(row.style), cells(row.color),
      cells(row.frame_line), remark, tagText, doorText, cells(row.board),
    ]
  })
  const ws = XLSX.utils.aoa_to_sheet([header, ...data])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '下料单')
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  XLSX.writeFile(wb, `cutting-list-${stamp}.xlsx`)
  ElMessage.success(`已导出 ${list.value.length} 条下料单`)
}

// A4 横纵向：动态注入 @page（at-rule 不能挂类选择器，须全局单条注入；切换即生效，打印前选好）
const orientation = ref('landscape')
const PAGE_STYLE_ID = 'print-page-orient'
function applyPageStyle() {
  let el = document.getElementById(PAGE_STYLE_ID)
  if (!el) { el = document.createElement('style'); el.id = PAGE_STYLE_ID; document.head.appendChild(el) }
  el.textContent = `@page { size: A4 ${orientation.value}; margin: 0; }`  // margin:0 关浏览器页眉页脚(URL/页码/日期无渲染区)，内容边距改由 .cut-sheet padding 提供
}
watch(orientation, applyPageStyle)
onUnmounted(() => {
  const el = document.getElementById(PAGE_STYLE_ID)
  if (el) el.remove()
})

onMounted(async () => {
  applyPageStyle()
  mode.value = route.query.mode === 'ledger' ? 'ledger' : 'single'
  const ids = route.query.ids
  if (!ids) {
    loading.value = false
    ElMessage.warning('未指定打印下料单')
    return
  }
  try {
    const listRes = await cuttingApi.list({ ids, page: 1, pageSize: 9999 })
    list.value = listRes.data.list || []
  } finally {
    loading.value = false
  }
})
</script>

<style>
/* 打印页样式非 scoped：单用途独立路由，类名不与他处冲突；@page 须全局 */
.print-root { background:#f5f5f5; min-height:100vh; padding:16px; }
.print-toolbar { display:flex; justify-content:space-between; align-items:center; max-width:210mm; margin:0 auto 16px; background:#fff; padding:12px 16px; border-radius:6px; box-shadow:0 1px 4px rgba(0,0,0,.08); }
.print-toolbar .ttl { font-size:15px; font-weight:600; }
.print-toolbar .toolbar-right { display:flex; align-items:center; gap:8px; }
.state-tip { max-width:210mm; margin:40px auto; text-align:center; color:#909399; }

/* 表格：连续紧凑排版，page-break 自动分页（一页多单/多行，省纸） */
.cut-sheet { width:210mm; margin:0 auto 12px; background:#fff; padding:8mm 8mm; box-sizing:border-box; box-shadow:0 1px 6px rgba(0,0,0,.12); }
.cut-sheet.single { min-height:auto; }
.sheet-title { font-size:16px; font-weight:700; letter-spacing:1px; margin-bottom:8px; border-bottom:2px solid #000; padding-bottom:6px; }

/* 纯黑白表格：黑边框、表头浅灰底、门扇高/宽加粗（无彩色）；cell 放大+字号增大 */
.cut-table { width:100%; border-collapse:collapse; font-size:16px; color:#000; }
.cut-table th, .cut-table td { border:1px solid #000; padding:10px 12px; text-align:center; vertical-align:middle; line-height:1.5; }
.cut-table th { background:#eee; font-weight:600; }
.cut-table td.door { font-size:18px; }
.cut-table .tag-item { display:inline-block; margin:2px 4px; padding:0 4px; white-space:nowrap; }

/* 表底小字汇总行 */
.sheet-foot { margin-top:8px; padding-top:6px; border-top:1px solid #999; font-size:12px; color:#333; }

@media print {
  .no-print { display:none !important; }
  .print-root { background:#fff; padding:0; }
  /* @page 由 JS 动态注入（A4 横/纵向可选），见 applyPageStyle */
  .cut-sheet { width:auto; min-height:auto; margin:0 0 4mm; padding:6mm 8mm; box-shadow:none; }  /* @page margin:0 后边距自给；多页中间页上下贴边=表格满版省纸 */
  .cut-sheet:last-child { margin-bottom:0; }
  .cut-table { font-size:15px; }
  .cut-table thead { display:table-header-group; } /* 表头每页重复 */
  .cut-table tr { page-break-inside:avoid; }        /* 行不跨页 */
  .cut-sheet.single { page-break-inside:avoid; }    /* 单张：一单不被截断（整单紧凑不跨页） */
}
</style>
