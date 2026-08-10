<template>
  <el-card shadow="never">
    <template #header><span>实时库存总表</span></template>
    <div class="toolbar">
      <el-select v-model="query.category" placeholder="分类" clearable style="width:120px" @change="load">
        <el-option label="主材" value="主材" /><el-option label="耗材" value="耗材" />
      </el-select>
      <el-input v-model="query.keyword" placeholder="名称/编码" clearable style="width:180px" @change="load" />
      <el-button type="primary" @click="load">查询</el-button>
    </div>
    <el-table :data="list" stripe border show-summary :summary-method="summary">
      <el-table-column prop="code" label="编码" width="100" />
      <el-table-column prop="name" label="物料名称" width="120" />
      <el-table-column prop="category" label="分类" width="80" />
      <el-table-column prop="spec" label="规格型号" min-width="160" />
      <el-table-column prop="unit" label="单位" width="70" />
      <el-table-column prop="stock_qty" label="当前库存" width="110" align="right" />
      <el-table-column prop="safety_stock" label="安全库存" width="110" align="right" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }"><el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag></template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { inventoryApi } from '../api'

const query = ref({ category: '', keyword: '' })
const list = ref([])

function statusType(s) { return { 充足: 'success', 不足: 'warning', 严重缺货: 'danger' }[s] || 'info' }

async function load() { list.value = (await inventoryApi.list(query.value)).data }

function summary({ columns, data }) {
  return columns.map((col, i) => {
    if (i === 0) return '合计'
    if (col.property === 'name') return `${data.length} 种物料`
    return ''
  })
}

onMounted(load)
</script>
