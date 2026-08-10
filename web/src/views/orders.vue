<template>
  <el-card shadow="never">
    <div class="toolbar">
      <el-input v-model="query.order_no" placeholder="订单号" clearable style="width:150px" @change="load" />
      <el-input v-model="query.customer" placeholder="客户名称" clearable style="width:160px" @change="load" />
      <el-select v-model="query.door_bom_id" placeholder="门型" clearable style="width:140px" @change="load">
        <el-option v-for="b in bomList" :key="b.id" :label="`${b.code} ${b.name}`" :value="b.id" />
      </el-select>
      <el-input v-model="query.handler_sale" placeholder="经手人" clearable style="width:110px" @change="load" />
      <el-select v-model="query.status" placeholder="状态" clearable style="width:110px" @change="load">
        <el-option label="新建" value="新建" />
        <el-option label="已发货" value="已发货" />
        <el-option label="已收款" value="已收款" />
      </el-select>
      <el-date-picker v-model="query.dateRange" type="daterange" range-separator="至" start-placeholder="下单开始" end-placeholder="下单结束" value-format="YYYY-MM-DD" style="width:240px" @change="load" />
      <el-button type="primary" @click="load">查询</el-button>
      <el-button @click="resetQuery">重置</el-button>
      <el-button type="success" @click="openAdd">+ 接单</el-button>
    </div>
    <el-table :data="list" stripe border>
      <el-table-column prop="order_no" label="订单号" width="160" />
      <el-table-column prop="customer" label="客户" min-width="120" />
      <el-table-column prop="door_bom_name" label="门型" width="120" />
      <el-table-column prop="color" label="颜色" width="80" />
      <el-table-column prop="qty" label="数量(樘)" width="90" align="right" />
      <el-table-column prop="total_amount" label="总金额" width="100" align="right" />
      <el-table-column prop="handler_sale" label="经手人" width="80" />
      <el-table-column prop="order_date" label="下单日" width="120" :formatter="dateFmt" />
      <el-table-column prop="actual_ship_date" label="发货日" width="120" :formatter="dateFmt" />
      <el-table-column prop="pay_date" label="收款日" width="120" :formatter="dateFmt" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status === '新建'" link type="primary" class="row-btn" @click="openShip(row)">发货</el-button>
          <el-button v-if="row.status === '已发货'" link type="success" class="row-btn" @click="openPay(row)">收款</el-button>
          <el-button v-if="row.status === '已收款'" link disabled class="row-btn">已完成</el-button>
          <el-button link type="primary" @click="openEdit(row)">详情</el-button>
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

    <!-- 行内发货小弹窗 -->
    <el-dialog v-model="shipVisible" title="发货回填" width="420px" :close-on-click-modal="false">
      <el-alert type="info" :closable="false" style="margin-bottom:12px">
        订单 <strong>{{ shipRow?.order_no }}</strong> · {{ shipRow?.customer }}
      </el-alert>
      <el-form :model="shipForm" label-width="100px">
        <el-form-item label="实际发货日" required>
          <el-date-picker v-model="shipForm.actual_ship_date" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
        <el-form-item label="发货单号" required>
          <el-input v-model="shipForm.ship_no" placeholder="物流运单号" />
        </el-form-item>
        <el-form-item label="发货经手人">
          <el-input v-model="shipForm.handler_ship" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="shipVisible = false">取消</el-button>
        <el-button type="primary" @click="onShip">确认发货</el-button>
      </template>
    </el-dialog>

    <!-- 行内收款小弹窗 -->
    <el-dialog v-model="payVisible" title="收款回填" width="420px" :close-on-click-modal="false">
      <el-alert type="info" :closable="false" style="margin-bottom:12px">
        订单 <strong>{{ payRow?.order_no }}</strong> · {{ payRow?.customer }}
      </el-alert>
      <el-form :model="payForm" label-width="100px">
        <el-form-item label="收款日期" required>
          <el-date-picker v-model="payForm.pay_date" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
        <el-form-item label="收据单号" required>
          <el-input v-model="payForm.receipt_no" />
        </el-form-item>
        <el-form-item label="收款经手人">
          <el-input v-model="payForm.handler_finance" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="payVisible = false">取消</el-button>
        <el-button type="primary" @click="onPay">确认收款</el-button>
      </template>
    </el-dialog>

    <!-- 新增/编辑对话框（保留原完整表单） -->
    <el-dialog v-model="dlgVisible" :title="dlgTitle" width="760px" :close-on-click-modal="false">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="订单信息" name="info">
          <el-form :model="form" label-width="110px" size="default">
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="客户/项目" required>
                  <el-input v-model="form.customer" :disabled="isEdit" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="门型" required>
                  <el-select v-model="form.door_bom_id" :disabled="isEdit" @change="onBomChange" style="width:100%">
                    <el-option v-for="b in bomList" :key="b.id" :label="`${b.code} ${b.name}`" :value="b.id" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="颜色" required>
                  <el-select v-model="form.color" style="width:100%">
                    <el-option v-for="c in colorOptions" :key="c" :label="c" :value="c" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="规格" >
                  <el-input :model-value="bomSpec" disabled placeholder="由门型带出" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="数量(樘)" required><el-input-number v-model="form.qty" :min="1" style="width:100%" /></el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="销售单价" required><el-input-number v-model="form.unit_price" :min="0" :precision="2" style="width:100%" /></el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="经手人(销售)" required><el-input v-model="form.handler_sale" /></el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="下单日期" required><el-date-picker v-model="form.order_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="约定发货日"><el-date-picker v-model="form.expected_ship_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
              </el-col>
            </el-row>
          </el-form>
        </el-tab-pane>

        <el-tab-pane v-if="isEdit" label="发货回填" name="ship">
          <el-form :model="form" label-width="110px">
            <el-form-item label="实际发货日"><el-date-picker v-model="form.actual_ship_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
            <el-form-item label="发货单号"><el-input v-model="form.ship_no" placeholder="物流运单号" /></el-form-item>
            <el-form-item label="发货经手人"><el-input v-model="form.handler_ship" /></el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane v-if="isEdit" label="收款回填" name="pay">
          <el-form :model="form" label-width="110px">
            <el-form-item label="收款日期"><el-date-picker v-model="form.pay_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
            <el-form-item label="收据单号"><el-input v-model="form.receipt_no" /></el-form-item>
            <el-form-item label="收款经手人"><el-input v-model="form.handler_finance" /></el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>

      <template #footer>
        <el-button @click="dlgVisible = false">取消</el-button>
        <el-button type="primary" @click="onSubmit">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { orderApi, bomApi } from '../api'
