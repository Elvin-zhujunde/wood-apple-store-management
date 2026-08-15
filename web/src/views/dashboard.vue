<template>
  <div class="dashboard">
    <!-- 顶部指标卡（业务指标，老板视角） -->
    <el-row :gutter="16" class="stat-row">
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card" @click="goOrders()">
          <div class="stat-num" style="color:#409eff">¥{{ fmtMoney(m.totalReceivable) }}</div>
          <div class="stat-label">销售额总计（应收）</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card" @click="goOrders('已收款')">
          <div class="stat-num" style="color:#67c23a">¥{{ fmtMoney(m.totalReceived) }}</div>
          <div class="stat-label">已收款总计</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card" @click="goOrders('已发货')">
          <div class="stat-num" style="color:#f56c6c">¥{{ fmtMoney(m.totalUnpaid) }}</div>
          <div class="stat-label">欠款总计</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card" @click="goOrders()">
          <div class="stat-num" style="color:#e6a23c">¥{{ fmtMoney(m.monthSales) }}</div>
          <div class="stat-label">本月销售额</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 第二行指标卡（数量+金额） -->
    <el-row :gutter="16" class="stat-row mt">
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card" @click="goOrders('新建')">
          <div class="stat-num" style="color:#409eff">{{ m.pendingShipCount }}</div>
          <div class="stat-label">待发货订单 · ¥{{ fmtMoney(m.pendingShipAmount) }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card" @click="goOrders('已发货')">
          <div class="stat-num" style="color:#67c23a">{{ m.pendingPayCount }}</div>
          <div class="stat-label">待收款订单 · ¥{{ fmtMoney(m.pendingPayAmount) }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card" @click="go('/orders')">
          <div class="stat-num">{{ m.orderCount }}</div>
          <div class="stat-label">销售订单总数</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card" @click="go('/suggestion')">
          <div class="stat-num" :style="{ color: m.shortageCount ? '#f56c6c' : '#909399' }">{{ m.shortageCount }}</div>
          <div class="stat-label">库存不足/缺货物料</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- ECharts 图表区 -->
    <el-row :gutter="16" class="mt">
      <el-col :xs="24" :lg="12">
        <el-card shadow="never" class="chart-card">
          <template #header><span>近 6 个月销售额趋势</span></template>
          <div ref="trendChart" class="chart-box"></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="never" class="chart-card">
          <template #header><span>订单状态分布</span></template>
          <div ref="orderChart" class="chart-box"></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="never" class="chart-card">
          <template #header><span>库存状态分布</span></template>
          <div ref="invChart" class="chart-box"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 待办清单 -->
    <el-row :gutter="16" class="mt">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="never" class="todo-card">
          <template #header>
            <div class="todo-header" @click="go('/suggestion')">
              <span class="dot dot-red"></span><span>待采购</span>
              <el-badge :value="m.shortageCount" :hidden="!m.shortageCount" type="danger" class="todo-badge" />
            </div>
          </template>
          <div v-if="!todo.urgentSug.length" class="empty">暂无待办</div>
          <div v-else>
            <div v-for="s in todo.urgentSug" :key="s.id" class="todo-item" @click="go('/suggestion')">
              <div class="todo-main">{{ s.name }} <span class="todo-sub">{{ s.code }}</span></div>
              <div class="todo-meta">库存 <strong style="color:#f56c6c">{{ s.stock_qty }}</strong> / 安全 {{ s.safety_stock }} {{ s.unit }}</div>
            </div>
            <el-button link type="primary" size="small" @click="go('/suggestion')">查看全部 →</el-button>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="never" class="todo-card">
          <template #header>
            <div class="todo-header" @click="go('/inbound')">
              <span class="dot dot-yellow"></span><span>待到货入库</span>
            </div>
          </template>
          <div v-if="!todo.pendingInbound.length" class="empty">暂无待办</div>
          <div v-else>
            <div v-for="i in todo.pendingInbound" :key="i.id" class="todo-item" @click="go('/inbound')">
              <div class="todo-main">{{ i.material_name }} <span class="todo-sub">{{ i.inbound_no }}</span></div>
              <div class="todo-meta">{{ i.supplier }} · 数量 {{ i.qty }}</div>
            </div>
            <el-button link type="primary" size="small" @click="go('/inbound')">查看全部 →</el-button>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="never" class="todo-card">
          <template #header>
            <div class="todo-header" @click="goOrders('新建')">
              <span class="dot dot-blue"></span><span>待发货订单</span>
              <el-badge :value="m.pendingShipCount" :hidden="!m.pendingShipCount" type="primary" class="todo-badge" />
            </div>
          </template>
          <div v-if="!todo.pendingShip.length" class="empty">暂无待办</div>
          <div v-else>
            <div v-for="o in todo.pendingShip" :key="o.id" class="todo-item" @click="goOrders('新建')">
              <div class="todo-main">{{ o.customer }} <span class="todo-sub">{{ o.order_no }}</span></div>
              <div class="todo-meta">{{ o.door_bom_name }} · {{ o.qty }}樘 · 下单 {{ fmtDate(o.order_date) }}</div>
            </div>
            <el-button link type="primary" size="small" @click="goOrders('新建')">查看全部 →</el-button>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="never" class="todo-card">
          <template #header>
            <div class="todo-header" @click="goOrders('已发货')">
              <span class="dot dot-green"></span><span>待收款订单</span>
              <el-badge :value="m.pendingPayCount" :hidden="!m.pendingPayCount" type="success" class="todo-badge" />
            </div>
          </template>
          <div v-if="!todo.pendingPay.length" class="empty">暂无待办</div>
          <div v-else>
            <div v-for="o in todo.pendingPay" :key="o.id" class="todo-item" @click="goOrders('已发货')">
              <div class="todo-main">{{ o.customer }} <span class="todo-sub">{{ o.order_no }}</span></div>
              <div class="todo-meta">应收 ¥{{ fmtMoney(o.total_amount) }} · 发货 {{ fmtDate(o.actual_ship_date) }}</div>
            </div>
            <el-button link type="primary" size="small" @click="goOrders('已发货')">查看全部 →</el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { dashboardApi } from '../api'
import { fmtDate } from '../utils/date'

const router = useRouter()
const m = ref({ totalReceivable: 0, totalReceived: 0, totalUnpaid: 0, monthSales: 0, pendingShipAmount: 0, pendingPayAmount: 0, orderCount: 0, pendingShipCount: 0, pendingPayCount: 0, shortageCount: 0 })
const todo = ref({ urgentSug: [], pendingInbound: [], pendingShip: [], pendingPay: [] })
const salesTrend = ref([])
const orderStatus = ref([])
const inventoryStatus = ref([])

const trendChart = ref(null)
const orderChart = ref(null)
const invChart = ref(null)
let charts = []

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}
function go(path) { router.push(path) }
function goOrders(status) {
  router.push(status ? { path: '/orders', query: { status } } : '/orders')
}

function renderCharts() {
  // 销售额趋势折线
  const c1 = echarts.init(trendChart.value)
  c1.setOption({
    tooltip: { trigger: 'axis', formatter: (p) => `${p[0].name}<br/>销售额 ¥${fmtMoney(p[0].value)}<br/>订单 ${p[1].value} 单` },
    legend: { data: ['销售额', '订单数'], top: 0 },
    grid: { left: 50, right: 20, top: 36, bottom: 30 },
    xAxis: { type: 'category', data: salesTrend.value.map((t) => t.month.slice(5)) },
    yAxis: [
      { type: 'value', name: '元', axisLabel: { formatter: (v) => v >= 10000 ? (v / 10000).toFixed(0) + '万' : v } },
      { type: 'value', name: '单', minInterval: 1 },
    ],
    series: [
      { name: '销售额', type: 'line', smooth: true, data: salesTrend.value.map((t) => t.sales), itemStyle: { color: '#409eff' }, areaStyle: { opacity: 0.15 } },
      { name: '订单数', type: 'line', yAxisIndex: 1, smooth: true, data: salesTrend.value.map((t) => t.count), itemStyle: { color: '#67c23a' } },
    ],
  })
  // 订单状态饼图
  const c2 = echarts.init(orderChart.value)
  c2.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} 单 ({d}%)' },
    legend: { bottom: 0, type: 'scroll' },
    series: [{
      type: 'pie', radius: ['40%', '65%'], center: ['50%', '42%'],
      label: { formatter: '{b}\n{c}单', fontSize: 11 },
      data: orderStatus.value.filter((d) => d.value > 0),
      color: ['#409eff', '#e6a23c', '#67c23a'],
    }],
  })
  // 库存状态饼图
  const c3 = echarts.init(invChart.value)
  c3.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} 种 ({d}%)' },
    legend: { bottom: 0, type: 'scroll' },
    series: [{
      type: 'pie', radius: ['40%', '65%'], center: ['50%', '42%'],
      label: { formatter: '{b}\n{c}种', fontSize: 11 },
      data: inventoryStatus.value.filter((d) => d.value > 0),
      color: ['#67c23a', '#e6a23c', '#f56c6c'],
    }],
  })
  charts = [c1, c2, c3]
}

