<template>
  <div class="print-root">
    <!-- 工具栏：仅屏幕预览，打印时隐藏 -->
    <div class="print-toolbar no-print">
      <span class="ttl">下料单打印 · {{ mode === 'single' ? '单张模式' : '台账模式' }} · 共 {{ list.length }} 条</span>
      <div>
        <el-button @click="goBack">返回</el-button>
        <el-button type="primary" :disabled="!list.length" @click="doPrint">打印</el-button>
      </div>
    </div>

    <div v-if="loading" class="state-tip no-print">加载中…</div>
    <div v-else-if="!list.length" class="state-tip no-print">未找到下料单数据（可能未选择或已删除）。</div>

    <template v-if="list.length">
      <!-- 单张模式：一单一页，门扇尺寸特大字 -->
      <div v-if="mode === 'single'">
        <section v-for="row in list" :key="row.id" class="single-sheet">
          <header class="sheet-head">
            <div class="head-left">
              <h1>下 料 单</h1>
              <p class="rule">门扇尺寸 = 门洞尺寸 − 扣尺默认值（高-{{ config.defaultHeightCut }} 宽-{{ config.defaultWidthCut }}）</p>
            </div>
            <div class="head-right">
              <div class="kv"><span>订单号</span><strong>{{ row.order_no }}</strong></div>
              <div class="kv"><span>下料单号</span><strong>#{{ row.id }}</strong></div>
            </div>
          </header>

          <div class="info-grid">
            <div><label>客户</label><span>{{ row.customer || '-' }}</span></div>
            <div><label>款式</label><span>{{ row.style || '-' }}</span></div>
            <div><label>颜色</label><span>{{ row.color || '-' }}</span></div>
            <div><label>板材</label><span>{{ row.board || '-' }}</span></div>
            <div><label>墙厚</label><span>{{ wallOf(row) }}</span></div>
            <div><label>套板线条</label><span>{{ row.frame_line || '-' }}</span></div>
            <div class="full"><label>备注</label><span>{{ row.remark || '-' }}</span></div>
          </div>

          <div v-if="parseTags(row.remark_tags).length" class="tag-print-row">
            <span class="tag-print-label">加工备注</span>
            <span class="print-tag" v-for="(t, i) in parseTags(row.remark_tags)" :key="i">{{ t }}</span>
          </div>

          <div class="size-box">
            <div class="size-item">
              <div class="size-label">门洞尺寸（高 × 宽）</div>
              <div class="size-val hole">{{ row.hole_height || '-' }} × {{ row.hole_width || '-' }}</div>
            </div>
            <div class="size-arrow">⟶</div>
            <div class="size-item">
              <div class="size-label">门扇尺寸 · 下料（高 × 宽）</div>
              <div class="size-val door">{{ row.door_height || '-' }} × {{ row.door_width || '-' }}</div>
            </div>
          </div>

          <footer class="sheet-foot">
            <span>模式：{{ row.mode === 2 ? '特殊（手填）' : '普通（自动扣尺）' }}</span>
            <span>状态：{{ row.status }}</span>
            <span>经手人：{{ row.handler || '-' }}</span>
            <span>下料日：{{ fmtDate(row.cut_date) }}</span>
          </footer>
        </section>
      </div>

      <!-- 台账模式：多单连续表，表头每页重复 -->
      <div v-else class="ledger-wrap">
        <div class="ledger-title">
          <h1>下料单台账</h1>
          <p class="rule">门扇尺寸 = 门洞尺寸 − 扣尺默认值（高-{{ config.defaultHeightCut }} 宽-{{ config.defaultWidthCut }}） · 共 {{ list.length }} 条</p>
        </div>
        <table class="ledger-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>客户</th>
              <th>订单号</th>
              <th>款式</th>
              <th>颜色</th>
              <th>板材</th>
              <th>门洞高</th>
              <th>门洞宽</th>
              <th>墙厚</th>
              <th class="door-col">门扇高</th>
              <th class="door-col">门扇宽</th>
              <th>模式</th>
              <th>加工备注</th>
              <th>经手人</th>
              <th>下料日</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in list" :key="row.id">
              <td>{{ i + 1 }}</td>
              <td>{{ row.customer || '-' }}</td>
              <td>{{ row.order_no }}</td>
              <td>{{ row.style || '-' }}</td>
              <td>{{ row.color || '-' }}</td>
              <td>{{ row.board || '-' }}</td>
              <td>{{ row.hole_height || '-' }}</td>
              <td>{{ row.hole_width || '-' }}</td>
              <td>{{ wallOf(row) }}</td>
              <td class="door-col"><strong>{{ row.door_height }}</strong></td>
              <td class="door-col"><strong>{{ row.door_width }}</strong></td>
              <td>{{ row.mode === 2 ? '特殊' : '普通' }}</td>
              <td class="tags-cell">{{ parseTags(row.remark_tags).join('，') || '-' }}</td>
              <td>{{ row.handler || '-' }}</td>
              <td>{{ fmtDate(row.cut_date) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { cuttingApi } from '../api'
import { fmtDate } from '../utils/date'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const mode = ref('single')
const list = ref([])
const config = ref({ defaultHeightCut: 40, defaultWidthCut: 70 })
const loading = ref(true)

function wallOf(row) {
  return row.wall_thickness != null ? row.wall_thickness : row.wall_thick != null ? row.wall_thick : '-'
}
function parseTags(raw) {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((s) => typeof s === 'string' && s) : []
  } catch {
    return []
  }
}
function goBack() {
  router.push('/cutting-list')
}
function doPrint() {
  window.print()
}

onMounted(async () => {
  mode.value = route.query.mode === 'ledger' ? 'ledger' : 'single'
  const ids = route.query.ids
  if (!ids) {
    loading.value = false
    ElMessage.warning('未指定打印下料单')
    return
  }
  try {
    const [listRes, cfgRes] = await Promise.all([
      cuttingApi.list({ ids, page: 1, pageSize: 9999 }),
      cuttingApi.getConfig(),
    ])
    list.value = listRes.data.list || []
    config.value = cfgRes.data
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
.state-tip { max-width:210mm; margin:40px auto; text-align:center; color:#909399; }

/* 单张：A4 一页一单 */
.single-sheet { width:210mm; min-height:287mm; margin:0 auto 16px; background:#fff; padding:14mm 12mm; box-sizing:border-box; box-shadow:0 1px 6px rgba(0,0,0,.12); display:flex; flex-direction:column; }
.sheet-head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #333; padding-bottom:10px; }
.head-left h1 { margin:0; font-size:30px; letter-spacing:8px; }
.head-left .rule { margin:6px 0 0; font-size:12px; color:#666; }
.head-right { text-align:right; }
.head-right .kv { font-size:13px; margin-bottom:4px; }
.head-right .kv span { color:#888; margin-right:6px; }
.head-right .kv strong { font-size:15px; }

.info-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px 18px; margin:14px 0; font-size:14px; }
.info-grid > div { border-bottom:1px solid #eee; padding:4px 0; }
.info-grid .full { grid-column:1 / -1; }
.info-grid label { color:#888; margin-right:8px; }
.info-grid span { font-weight:600; }

.size-box { display:flex; align-items:center; justify-content:space-around; margin:18px 0; padding:18px 0; border-top:1px dashed #bbb; border-bottom:1px dashed #bbb; }
.size-item { text-align:center; }
.size-label { font-size:13px; color:#666; margin-bottom:8px; }
.size-val { font-weight:800; }
.size-val.hole { font-size:30px; color:#333; }
.size-val.door { font-size:46px; color:#d43030; letter-spacing:2px; }
.size-arrow { font-size:30px; color:#bbb; }

.sheet-foot { margin-top:auto; padding-top:14px; border-top:1px solid #eee; display:flex; justify-content:space-between; font-size:13px; color:#555; }

/* 单张模式：加工备注标签 */
.tag-print-row { display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin:10px 0 0; }
.tag-print-label { font-size:13px; color:#666; margin-right:4px; }
.print-tag { display:inline-block; border:1px solid #d43030; color:#d43030; border-radius:3px; padding:2px 8px; font-size:13px; font-weight:600; }
.ledger-table td.tags-cell { font-size:11px; }

/* 台账 */
.ledger-wrap { width:210mm; margin:0 auto; background:#fff; padding:14mm 12mm; box-sizing:border-box; box-shadow:0 1px 6px rgba(0,0,0,.12); }
.ledger-title h1 { margin:0 0 4px; font-size:22px; letter-spacing:4px; }
.ledger-title .rule { margin:0 0 14px; font-size:12px; color:#666; }
.ledger-table { width:100%; border-collapse:collapse; font-size:12px; }
.ledger-table th, .ledger-table td { border:1px solid #999; padding:5px 6px; text-align:center; }
.ledger-table th { background:#f0f0f0; }
.ledger-table td.door-col, .ledger-table th.door-col { color:#d43030; }
.ledger-table tbody tr:nth-child(even) { background:#fafafa; }

@media print {
  .no-print { display:none !important; }
  .print-root { background:#fff; padding:0; }
  @page { size:A4; margin:10mm; }
  .single-sheet { width:auto; min-height:auto; margin:0; padding:0; box-shadow:none; page-break-after:always; }
  .single-sheet:last-child { page-break-after:auto; }
  .ledger-wrap { width:auto; padding:0; box-shadow:none; }
  .ledger-table thead { display:table-header-group; }
  .ledger-table tr { page-break-inside:avoid; }
}
</style>
