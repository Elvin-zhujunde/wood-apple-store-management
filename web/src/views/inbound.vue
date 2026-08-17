<template>
  <el-card shadow="never">
    <div class="toolbar">
      <el-input v-model="query.inbound_no" placeholder="入库单号" clearable style="width:150px" @change="load" />
      <el-select v-model="query.material_id" placeholder="物料" clearable filterable style="width:160px" @change="load">
        <el-option v-for="m in mats" :key="m.id" :label="`${m.code} ${m.name}`" :value="m.id" />
      </el-select>
      <el-input v-model="query.supplier" placeholder="厂家" clearable style="width:140px" @change="load" />
      <el-input v-model="query.handler" placeholder="经手人" clearable style="width:110px" @change="load" />
      <el-select v-model="query.status" placeholder="状态" clearable style="width:110px" @change="load">
        <el-option label="待到货" value="待到货" />
        <el-option label="已到货" value="已到货" />
      </el-select>
      <el-date-picker v-model="query.dateRange" type="daterange" range-separator="至" start-placeholder="进货开始" end-placeholder="进货结束" value-format="YYYY-MM-DD" style="width:240px" @change="load" />
      <el-button type="primary" @click="load">查询</el-button>
      <el-button @click="resetQuery">重置</el-button>
      <el-button type="success" @click="openAdd">+ 入库单</el-button>
      <el-button type="warning" :disabled="batchConfirmableCount === 0" @click="openBatchConfirm">批量确认到货 ({{ batchConfirmableCount }})</el-button>
    </div>
    <el-table :data="list" stripe border @selection-change="onSelectionChange">
      <el-table-column type="selection" width="42" />
      <el-table-column prop="inbound_no" label="入库单号" width="160" />
      <el-table-column prop="material_name" label="物料" width="110" />
      <el-table-column prop="spec" label="规格" min-width="140" />
      <el-table-column prop="supplier" label="进货厂家" min-width="120" />
      <el-table-column prop="qty" label="数量" width="80" align="right" />
      <el-table-column prop="unit_price" label="进价" width="80" align="right" />
      <el-table-column prop="freight" label="物流费" width="90" align="right" />
      <el-table-column label="总进价" width="100" align="right">
        <template #default="{ row }">{{ totalCost(row) }}</template>
      </el-table-column>
      <el-table-column prop="purchase_date" label="进货日" width="120" :formatter="dateFmt" />
      <el-table-column prop="actual_arrival" label="到货日" width="120" :formatter="dateFmt" />
      <el-table-column prop="handler" label="经手人" width="80" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === '已到货' ? 'success' : 'warning'" size="small">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status === '待到货'" link type="primary" @click="openConfirm(row)">确认到货</el-button>
          <el-button link type="primary" @click="openImages(row)">图片</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-model:current-page="query.page"
      :page-size="query.pageSize"
      :total="total"
      layout="total, prev, pager, next"
      style="margin-top:12px"
      @current-change="load"
    />

    <!-- 新增 -->
    <el-dialog v-model="addVisible" title="采购入库单" width="860px" :close-on-click-modal="false" top="6vh">
      <el-form :model="form" label-width="100px">
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="物料" required>
            <el-select v-model="form.material_id" filterable style="width:100%" @change="onMaterial">
              <el-option v-for="m in mats" :key="m.id" :label="`${m.code} ${m.name}`" :value="m.id" />
            </el-select>
          </el-form-item></el-col>
          <el-col :span="12"><el-form-item label="规格"><el-input :model-value="curSpec" disabled /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="进货厂家" required><el-input v-model="form.supplier" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="进货数量" required><el-input-number v-model="form.qty" :min="0" :precision="3" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="进货单价" required><el-input-number v-model="form.unit_price" :min="0" :precision="2" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="物流费用"><el-input-number v-model="form.freight" :min="0" :precision="2" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="总进价"><el-input :model-value="formTotalCost" disabled /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="进货日期" required><el-date-picker v-model="form.purchase_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="预计到货"><el-date-picker v-model="form.expected_arrival" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="经手人" required><el-input v-model="form.handler" /></el-form-item></el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="addVisible = false">取消</el-button>
        <el-button type="primary" @click="onAdd">创建（待到货）</el-button>
      </template>
    </el-dialog>

    <!-- 确认到货 -->
    <el-dialog v-model="confirmVisible" title="确认到货" width="420px">
      <el-alert type="warning" :closable="false" style="margin-bottom:12px">确认后该物料库存将增加，不可撤销。</el-alert>
      <el-form label-width="100px">
        <el-form-item label="实际到货日" required>
          <el-date-picker v-model="confirmDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="confirmVisible = false">取消</el-button>
        <el-button type="primary" @click="onConfirm">确认到货</el-button>
      </template>
    </el-dialog>

    <!-- 批量确认到货 -->
    <el-dialog v-model="batchConfirmVisible" title="批量确认到货" width="440px" :close-on-click-modal="false">
      <el-alert type="warning" :closable="false" style="margin-bottom:12px">
        共选中 <strong>{{ selectedRows.length }}</strong> 单，其中 <strong>{{ batchConfirmableCount }}</strong> 单为"待到货"可确认
        <div v-if="batchConfirmableCount < selectedRows.length" style="color:#e6a23c;margin-top:4px">已到货订单将自动跳过</div>
        <div style="margin-top:4px">确认后对应物料库存将增加，逐条独立处理，单条失败不影响其他。</div>
      </el-alert>
      <el-form label-width="100px">
        <el-form-item label="实际到货日" required>
          <el-date-picker v-model="batchConfirmDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchConfirmVisible = false">取消</el-button>
        <el-button type="primary" :disabled="batchConfirmableCount === 0" @click="onBatchConfirm">确认批量到货</el-button>
      </template>
    </el-dialog>

    <!-- 图片管理（采购留痕：进货票据/到货实拍/运费票） -->
    <el-dialog v-model="imgVisible" :title="`采购入库图片 · ${curImgNo}`" width="560px">
      <el-alert type="info" :closable="false" style="margin-bottom:12px">采购留痕：可上传进货票据、到货实拍、运费票等。图片非必填。</el-alert>
      <ImageUpload v-model="imgList" entity-type="inbound" :entity-id="curImgId" />
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { inboundApi, materialApi, attachmentApi } from '../api'
import { dateFmt, todayLocal } from '../utils/date'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../store/user'
import ImageUpload from '../components/ImageUpload.vue'

