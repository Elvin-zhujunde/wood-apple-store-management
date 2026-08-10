<template>
  <el-card shadow="never">
    <div class="toolbar">
      <el-button type="success" @click="openAdd">+ 领料</el-button>
      <el-button type="primary" @click="load">刷新</el-button>
    </div>
    <el-table :data="list" stripe border>
      <el-table-column prop="req_no" label="领料单号" width="160" />
      <el-table-column prop="order_no" label="关联订单" width="160" />
      <el-table-column prop="customer" label="客户" min-width="120" />
      <el-table-column prop="material_name" label="物料" width="110" />
      <el-table-column prop="spec" label="规格" min-width="140" />
      <el-table-column prop="qty" label="领用数量" width="100" align="right" />
      <el-table-column prop="req_date" label="领用日期" width="110" />
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
          <el-select v-model="form.order_id" filterable style="width:100%">
            <el-option v-for="o in orders" :key="o.id" :label="`${o.order_no} (${o.customer})`" :value="o.id" />
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
import { ElMessage } from 'element-plus'
import { useUserStore } from '../store/user'

const store = useUserStore()
const query = ref({ page: 1, pageSize: 20 })
const list = ref([])
const total = ref(0)
const mats = ref([])
const orders = ref([])
const addVisible = ref(false)
const form = ref({})

const curStock = computed(() => {
  const m = mats.value.find((x) => x.id === form.value.material_id)
  return m ? `${m.stock_qty} ${m.unit}` : ''
})

async function load() {
  const res = await requisitionApi.list(query.value)
  list.value = res.data.list
  total.value = res.data.total
}

function onMaterial() {}

function openAdd() {
  form.value = {
    order_id: '', material_id: '', qty: 0,
    req_date: new Date().toISOString().slice(0, 10), handler: store.name,
  }
  addVisible.value = true
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
  orders.value = (await orderApi.list({ pageSize: 999 })).data.list
  load()
})
</script>
