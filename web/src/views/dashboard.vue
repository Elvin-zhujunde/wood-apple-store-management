<template>
  <div>
    <!-- 顶部统计卡 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card" @click="go('/suggestion')">
          <div class="stat-num warning">{{ stats.shortage }}</div>
          <div class="stat-label">库存不足/缺货</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card" @click="go('/inbound')">
          <div class="stat-num" style="color:#e6a23c">{{ stats.pendingInbound }}</div>
          <div class="stat-label">待到货采购单</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card" @click="go('/suggestion')">
          <div class="stat-num" style="color:#f56c6c">{{ stats.pendingSuggestion }}</div>
          <div class="stat-label">待采购建议</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card" @click="go('/orders')">
          <div class="stat-num" style="color:#67c23a">{{ stats.orderCount }}</div>
          <div class="stat-label">销售订单总数</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 待办清单 -->
    <el-row :gutter="16" class="mt">
      <!-- 🔴 紧急待采购建议 -->
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="never" class="todo-card">
          <template #header>
            <div class="todo-header" @click="go('/suggestion')">
              <span class="dot dot-red"></span>
              <span>紧急待采购</span>
              <el-badge :value="urgentSug.length" :hidden="!urgentSug.length" type="danger" class="todo-badge" />
            </div>
          </template>
          <div v-if="urgentSug.length === 0" class="empty">暂无待办</div>
          <div v-else>
            <div v-for="s in urgentSug" :key="s.id" class="todo-item" @click="go('/suggestion')">
              <div class="todo-main">{{ s.name }} <span class="todo-sub">{{ s.code }}</span></div>
              <div class="todo-meta">建议采购 <strong style="color:#f56c6c">{{ s.suggest_qty }}</strong> {{ s.unit }} · {{ s.customer }}</div>
            </div>
            <el-button link type="primary" size="small" @click="go('/suggestion')">查看全部 →</el-button>
          </div>
        </el-card>
      </el-col>

      <!-- 🟡 待到货入库单 -->
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="never" class="todo-card">
          <template #header>
            <div class="todo-header" @click="go('/inbound')">
              <span class="dot dot-yellow"></span>
              <span>待到货入库</span>
              <el-badge :value="pendingInbound.length" :hidden="!pendingInbound.length" type="warning" class="todo-badge" />
            </div>
          </template>
          <div v-if="pendingInbound.length === 0" class="empty">暂无待办</div>
          <div v-else>
            <div v-for="i in pendingInbound" :key="i.id" class="todo-item" @click="go('/inbound')">
              <div class="todo-main">{{ i.material_name }} <span class="todo-sub">{{ i.inbound_no }}</span></div>
              <div class="todo-meta">{{ i.supplier }} · 数量 {{ i.qty }}</div>
            </div>
            <el-button link type="primary" size="small" @click="go('/inbound')">查看全部 →</el-button>
          </div>
        </el-card>
      </el-col>

      <!-- 🔵 待发货订单 -->
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="never" class="todo-card">
          <template #header>
            <div class="todo-header" @click="goOrders('新建')">
              <span class="dot dot-blue"></span>
              <span>待发货订单</span>
              <el-badge :value="pendingShip.length" :hidden="!pendingShip.length" type="primary" class="todo-badge" />
            </div>
          </template>
          <div v-if="pendingShip.length === 0" class="empty">暂无待办</div>
          <div v-else>
            <div v-for="o in pendingShip" :key="o.id" class="todo-item" @click="goOrders('新建')">
              <div class="todo-main">{{ o.customer }} <span class="todo-sub">{{ o.order_no }}</span></div>
              <div class="todo-meta">{{ o.door_bom_name }} · {{ o.qty }}樘 · 下单 {{ fmtDate(o.order_date) }}</div>
            </div>
            <el-button link type="primary" size="small" @click="goOrders('新建')">查看全部 →</el-button>
          </div>
        </el-card>
      </el-col>

      <!-- 🟢 待收款订单 -->
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="never" class="todo-card">
          <template #header>
            <div class="todo-header" @click="goOrders('已发货')">
              <span class="dot dot-green"></span>
              <span>待收款订单</span>
              <el-badge :value="pendingPay.length" :hidden="!pendingPay.length" type="success" class="todo-badge" />
            </div>
          </template>
          <div v-if="pendingPay.length === 0" class="empty">暂无待办</div>
          <div v-else>
            <div v-for="o in pendingPay" :key="o.id" class="todo-item" @click="goOrders('已发货')">
              <div class="todo-main">{{ o.customer }} <span class="todo-sub">{{ o.order_no }}</span></div>
              <div class="todo-meta">应收 ¥{{ o.total_amount }} · 发货 {{ fmtDate(o.actual_ship_date) }}</div>
            </div>
            <el-button link type="primary" size="small" @click="goOrders('已发货')">查看全部 →</el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 库存状态一览（保留，折叠到下方） -->
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
import { useRouter } from 'vue-router'
import { inventoryApi, inboundApi, suggestionApi, orderApi } from '../api'
import { fmtDate } from '../utils/date'