import { dateFmt, todayLocal } from '../utils/date'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../store/user'

const store = useUserStore()
const route = useRoute()
const query = ref({ order_no: '', customer: '', door_bom_id: '', handler_sale: '', status: '', dateRange: [], page: 1, pageSize: 20 })
const list = ref([])
const total = ref(0)
const bomList = ref([])

const dlgVisible = ref(false)
const dlgTitle = ref('')
const isEdit = ref(false)
const activeTab = ref('info')
const form = ref({})

// 行内发货/收款
const shipVisible = ref(false)
const shipRow = ref(null)
const shipForm = ref({})
const payVisible = ref(false)
const payRow = ref(null)
const payForm = ref({})

const colorOptions = computed(() => {
  const bom = bomList.value.find((b) => b.id === form.value.door_bom_id)
  return bom?.colors ? bom.colors.split(',') : []
})
const bomSpec = computed(() => {
  const bom = bomList.value.find((b) => b.id === form.value.door_bom_id)
  return bom?.standard_size || ''
})

function statusType(s) {
  return { 新建: 'info', 已发货: 'warning', 已收款: 'success' }[s] || 'info'
}

function today() {
  return todayLocal()
}

async function load() {
  const params = { ...query.value }
  if (params.dateRange && params.dateRange.length === 2) {
    params.startDate = params.dateRange[0]
    params.endDate = params.dateRange[1]
  }
  delete params.dateRange
  const res = await orderApi.list(params)
  list.value = res.data.list
  total.value = res.data.total
}

