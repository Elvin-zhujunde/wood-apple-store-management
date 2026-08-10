<template>
  <div>
    <el-row :gutter="16">
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-num warning">{{ stats.shortage }}</div>
          <div class="stat-label">库存不足/缺货物料</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-num" style="color:#e6a23c">{{ stats.pendingInbound }}</div>
          <div class="stat-label">待到货采购单</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-num" style="color:#f56c6c">{{ stats.pendingSuggestion }}</div>
          <div class="stat-label">待采购建议</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-num" style="color:#67c23a">{{ stats.orderCount }}</div>
          <div class="stat-label">销售订单总数</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="mt" shadow="never">
      <template #header><span>库存状态一览</span></template>
      <el-table :data="inventory" size="small" stripe>
        <el-table-column prop="code" label="编码" width="90" />
        <el-table-column prop="name" label="物料" width="110" />
        <el-table-column prop="spec" label="规格" />
        <el-table-column prop="stock_qty" label="当前库存" width="100" />
        <el-table-column prop="safety_stock" label="安全库存" width="100" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { inventoryApi, inboundApi, suggestionApi, orderApi } from '../api'

const inventory = ref([])
const pendingInbound = ref(0)
const pendingSuggestion = ref(0)
const orderCount = ref(0)

const stats = computed(() => ({
  shortage: inventory.value.filter((m) => m.status !== '充足').length,
  pendingInbound: pendingInbound.value,
  pendingSuggestion: pendingSuggestion.value,
  orderCount: orderCount.value,
}))

function statusType(s) {
  return { 充足: 'success', 不足: 'warning', 严重缺货: 'danger' }[s] || 'info'
}

onMounted(async () => {
  const [inv, inb, sug, ord] = await Promise.all([
    inventoryApi.list(),
    inboundApi.list({ status: '待到货', pageSize: 1 }),
    suggestionApi.list({ status: '待采购', pageSize: 1 }),
    orderApi.list({ pageSize: 1 }),
  ])
  inventory.value = inv.data
  pendingInbound.value = inb.data.total
  pendingSuggestion.value = sug.data.total
  orderCount.value = ord.data.total
})
</script>

<style scoped>
.stat-num { font-size: 32px; font-weight: 700; color: #409eff; }
.stat-label { color: #909399; font-size: 13px; margin-top: 4px; }
.warning { color: #f56c6c; }
.mt { margin-top: 16px; }
</style>