function onResize() { charts.forEach((c) => c && c.resize()) }

onMounted(async () => {
  const res = await dashboardApi.stats()
  const d = res.data
  m.value = d.metrics
  todo.value = d.todo
  salesTrend.value = d.salesTrend
  orderStatus.value = d.orderStatus
  inventoryStatus.value = d.inventoryStatus
  await nextTick()
  renderCharts()
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  charts.forEach((c) => c && c.dispose())
})
</script>

<style scoped>
.dashboard { }
.stat-row { margin-bottom: 0; }
.stat-card { cursor: pointer; }
.stat-num { font-size: 28px; font-weight: 700; color: #409eff; }
.stat-label { color: #909399; font-size: 13px; margin-top: 4px; }
.mt { margin-top: 16px; }
.chart-card { height: 320px; }
.chart-box { height: 260px; }
.todo-card { height: 100%; }
.todo-header { display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 600; }
.todo-badge { margin-left: auto; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.dot-red { background: #f56c6c; } .dot-yellow { background: #e6a23c; }
.dot-blue { background: #409eff; } .dot-green { background: #67c23a; }
.todo-item { padding: 8px 0; border-bottom: 1px dashed #ebeef5; cursor: pointer; }
.todo-item:hover { background: #f5f7fa; }
.todo-main { font-size: 14px; color: #303133; }
.todo-sub { color: #909399; font-size: 12px; margin-left: 4px; }
.todo-meta { font-size: 12px; color: #909399; margin-top: 2px; }
.empty { color: #c0c4cc; font-size: 13px; text-align: center; padding: 16px 0; }
@media (max-width: 768px) { .stat-num { font-size: 20px; } .chart-box { height: 220px; } .chart-card { height: 280px; } }
</style>