function resetQuery() {
  query.value = { order_no: '', customer: '', door_bom_id: '', handler_sale: '', status: '', dateRange: [], page: 1, pageSize: 20 }
  if (route.query.status) query.value.status = String(route.query.status)
  load()
}

function openAdd() {
  isEdit.value = false
  dlgTitle.value = '接单'
  activeTab.value = 'info'
  form.value = {
    customer: '', door_bom_id: '', color: '', qty: 1, unit_price: 0,
    handler_sale: store.name, order_date: today(),
    expected_ship_date: '',
  }
  dlgVisible.value = true
}

async function openEdit(row) {
  isEdit.value = true
  dlgTitle.value = '处理订单 ' + row.order_no
  activeTab.value = 'info'
  const res = await orderApi.detail(row.id)
  form.value = { ...res.data }
  dlgVisible.value = true
}

function onBomChange() {
  form.value.color = ''
}

async function onSubmit() {
  const f = form.value
  if (!f.customer || !f.door_bom_id || !f.color || !f.qty || !f.unit_price || !f.handler_sale || !f.order_date) {
    return ElMessage.warning('请补全订单必填项')
  }
  if (isEdit.value) {
    await orderApi.update(f.id, f)
    ElMessage.success('更新成功')
  } else {
    const res = await orderApi.create(f)
    const sug = res.data.suggestion
    if (sug && sug.generated > 0) {
      ElMessage.success(`接单成功，已生成 ${sug.generated} 条采购建议`)
    } else {
      ElMessage.success('接单成功，库存充足无需采购')
    }
  }
  dlgVisible.value = false
  load()
}

// 行内发货：只填关键字段，其余从订单详情带出，经手人默认当前登录人
function openShip(row) {
  shipRow.value = row
  shipForm.value = {
    actual_ship_date: today(),
    ship_no: '',
    handler_ship: store.name,
  }
  shipVisible.value = true
}

async function onShip() {
  const f = shipForm.value
  if (!f.actual_ship_date || !f.ship_no) return ElMessage.warning('请填发货日与发货单号')
  const r = shipRow.value
  // 复用 PUT，带上订单原有字段 + 发货字段，触发状态流转
  await orderApi.update(r.id, {
    customer: r.customer, door_bom_id: r.door_bom_id, color: r.color,
    qty: r.qty, unit_price: r.unit_price, expected_ship_date: r.expected_ship_date,
    actual_ship_date: f.actual_ship_date, ship_no: f.ship_no, handler_ship: f.handler_ship,
    pay_date: null, receipt_no: null, handler_finance: null,
  })
  ElMessage.success('已发货，状态已更新')
  shipVisible.value = false
  load()
}

// 行内收款
function openPay(row) {
  payRow.value = row
  payForm.value = {
    pay_date: today(),
    receipt_no: '',
    handler_finance: store.name,
  }
  payVisible.value = true
}

async function onPay() {
  const f = payForm.value
  if (!f.pay_date || !f.receipt_no) return ElMessage.warning('请填收款日与收据单号')
  const r = payRow.value
  await orderApi.update(r.id, {
    customer: r.customer, door_bom_id: r.door_bom_id, color: r.color,
    qty: r.qty, unit_price: r.unit_price, expected_ship_date: r.expected_ship_date,
    actual_ship_date: r.actual_ship_date, ship_no: r.ship_no, handler_ship: r.handler_ship,
    pay_date: f.pay_date, receipt_no: f.receipt_no, handler_finance: f.handler_finance,
  })
  ElMessage.success('已收款，状态已更新')
  payVisible.value = false
  load()
}

onMounted(async () => {
  bomList.value = (await bomApi.all()).data
  // 工作台待办跳转带 status query，自动筛选
  if (route.query.status) {
    query.value.status = String(route.query.status)
  }
  load()
})
</script>

<style scoped>
/* 移动端：行内操作按钮放大到手指好点 */
@media (max-width: 768px) {
  .row-btn { min-height: 44px; padding: 0 12px; }
}
</style>
