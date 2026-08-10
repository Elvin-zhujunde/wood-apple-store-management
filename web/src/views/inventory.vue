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

    <el-dialog v-model="detailVisible" title="库存变动流水" width="700px">
      <el-descriptions :column="3" border size="small" v-if="detail">
        <el-descriptions-item label="物料">{{ detail.name }}</el-descriptions-item>
        <el-descriptions-item label="当前库存">{{ detail.stock_qty }} {{ detail.unit }}</el-descriptions-item>
        <el-descriptions-item label="安全库存">{{ detail.safety_stock }} {{ detail.unit }}</el-descriptions-item>
      </el-descriptions>
      <el-table :data="detail?.logs || []" size="small" border style="margin-top:12px">
        <el-table-column prop="created_at" label="时间" width="170" />
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            <el-tag :type="row.change_type === 'in' ? 'success' : 'danger'" size="small">
              {{ row.change_type === 'in' ? '入库' : '出库' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="qty" label="数量" width="90" />
        <el-table-column prop="ref_no" label="关联单据" />
        <el-table-column prop="operator" label="操作人" width="90" />
      </el-table>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { inventoryApi } from '../api'

const query = ref({ category: '', keyword: '' })
const list = ref([])
const detailVisible = ref(false)
const detail = ref(null)

function statusType(s) {
  return { 充足: 'success', 不足: 'warning', 严重缺货: 'danger' }[s] || 'info'
}

async function load() {
  const res = await inventoryApi.list(query.value)
  list.value = res.data
}

async function viewDetail(row) {
  const res = await inventoryApi.detail(row.id)
  detail.value = res.data
  detailVisible.value = true
}

onMounted(load)
</script>