const router = useRouter()
const inventory = ref([])
const pendingInbound = ref([])
const urgentSug = ref([])
const pendingShip = ref([])
const pendingPay = ref([])

const pendingInboundTotal = ref(0)
const pendingSuggestionTotal = ref(0)
const orderCount = ref(0)

const stats = computed(() => ({
  shortage: inventory.value.filter((m) => m.status !== '充足').length,
  pendingInbound: pendingInboundTotal.value,
  pendingSuggestion: pendingSuggestionTotal.value,
  orderCount: orderCount.value,
}))

function statusType(s) {
  return { 充足: 'success', 不足: 'warning', 严重缺货: 'danger' }[s] || 'info'
}

function go(path) {
  router.push(path)
}
function goOrders(status) {
  router.push({ path: '/orders', query: { status } })
}

onMounted(async () => {
  const [inv, inbList, inbTotal, sugList, sugTotal, ship, pay, ordTotal] = await Promise.all([
    inventoryApi.list(),
    inboundApi.list({ status: '待到货', pageSize: 5 }),
    inboundApi.list({ status: '待到货', pageSize: 1 }),
    suggestionApi.list({ status: '待采购', priority: '紧急', pageSize: 5 }),
    suggestionApi.list({ status: '待采购', pageSize: 1 }),
    orderApi.list({ status: '新建', pageSize: 5 }),
    orderApi.list({ status: '已发货', pageSize: 5 }),
    orderApi.list({ pageSize: 1 }),
  ])
  inventory.value = inv.data
  pendingInbound.value = inbList.data.list
  pendingInboundTotal.value = inbTotal.data.total
  urgentSug.value = sugList.data.list
  pendingSuggestionTotal.value = sugTotal.data.total
  pendingShip.value = ship.data.list
  pendingPay.value = pay.data.list
  orderCount.value = ordTotal.data.total
})
</script>

<style scoped>
.stat-row { margin-bottom: 0; }
.stat-card { cursor: pointer; }
.stat-num { font-size: 32px; font-weight: 700; color: #409eff; }
.stat-label { color: #909399; font-size: 13px; margin-top: 4px; }
.mt { margin-top: 16px; }
.todo-card { height: 100%; }
.todo-header { display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 600; }
.todo-badge { margin-left: auto; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.dot-red { background: #f56c6c; }
.dot-yellow { background: #e6a23c; }
.dot-blue { background: #409eff; }
.dot-green { background: #67c23a; }
.todo-item { padding: 8px 0; border-bottom: 1px dashed #ebeef5; cursor: pointer; }
.todo-item:hover { background: #f5f7fa; }
.todo-main { font-size: 14px; color: #303133; }
.todo-sub { color: #909399; font-size: 12px; margin-left: 4px; }
.todo-meta { font-size: 12px; color: #909399; margin-top: 2px; }
.empty { color: #c0c4cc; font-size: 13px; text-align: center; padding: 16px 0; }
@media (max-width: 768px) {
  .stat-num { font-size: 24px; }
}
</style>