const store = useUserStore()
const query = ref({ inbound_no: '', material_id: '', supplier: '', handler: '', status: '', dateRange: [], page: 1, pageSize: 20 })
const list = ref([])
const total = ref(0)
const mats = ref([])
const addVisible = ref(false)
const confirmVisible = ref(false)
const confirmId = ref(null)
const confirmDate = ref('')
const form = ref({})
const imgVisible = ref(false)
const curImgId = ref(null)
const curImgNo = ref('')
const imgList = ref([])

// 批量确认到货
const selectedRows = ref([])
const batchConfirmVisible = ref(false)
const batchConfirmDate = ref('')
const batchConfirmableCount = computed(() => selectedRows.value.filter((r) => r.status === '待到货').length)

function onSelectionChange(rows) {
  selectedRows.value = rows
}

function openBatchConfirm() {
  batchConfirmDate.value = todayLocal()
  batchConfirmVisible.value = true
}

async function onBatchConfirm() {
  if (!batchConfirmDate.value) return ElMessage.warning('请选择到货日期')
  const ids = selectedRows.value.map((r) => r.id)
  const res = await inboundApi.batchConfirm(ids, { actual_arrival: batchConfirmDate.value })
  const d = res.data || {}
  if (d.failed > 0) {
    ElMessage.warning(res.msg || `批量确认完成：${d.success} 成功，${d.failed} 失败`)
  } else {
    ElMessage.success(res.msg || `批量确认完成：${d.success} 单成功`)
  }
  batchConfirmVisible.value = false
  load()
}

const curSpec = computed(() => {
  const m = mats.value.find((x) => x.id === form.value.material_id)
  return m ? `${m.spec} / ${m.unit}` : ''
})

// R10 总进价 = 单价×数量+运费（前端实时算，不存库）
const formTotalCost = computed(() => {
  const f = form.value
  return (Number(f.qty) * Number(f.unit_price) + Number(f.freight || 0)).toFixed(2)
})
function totalCost(row) {
  return (Number(row.qty) * Number(row.unit_price) + Number(row.freight || 0)).toFixed(2)
}

async function load() {
  const params = { ...query.value }
  if (params.dateRange && params.dateRange.length === 2) {
    params.startDate = params.dateRange[0]
    params.endDate = params.dateRange[1]
  }
  delete params.dateRange
  const res = await inboundApi.list(params)
  list.value = res.data.list
  total.value = res.data.total
}

function resetQuery() {
  query.value = { inbound_no: '', material_id: '', supplier: '', handler: '', status: '', dateRange: [], page: 1, pageSize: 20 }
  load()
}

function onMaterial() {}

function openAdd() {
  form.value = {
    material_id: '', supplier: '', qty: 0, unit_price: 0, freight: 0,
    purchase_date: todayLocal(), expected_arrival: '', handler: store.name,
  }
  addVisible.value = true
}

async function onAdd() {
  const f = form.value
  if (!f.material_id || !f.supplier || !f.qty || !f.unit_price || !f.purchase_date || !f.handler)
    return ElMessage.warning('请补全必填项')
  await inboundApi.create(f)
  ElMessage.success('入库单已创建')
  addVisible.value = false
  load()
}

function openConfirm(row) {
  confirmId.value = row.id
  confirmDate.value = todayLocal()
  confirmVisible.value = true
}

async function onConfirm() {
  if (!confirmDate.value) return ElMessage.warning('请选择到货日期')
  await inboundApi.confirm(confirmId.value, { actual_arrival: confirmDate.value })
  ElMessage.success('已确认到货，库存已增加')
  confirmVisible.value = false
  load()
}

async function openImages(row) {
  curImgId.value = row.id
  curImgNo.value = row.inbound_no
  imgList.value = []
  if (row.id) {
    const res = await attachmentApi.list('inbound', row.id)
    imgList.value = res.data
  }
  imgVisible.value = true
}

onMounted(async () => {
  mats.value = (await materialApi.all()).data
  load()
})
</script>
