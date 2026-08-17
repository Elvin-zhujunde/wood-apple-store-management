<template>
  <div class="page">
    <div class="toolbar">
      <el-input v-model="kw" placeholder="搜索客户/定位" style="width:220px" clearable @clear="load" @keyup.enter="load" />
      <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width:140px" @change="load">
        <el-option label="待转单" value="待转单" />
        <el-option label="已转单" value="已转单" />
      </el-select>
      <el-button type="primary" :disabled="selection.length===0" @click="onBatchConvert">批量转单 ({{ selection.length }})</el-button>
    </div>
    <el-table :data="list" border @selection-change="onSelChange" v-loading="loading">
      <el-table-column type="selection" width="42" :selectable="row=>row.status==='待转单'" />
      <el-table-column prop="customer_name" label="客户" min-width="120" />
      <el-table-column prop="location_name" label="安装定位" min-width="120" />
      <el-table-column label="门洞(高×宽)" width="120">
        <template #default="{row}">{{ row.door_h }} × {{ row.door_w }}</template>
      </el-table-column>
      <el-table-column prop="wall_thick" label="墙厚" width="80" />
      <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
      <el-table-column label="照片" width="70">
        <template #default="{row}">{{ row.photo_count || 0 }}</template>
      </el-table-column>
      <el-table-column prop="measured_by" label="测量人" width="90" />
      <el-table-column label="测量时间" width="150">
        <template #default="{row}">{{ fmt(row.measured_at) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{row}">
          <el-tag :type="row.status==='已转单'?'success':'warning'">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="关联订单" width="120">
        <template #default="{row}">
          <span v-if="row.order_no" class="order-link" @click="goOrders(row)">{{ row.order_no }}</span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{row}">
          <el-button size="small" @click="openDetail(row)">详情</el-button>
          <el-button size="small" type="primary" v-if="row.status==='待转单'" @click="onQuickConvert(row)">转单</el-button>
        </template>
      </el-table-column>
    </el-table>
    <div v-if="list.length>=100" class="cap-hint">仅显示前 100 条，请用搜索缩小范围</div>

    <!-- 详情抽屉 -->
    <el-drawer v-model="drawer" :title="'测量记录 #'+(cur?.id||'')" size="520px" direction="rtl">
      <el-descriptions :column="1" border v-if="cur">
        <el-descriptions-item label="客户">{{ cur.customer_name }}</el-descriptions-item>
        <el-descriptions-item label="安装定位">{{ cur.location_name }}</el-descriptions-item>
        <el-descriptions-item label="门洞高">{{ cur.door_h }} mm</el-descriptions-item>
        <el-descriptions-item label="门洞宽">{{ cur.door_w }} mm</el-descriptions-item>
        <el-descriptions-item label="墙厚">{{ cur.wall_thick }} mm</el-descriptions-item>
        <el-descriptions-item label="备注">{{ cur.remark || '-' }}</el-descriptions-item>
        <el-descriptions-item label="测量人">{{ cur.measured_by }}</el-descriptions-item>
        <el-descriptions-item label="测量时间">{{ fmt(cur.measured_at) }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="cur.status==='已转单'?'success':'warning'">{{ cur.status }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="关联订单">
          <span v-if="cur.order_no" class="order-link" @click="goOrders(cur)">{{ cur.order_no }}</span>
          <span v-else>-</span>
        </el-descriptions-item>
      </el-descriptions>
      <div class="photo-section" v-if="cur">
        <div class="photo-title">现场照片 ({{ (cur.photos||[]).length }})</div>
        <div v-if="(cur.photos||[]).length===0" class="photo-empty">无</div>
        <div class="photo-grid" v-else>
          <el-image v-for="p in cur.photos" :key="p.id"
            :src="imgUrl(p.file_path)" :preview-src-list="cur.photos.map(x=>imgUrl(x.file_path))"
            fit="cover" class="photo-item" :preview-teleported="true" />
        </div>
      </div>
    </el-drawer>

    <!-- 单条快捷转单弹窗（复用 measureApi.convert；批量转单弹窗 Task 3 做） -->
    <el-dialog v-model="convDlg" title="测量转单" width="640px">
      <el-descriptions v-if="convRow" :column="2" border size="small" style="margin-bottom:12px">
        <el-descriptions-item label="客户">{{ convRow.customer_name }}</el-descriptions-item>
        <el-descriptions-item label="定位">{{ convRow.location_name }}</el-descriptions-item>
        <el-descriptions-item label="门洞高">{{ convRow.door_h }}</el-descriptions-item>
        <el-descriptions-item label="门洞宽">{{ convRow.door_w }}</el-descriptions-item>
        <el-descriptions-item label="墙厚">{{ convRow.wall_thick }}</el-descriptions-item>
        <el-descriptions-item label="现场备注">{{ convRow.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-form :model="convForm" label-width="80px">
        <el-form-item label="门型"><el-select v-model="convForm.door_bom_id" filterable @change="onConvBomChange" style="width:100%"><el-option v-for="b in bomList" :key="b.id" :label="b.name" :value="b.id" /></el-select></el-form-item>
        <el-form-item label="颜色"><el-select v-model="convForm.color" filterable allow-create style="width:100%"><el-option v-for="c in convColors" :key="c" :label="c" :value="c" /></el-select></el-form-item>
        <el-form-item label="单价"><el-input-number v-model="convForm.unit_price" :min="0" :precision="2" /></el-form-item>
        <el-form-item label="经手人"><el-input v-model="convForm.handler_sale" /></el-form-item>
        <el-form-item label="下单日期"><el-date-picker v-model="convForm.order_date" type="date" value-format="YYYY-MM-DD" /></el-form-item>
        <el-form-item label="锁孔"><el-input v-model="convForm.lock_hole" /></el-form-item>
        <el-form-item label="款式"><el-input v-model="convForm.style" /></el-form-item>
        <el-form-item label="板材"><el-input v-model="convForm.board" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="convDlg=false">取消</el-button>
        <el-button type="primary" :loading="converting" @click="doConvert">确认转单</el-button>
      </template>
    </el-dialog>

    <!-- 批量转单弹窗（统一字段 + 逐条覆盖） -->
    <el-dialog v-model="batchDlg" title="批量转单" width="1080px" :close-on-click-modal="false">
      <div class="batch-common">
        <div class="batch-common-title">统一设置（未勾选「覆盖」的行用此值）</div>
        <el-form :model="batchCommon" label-width="76px">
          <div style="display:flex;gap:16px">
            <el-form-item label="门型" style="flex:2"><el-select v-model="batchCommon.door_bom_id" filterable @change="onBatchBomChange" style="width:100%"><el-option v-for="b in bomList" :key="b.id" :label="b.name" :value="b.id" /></el-select></el-form-item>
            <el-form-item label="颜色" style="flex:1"><el-select v-model="batchCommon.color" filterable allow-create style="width:100%"><el-option v-for="c in batchColors" :key="c" :label="c" :value="c" /></el-select></el-form-item>
            <el-form-item label="单价" style="flex:1"><el-input-number v-model="batchCommon.unit_price" :min="0" :precision="2" style="width:100%" /></el-form-item>
          </div>
          <div style="display:flex;gap:16px">
            <el-form-item label="经手人" style="flex:1"><el-input v-model="batchCommon.handler_sale" /></el-form-item>
            <el-form-item label="下单日期" style="flex:1"><el-date-picker v-model="batchCommon.order_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
            <el-form-item label="锁孔" style="flex:1"><el-input v-model="batchCommon.lock_hole" /></el-form-item>
          </div>
          <div style="display:flex;gap:16px">
            <el-form-item label="款式" style="flex:1"><el-input v-model="batchCommon.style" /></el-form-item>
            <el-form-item label="板材" style="flex:1"><el-input v-model="batchCommon.board" /></el-form-item>
          </div>
        </el-form>
      </div>
      <div class="batch-rows-title">待转单记录 ({{ batchRows.length }})</div>
      <el-table :data="batchRows" border size="small" max-height="300">
        <el-table-column prop="customer_name" label="客户" min-width="110" />
        <el-table-column prop="location_name" label="定位" min-width="110" />
        <el-table-column label="尺寸" width="150"><template #default="{row}">{{ row.door_h }}×{{ row.door_w }} 墙{{ row.wall_thick }}</template></el-table-column>
        <el-table-column label="覆盖" width="64">
          <template #default="{row}"><el-checkbox v-model="row.override" /></template>
        </el-table-column>
        <el-table-column label="覆盖字段（勾选「覆盖」后可编辑）" min-width="520">
          <template #default="{row}">
            <div v-if="row.override" class="row-override-form">
              <el-select v-model="row.form.door_bom_id" filterable placeholder="门型" style="width:100%" @change="onRowBomChange(row)"><el-option v-for="b in bomList" :key="b.id" :label="b.name" :value="b.id" /></el-select>
              <div style="display:flex;gap:8px">
                <el-select v-model="row.form.color" filterable allow-create placeholder="颜色" style="flex:1"><el-option v-for="c in rowColors(row)" :key="c" :label="c" :value="c" /></el-select>
                <el-input-number v-model="row.form.unit_price" :min="0" :precision="2" placeholder="单价" style="flex:1" />
              </div>
            </div>
            <span v-else style="color:var(--el-color-info)">用统一值</span>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="batchDlg=false">取消</el-button>
        <el-button type="primary" :loading="batching" @click="doBatchConvert">确认批量转单</el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { measureApi, bomApi } from '../api/index'
import { imgUrl } from '../utils/file'
import { useUserStore } from '../store/user'

const router = useRouter()
const store = useUserStore()
const list = ref([]), kw = ref(''), statusFilter = ref(''), loading = ref(false)
const selection = ref([])
const drawer = ref(false), cur = ref(null)

const fmt = (s) => s ? s.replace('T',' ').slice(0,16) : '-'
const load = async () => {
  loading.value = true
  try {
    const { data } = await measureApi.all({ keyword: kw.value, status: statusFilter.value, size: 100 })
    list.value = data
  } finally { loading.value = false }
}
load()
const onSelChange = (rows) => { selection.value = rows }
const openDetail = async (row) => {
  const { data } = await measureApi.detail(row.id)
  cur.value = data
  drawer.value = true
}
const goOrders = (row) => { router.push('/orders') }   // v1: 跳订单列表; v2 加 ?focus=so_id 深度定位
// 批量转单：选中 N 条 → 统一字段 + 逐条覆盖 → batch-convert
const batchDlg = ref(false), batching = ref(false)
const batchCommon = ref({ door_bom_id: null, color: '', qty: 1, unit_price: 0, handler_sale: store.name, order_date: new Date().toISOString().slice(0,10), lock_hole: '', style: '', board: '' })
const batchRows = ref([])   // [{id, customer_name, location_name, door_h, door_w, wall_thick, override:false, form:{door_bom_id,color,qty,unit_price}}]
const onBatchConvert = async () => {
  if (selection.value.length === 0) return
  if (!bomList.value.length) { const { data } = await bomApi.all(); bomList.value = data }
  batchCommon.value = { door_bom_id: null, color: '', qty: 1, unit_price: 0, handler_sale: store.name, order_date: new Date().toISOString().slice(0,10), lock_hole: '', style: '', board: '' }
  batchRows.value = selection.value.map(r => ({ id: r.id, customer_name: r.customer_name, location_name: r.location_name, door_h: r.door_h, door_w: r.door_w, wall_thick: r.wall_thick, override: false, form: { door_bom_id: null, color: '', qty: 1, unit_price: 0 } }))
  batchDlg.value = true
}
const onBatchBomChange = (id) => { batchCommon.value.color = colorsOf(id)[0] || '' }
const doBatchConvert = async () => {
  const c = batchCommon.value
  if (!c.door_bom_id || !c.color || (c.unit_price === null || c.unit_price === undefined || c.unit_price === '') || !c.handler_sale || !c.order_date) {
    ElMessage.warning('统一设置：门型/颜色/单价/经手人/下单日期 必填'); return
  }
  // 构造 items：覆盖行用 row.form（4 字段）+ 统一（其余 5 字段）；非覆盖行全用统一
  const items = batchRows.value.map(r => {
    if (r.override) {
      const f = r.form
      if (!f.door_bom_id || !f.color || (f.unit_price === null || f.unit_price === undefined || f.unit_price === '')) return { id: r.id, _invalid: true }
      return { id: r.id, door_bom_id: f.door_bom_id, color: f.color, qty: f.qty, unit_price: f.unit_price, handler_sale: c.handler_sale, order_date: c.order_date, lock_hole: c.lock_hole, style: c.style, board: c.board }
    }
    return { id: r.id, door_bom_id: c.door_bom_id, color: c.color, qty: c.qty, unit_price: c.unit_price, handler_sale: c.handler_sale, order_date: c.order_date, lock_hole: c.lock_hole, style: c.style, board: c.board }
  })
  const invalid = items.filter(x => x._invalid).length
  if (invalid > 0) { ElMessage.warning('有 ' + invalid + ' 条覆盖行字段未填全（门型/颜色/单价），请补全或取消覆盖'); return }
  batching.value = true
  try {
    const { data } = await measureApi.batchConvert({ items })
    ElMessage.success(`批量转单完成：成功 ${data.success} 条` + (data.skipped ? `，跳过 ${data.skipped} 条` : ''))
    if (data.skipped > 0) {
      const skippedRows = data.results.filter(r => r.skipped)
      ElMessage.info('跳过明细：' + skippedRows.map(r => `#${r.id}(${r.reason})`).join('、'))
    }
    batchDlg.value = false
    load()
  } catch (e) { ElMessage.error(e.message || '批量转单失败') }
  finally { batching.value = false }
}
// 单条快捷转单：复用现有 measureApi.convert（简易表单，门型下拉 mirror orders.vue）
const convDlg = ref(false), convRow = ref(null), converting = ref(false)
const convForm = ref({ door_bom_id: null, color: '', qty: 1, unit_price: 0, handler_sale: store.name, order_date: new Date().toISOString().slice(0, 10), lock_hole: '', style: '', board: '' })
const bomList = ref([])
const onQuickConvert = async (row) => {
  convRow.value = row
  if (!bomList.value.length) { const { data } = await bomApi.all(); bomList.value = data }
  convForm.value = { door_bom_id: null, color: '', qty: 1, unit_price: 0, handler_sale: store.name, order_date: new Date().toISOString().slice(0, 10), lock_hole: '', style: '', board: '' }
  convDlg.value = true
}
const colorsOf = (id) => { const b = bomList.value.find((x) => x.id === id); return (b && b.colors) ? b.colors.split(',').map(s => s.trim()).filter(Boolean) : [] }
const convColors = computed(() => colorsOf(convForm.value.door_bom_id))
const batchColors = computed(() => colorsOf(batchCommon.value.door_bom_id))
const rowColors = (row) => colorsOf(row.form.door_bom_id)
const onRowBomChange = (row) => { row.form.color = colorsOf(row.form.door_bom_id)[0] || '' }
const onConvBomChange = (id) => { convForm.value.color = colorsOf(id)[0] || '' }
const doConvert = async () => {
  const f = convForm.value
  if (!f.door_bom_id || !f.color || (f.unit_price === null || f.unit_price === undefined || f.unit_price === '') || !f.handler_sale || !f.order_date) {
    ElMessage.warning('门型/颜色/单价/经手人/下单日期 必填'); return
  }
  converting.value = true
  try {
    const { data } = await measureApi.convert(convRow.value.id, f)
    ElMessage.success('转单成功 ' + data.order_no)
    convDlg.value = false
    load()
  } catch (e) { ElMessage.error(e.message || '转单失败') }
  finally { converting.value = false }
}
</script>
<style scoped>
.toolbar{margin-bottom:12px;display:flex;gap:8px;align-items:center}
.order-link{color:var(--el-color-primary);cursor:pointer}
.order-link:hover{text-decoration:underline}
.cap-hint{margin-top:8px;color:var(--el-color-info);font-size:12px}
.photo-section{margin-top:16px}
.photo-title{font-weight:600;margin-bottom:8px}
.photo-empty{color:var(--el-color-info)}
.photo-grid{display:flex;flex-wrap:wrap;gap:8px}
.photo-item{width:96px;height:96px;border-radius:4px;border:1px solid var(--el-border-color)}
.batch-common{background:var(--el-fill-color-light);padding:12px;border-radius:6px;margin-bottom:12px}
.batch-common-title{font-weight:600;margin-bottom:8px}
.batch-rows-title{font-weight:600;margin:8px 0}
.row-override-form{display:flex;flex-direction:column;gap:6px;padding:4px 0}
.row-override-form :deep(.el-input__inner),.row-override-form :deep(.el-input-number){width:100%}
</style>
