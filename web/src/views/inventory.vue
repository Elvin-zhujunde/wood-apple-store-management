<template>
  <el-card shadow="never">
    <div class="toolbar">
      <el-select v-model="query.category" placeholder="全部分类" clearable style="width:140px" @change="load">
        <el-option label="主材" value="主材" />
        <el-option label="耗材" value="耗材" />
      </el-select>
      <el-input v-model="query.keyword" placeholder="物料名称/编码" clearable style="width:200px" @change="load" />
      <el-button type="primary" @click="load">查询</el-button>
    </div>
    <el-table :data="list" stripe border>
      <el-table-column prop="code" label="编码" width="100" />
      <el-table-column prop="name" label="物料名称" width="120" />
      <el-table-column prop="category" label="分类" width="80" />
      <el-table-column prop="spec" label="规格型号" min-width="160" />
      <el-table-column prop="unit" label="单位" width="70" />
      <el-table-column prop="stock_qty" label="当前库存" width="100" align="right" />
      <el-table-column prop="safety_stock" label="安全库存" width="100" align="right" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="90">
        <template #default="{ row }">
          <el-button link type="primary" @click="viewDetail(row)">流水</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="detailVisible" title="库存变动流水" width="780px">
      <el-descriptions :column="3" border size="small" v-if="detail">
        <el-descriptions-item label="物料">{{ detail.name }}</el-descriptions-item>
        <el-descriptions-item label="当前库存">{{ detail.stock_qty }} {{ detail.unit }}</el-descriptions-item>
        <el-descriptions-item label="安全库存">{{ detail.safety_stock }} {{ detail.unit }}</el-descriptions-item>
      </el-descriptions>
      <div class="toolbar" style="margin-top:12px">
        <el-select v-model="logQuery.change_type" placeholder="类型" clearable style="width:110px" @change="searchLogs">
          <el-option label="入库" value="in" />
          <el-option label="出库" value="out" />
        </el-select>
        <el-input v-model="logQuery.ref_no" placeholder="关联单据号" clearable style="width:160px" @change="searchLogs" />
        <el-date-picker v-model="logQuery.dateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" style="width:220px" @change="searchLogs" />
        <el-button type="primary" size="small" @click="searchLogs">查询</el-button>
      </div>
      <el-table :data="detail?.logs || []" size="small" border style="margin-top:8px">
        <el-table-column prop="created_at" label="时间" width="170" :formatter="dateTimeFmt" />
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            <el-tag :type="row.change_type === 'in' ? 'success' : 'danger'" size="small">
              {{ row.change_type === 'in' ? '入库' : '出库' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="qty" label="数量" width="90" />
        <el-table-column prop="ref_no" label="关联单据" min-width="140" />
        <el-table-column prop="operator" label="操作人" width="90" />
      </el-table>
      <el-pagination v-model:current-page="logQuery.page" :page-size="logQuery.pageSize" :total="logTotal" layout="total, prev, pager, next" size="small" style="margin-top:8px" @current-change="loadLogs" />
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { inventoryApi } from '../api'
import { dateTimeFmt } from '../utils/date'

const query = ref({ category: '', keyword: '' })
const list = ref([])
const detailVisible = ref(false)
const detail = ref(null)
const curMaterialId = ref(null)
const logQuery = ref({ change_type: '', ref_no: '', dateRange: [], page: 1, pageSize: 20 })
const logTotal = ref(0)

function statusType(s) {
  return { 充足: 'success', 不足: 'warning', 严重缺货: 'danger' }[s] || 'info'
}

async function load() {
  const res = await inventoryApi.list(query.value)
  list.value = res.data
}

async function viewDetail(row) {
  curMaterialId.value = row.id
  logQuery.value = { change_type: '', ref_no: '', dateRange: [], page: 1, pageSize: 20 }
  await loadLogs()
  detailVisible.value = true
}

async function loadLogs() {
  const params = { ...logQuery.value }
  if (params.dateRange && params.dateRange.length === 2) {
    params.startDate = params.dateRange[0]
    params.endDate = params.dateRange[1]
  }
  delete params.dateRange
  const res = await inventoryApi.detail(curMaterialId.value, params)
  detail.value = res.data
  logTotal.value = res.data.log_total
}

function searchLogs() {
  logQuery.value.page = 1
  loadLogs()
}

onMounted(load)
</script>
