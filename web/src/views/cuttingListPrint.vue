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
      </div>
    </div>

    <div v-if="loading" class="state-tip no-print">加载中…</div>
    <div v-else-if="!list.length" class="state-tip no-print">未找到下料单数据（可能未选择或已删除）。</div>

    <template v-if="list.length">
      <!-- 单张模式：一单一表（表头 + 1 行 + 表底汇总） -->
      <section v-if="mode === 'single'" v-for="row in list" :key="row.id" class="cut-sheet single">
        <div class="sheet-title">下料单 · 订单号 {{ row.order_no }} · {{ row.customer }}</div>
        <table class="cut-table">
          <thead v-html="headHtml"></thead>
          <tbody>
            <tr v-html="rowHtml(row)"></tr>
          </tbody>
        </table>
        <div class="sheet-foot">下料日：{{ fmtDate(row.cut_date) }}　经手人：{{ row.handler || '-' }}　模式：{{ row.mode === 2 ? '特殊（手填）' : '普通（自动扣尺）' }}</div>
      </section>

      <!-- 批量模式：合并一张表（表头 + N 行 + 表底汇总） -->
      <section v-else class="cut-sheet ledger">
        <div class="sheet-title">下料单台账 · 共 {{ list.length }} 条</div>
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

// 表头（门洞合并单列 高*宽*墙厚，门扇合并单列 高*宽；mm 标表头，值取整无小数 DB 照存）
const headHtml = `
  <tr>
    <th>客户名称</th>
    <th>订单号</th>
    <th>门洞(mm)<br>高*宽*墙厚</th>
    <th>款式</th>
    <th>颜色</th>
    <th>套板线条</th>
    <th>备注</th>
    <th>门扇(mm)<br>高*宽</th>
  </tr>`

// 毫米取整：DB 存 DECIMAL 带小数，展示取整无小数点（DB 照存原值）
function mmInt(v) { return v != null && v !== '' ? Math.round(Number(v)) : null }

// 单行 HTML：8 列；门洞=高*宽*墙厚(取整)，门扇=高*宽(取整加粗)，备注=订单备注+加工标签【】
function rowHtml(row) {
  const tags = parseTags(row.remark_tags)
  const tagText = tags.length ? ' ' + tags.map((t) => '【' + t + '】').join('') : ''
  const remark = (row.remark || '') + tagText
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
    <td class="door"><strong>${doorText}</strong></td>`
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

// A4 横纵向：动态注入 @page（at-rule 不能挂类选择器，须全局单条注入；切换即生效，打印前选好）
const orientation = ref('portrait')
const PAGE_STYLE_ID = 'print-page-orient'
function applyPageStyle() {
  let el = document.getElementById(PAGE_STYLE_ID)
  if (!el) { el = document.createElement('style'); el.id = PAGE_STYLE_ID; document.head.appendChild(el) }
  el.textContent = `@page { size: A4 ${orientation.value}; margin: 10mm; }`
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

/* 表格：A4 一页一单（单张）/ 连续表（批量） */
.cut-sheet { width:210mm; margin:0 auto 16px; background:#fff; padding:12mm 10mm; box-sizing:border-box; box-shadow:0 1px 6px rgba(0,0,0,.12); }
.cut-sheet.single { min-height:287mm; display:flex; flex-direction:column; }
.sheet-title { font-size:16px; font-weight:700; letter-spacing:2px; margin-bottom:10px; border-bottom:2px solid #000; padding-bottom:6px; }

/* 纯黑白表格：黑边框、表头浅灰底、门扇高/宽加粗（无彩色） */
.cut-table { width:100%; border-collapse:collapse; font-size:13px; color:#000; }
.cut-table th, .cut-table td { border:1px solid #000; padding:6px 5px; text-align:center; vertical-align:middle; }
.cut-table th { background:#eee; font-weight:600; }
.cut-table td.door { font-size:14px; }

/* 表底小字汇总行 */
.sheet-foot { margin-top:10px; padding-top:8px; border-top:1px solid #999; font-size:12px; color:#333; }

@media print {
  .no-print { display:none !important; }
  .print-root { background:#fff; padding:0; }
  /* @page 由 JS 动态注入（A4 横/纵向可选），见 applyPageStyle */
  .cut-sheet { width:auto; min-height:auto; margin:0; padding:0; box-shadow:none; page-break-after:always; }
  .cut-sheet:last-child { page-break-after:auto; }
  .cut-table { font-size:12px; }
  .cut-table thead { display:table-header-group; } /* 表头每页重复 */
  .cut-table tr { page-break-inside:avoid; }        /* 行不跨页 */
}
</style>
