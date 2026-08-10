<template>
  <el-card shadow="never">
    <div class="toolbar">
      <el-input v-model="query.order_no" placeholder="关联订单号" clearable style="width:150px" @change="load" />
      <el-select v-model="query.material_id" placeholder="物料" clearable filterable style="width:160px" @change="load">
        <el-option v-for="m in mats" :key="m.id" :label="`${m.code} ${m.name}`" :value="m.id" />
      </el-select>
      <el-input v-model="query.handler" placeholder="经手人" clearable style="width:110px" @change="load" />
      <el-date-picker v-model="query.dateRange" type="daterange" range-separator="至" start-placeholder="领用开始" end-placeholder="领用结束" value-format="YYYY-MM-DD" style="width:240px" @change="load" />
      <el-button type="primary" @click="load">查询</el-button>
      <el-button @click="resetQuery">重置</el-button>
      <el-button type="success" @click="openAdd">+ 领料</el-button>
    </div>
    <el-table :data="list" stripe border>
      <el-table-column prop="req_no" label="领料单号" width="160" />
      <el-table-column prop="order_no" label="关联订单" width="160" />
      <el-table-column prop="customer" label="客户" min-width="120" />
      <el-table-column prop="material_name" label="物料" width="110" />
      <el-table-column prop="spec" label="规格" min-width="140" />
      <el-table-column prop="qty" label="领用数量" width="100" align="right" />
      <el-table-column prop="req_date" label="领用日期" width="120" :formatter="dateFmt" />
      <el-table-column prop="handler" label="经手人" width="90" />
    </el-table>
    <el-pagination
      v-model:current-page="query.page"
      :page-size="query.pageSize"
      :total="total"
      layout="total, prev, pager, next"
      style="margin-top:12px"
      @current-change="load"
    />

    <el-dialog v-model="addVisible" title="生产领料" width="560px" :close-on-click-modal="false">
      <el-form :model="form" label-width="100px">
        <el-form-item label="关联订单" required>
          <el-select v-model="form.order_id" filterable remote :remote-method="searchOrder" :loading="orderLoading" placeholder="输入订单号/客户搜索" style="width:100%">
            <el-option v-for="o in orderOptions" :key="o.id" :label="`${o.order_no} (${o.customer})`" :value="o.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="物料" required>
          <el-select v-model="form.material_id" filterable style="width:100%" @change="onMaterial">
            <el-option v-for="m in mats" :key="m.id" :label="`${m.code} ${m.name} (库存${m.stock_qty})`" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="当前库存"><el-input :model-value="curStock" disabled /></el-form-item>
        <el-form-item label="领用数量" required><el-input-number v-model="form.qty" :min="0" :precision="3" style="width:100%" /></el-form-item>
        <el-form-item label="领用日期" required><el-date-picker v-model="form.req_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="经手人" required><el-input v-model="form.handler" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addVisible = false">取消</el-button>
        <el-button type="primary" @click="onAdd">确认领料</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { requisitionApi, materialApi, orderApi } from '../api'
import { dateFmt, todayLocal } from '../utils/date'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../store/user'

const store = useUserStore()
const query = ref({ order_no: '', material_id: '', handler: '', dateRange: [], page: 1, pageSize: 20 })
const list = ref([])
const total = ref(0)
const mats = ref([])
const orderOptions = ref([])
const orderLoading = ref(false)
const addVisible = ref(false)
const form = ref({})

const curStock = computed(() => {
  const m = mats.value.find((x) => x.id === form.value.material_id)
  return m ? `${m.stock_qty} ${m.unit}` : ''
})

async function load() {
  const params = { ...query.value }
  if (params.dateRange && params.dateRange.length === 2) {
    params.startDate = params.dateRange[0]
    params.endDate = params.dateRange[1]
  }
  delete params.dateRange
  const res = await requisitionApi.list(params)
  list.value = res.data.list
  total.value = res.data.total
}

function resetQuery() {
  query.value = { order_no: '', material_id: '', handler: '', dateRange: [], page: 1, pageSize: 20 }
  load()
}

function onMaterial() {}

function openAdd() {
  form.value = {
    order_id: '', material_id: '', qty: 0,
    req_date: todayLocal(), handler: store.name,
  }
  orderOptions.value = []
  addVisible.value = true
}

// 远程搜索订单（避免全量加载3213条卡顿）
async function searchOrder(q) {
  if (!q) { orderOptions.value = []; return }
  orderLoading.value = true
  try {
    const res = await orderApi.list({ keyword: q, pageSize: 20 })
    orderOptions.value = res.data.list
  } finally {
    orderLoading.value = false
  }
}

async function onAdd() {
  const f = form.value
  if (!f.order_id || !f.material_id || !f.qty || !f.req_date || !f.handler)
    return ElMessage.warning('请补全必填项')
  await requisitionApi.create(f)
  ElMessage.success('领料成功，库存已减少')
  addVisible.value = false
  mats.value = (await materialApi.all()).data
  load()
}

onMounted(async () => {
  mats.value = (await materialApi.all()).data
  load()
})
</script>
