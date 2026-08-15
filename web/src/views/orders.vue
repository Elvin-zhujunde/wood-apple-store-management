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
      <el-button type="warning" :disabled="batchShipableCount === 0" @click="openBatchShip">批量发货 ({{ batchShipableCount }})</el-button>
      <el-button type="warning" :disabled="batchPayableCount === 0" @click="openBatchPay">批量收款 ({{ batchPayableCount }})</el-button>
    </div>
    <el-table :data="list" stripe border @selection-change="onSelectionChange">
      <el-table-column type="selection" width="42" />
      <el-table-column prop="order_no" label="订单号" width="160" />
      <el-table-column prop="customer" label="客户" min-width="120" />
      <el-table-column label="尺寸(高×宽)" width="130">
        <template #default="{ row }">
          <span v-if="row.door_h || row.door_w">{{ row.door_h || '-' }}×{{ row.door_w || '-' }}</span>
          <span v-else class="muted">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="door_bom_name" label="门型" width="120" />
      <el-table-column prop="color" label="颜色" width="80" />
      <el-table-column label="应收" width="90" align="right" prop="total_amount" />
      <el-table-column label="已收" width="90" align="right">
        <template #default="{ row }">{{ row.paid_amount != null ? row.paid_amount : '-' }}</template>
      </el-table-column>
      <el-table-column label="欠款" width="90" align="right">
        <template #default="{ row }">
          <span v-if="balanceOf(row) > 0" style="color:#f56c6c;font-weight:600">{{ balanceOf(row) }}</span>
          <span v-else-if="row.paid_amount != null" style="color:#67c23a">0</span>
          <span v-else class="muted">-</span>
        </template>
      </el-table-column>
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
        <el-form-item label="应收金额">
          <el-input :model-value="payRow?.total_amount" disabled />
        </el-form-item>
        <el-form-item label="已付金额" required>
          <el-input-number v-model="payForm.paid_amount" :min="0" :precision="2" controls-position="right" style="width:100%" />
          <div class="muted">默认应收额=全额结清；填少于应收=赊账，欠款={{ payBalance }}</div>
        </el-form-item>
        <el-form-item label="付款方式">
          <el-select v-model="payForm.pay_method" clearable style="width:100%">
            <el-option label="扫码" value="扫码" /><el-option label="现金" value="现金" /><el-option label="转账" value="转账" /><el-option label="赊账" value="赊账" />
          </el-select>
        </el-form-item>
        <el-form-item label="收款日期" required>
          <el-date-picker v-model="payForm.pay_date" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
        <el-form-item label="收据单号">
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

    <!-- 批量发货弹窗 -->
    <el-dialog v-model="batchShipVisible" title="批量发货" width="440px" :close-on-click-modal="false">
      <el-alert type="info" :closable="false" style="margin-bottom:12px">
        共选中 <strong>{{ selectedRows.length }}</strong> 单，其中 <strong>{{ batchShipableCount }}</strong> 单为"新建"可发货
        <div v-if="batchShipableCount < selectedRows.length" style="color:#e6a23c;margin-top:4px">非"新建"订单将自动跳过</div>
      </el-alert>
      <el-form :model="batchShipForm" label-width="100px">
        <el-form-item label="实际发货日" required>
          <el-date-picker v-model="batchShipForm.actual_ship_date" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
        <el-form-item label="发货单号" required>
          <el-input v-model="batchShipForm.ship_no" placeholder="同一批次共用一个发货单号" />
        </el-form-item>
        <el-form-item label="发货经手人">
          <el-input v-model="batchShipForm.handler_ship" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchShipVisible = false">取消</el-button>
        <el-button type="primary" :disabled="batchShipableCount === 0" @click="onBatchShip">确认批量发货</el-button>
      </template>
    </el-dialog>

    <!-- 批量收款弹窗 -->
    <el-dialog v-model="batchPayVisible" title="批量收款" width="440px" :close-on-click-modal="false">
      <el-alert type="info" :closable="false" style="margin-bottom:12px">
        共选中 <strong>{{ selectedRows.length }}</strong> 单，其中 <strong>{{ batchPayableCount }}</strong> 单可收款
        <div v-if="batchPayableCount < selectedRows.length" style="color:#e6a23c;margin-top:4px">已收款订单将自动跳过</div>
      </el-alert>
      <el-form :model="batchPayForm" label-width="100px">
        <el-form-item label="收款日期" required>
          <el-date-picker v-model="batchPayForm.pay_date" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
        <el-form-item label="收据单号" required>
          <el-input v-model="batchPayForm.receipt_no" placeholder="同一批次共用一个收据单号" />
        </el-form-item>
        <el-form-item label="付款方式">
          <el-select v-model="batchPayForm.pay_method" clearable style="width:100%">
            <el-option label="扫码" value="扫码" /><el-option label="现金" value="现金" /><el-option label="转账" value="转账" /><el-option label="赊账" value="赊账" />
          </el-select>
          <div class="muted">批量默认全额结清；部分付款/赊账请逐单操作</div>
        </el-form-item>
        <el-form-item label="收款经手人">
          <el-input v-model="batchPayForm.handler_finance" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchPayVisible = false">取消</el-button>
        <el-button type="primary" :disabled="batchPayableCount === 0" @click="onBatchPay">确认批量收款</el-button>
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
              <el-col :span="8">
                <el-form-item label="门洞高"><el-input-number v-model="form.door_h" :min="0" :precision="2" controls-position="right" style="width:100%" placeholder="mm" /></el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="门洞宽"><el-input-number v-model="form.door_w" :min="0" :precision="2" controls-position="right" style="width:100%" placeholder="mm" /></el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="墙厚"><el-input-number v-model="form.wall_thick" :min="0" :precision="2" controls-position="right" style="width:100%" placeholder="mm" /></el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="款式"><el-input v-model="form.style" placeholder="如 1016 / XF-2471" /></el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="门扇板材"><el-input v-model="form.board" placeholder="如 3号 / 5号" /></el-form-item>
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
              <el-col :span="24">
                <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" placeholder="加急/颜色定制/包安装/客户交代等" /></el-form-item>
              </el-col>
              <!-- 可选信息（默认收起，降低录入负担） -->
              <el-col :span="24">
                <el-collapse>
                  <el-collapse-item title="可选信息（客户类别/地址/包边/套板线条/五金/业务员）" name="opt">
                    <el-row :gutter="12">
                      <el-col :span="12"><el-form-item label="客户类别"><el-select v-model="form.customer_type" clearable style="width:100%"><el-option label="经销商" value="经销商" /><el-option label="直销" value="直销" /></el-select></el-form-item></el-col>
                      <el-col :span="12"><el-form-item label="地址"><el-input v-model="form.address" /></el-form-item></el-col>
                      <el-col :span="12"><el-form-item label="包边(mm)"><el-input-number v-model="form.edge_band" :min="0" :precision="2" controls-position="right" style="width:100%" /></el-form-item></el-col>
                      <el-col :span="12"><el-form-item label="套板线条"><el-input v-model="form.frame_line" /></el-form-item></el-col>
                      <el-col :span="12"><el-form-item label="五金"><el-input v-model="form.hardware" /></el-form-item></el-col>
                      <el-col :span="12"><el-form-item label="业务员"><el-input v-model="form.salesperson" /></el-form-item></el-col>
                    </el-row>
                  </el-collapse-item>
                </el-collapse>
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
            <el-form-item label="应收款">
              <el-input :model-value="form.total_amount" disabled />
              <div class="muted">订单总金额（自动）</div>
            </el-form-item>
            <el-form-item label="已付金额">
              <el-input-number v-model="form.paid_amount" :min="0" :precision="2" controls-position="right" style="width:100%" placeholder="默认填应收额=全额结清，填少于应收=赊账欠款" />
            </el-form-item>
            <el-form-item label="欠款">
              <el-input :model-value="balanceDue" disabled :class="{ 'balance-over': balanceDue > 0 }" />
              <div class="muted">= 应收 − 已付，欠款&gt;0 为未结清</div>
            </el-form-item>
            <el-form-item label="付款方式">
              <el-select v-model="form.pay_method" clearable style="width:100%">
                <el-option label="扫码" value="扫码" /><el-option label="现金" value="现金" /><el-option label="转账" value="转账" /><el-option label="赊账" value="赊账" />
              </el-select>
            </el-form-item>
            <el-form-item label="收款日期"><el-date-picker v-model="form.pay_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
            <el-form-item label="收据单号"><el-input v-model="form.receipt_no" /></el-form-item>
            <el-form-item label="收款经手人"><el-input v-model="form.handler_finance" /></el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane v-if="isEdit" label="图片附件" name="images">
          <el-alert type="info" :closable="false" style="margin-bottom:12px">可上传客户确认图、合同、发货实拍等。图片非必填。</el-alert>
          <ImageUpload v-model="imgList" entity-type="order" :entity-id="form.id" />
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
import { orderApi, bomApi, attachmentApi } from '../api'
import { dateFmt, todayLocal } from '../utils/date'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../store/user'
import ImageUpload from '../components/ImageUpload.vue'

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
const imgList = ref([])

// 行内发货/收款
const shipVisible = ref(false)
const shipRow = ref(null)
const shipForm = ref({})
const payVisible = ref(false)
const payRow = ref(null)
const payForm = ref({})

// 批量操作
const selectedRows = ref([])
const batchShipVisible = ref(false)
const batchShipForm = ref({})
const batchPayVisible = ref(false)
const batchPayForm = ref({})

const colorOptions = computed(() => {
  const bom = bomList.value.find((b) => b.id === form.value.door_bom_id)
  return bom?.colors ? bom.colors.split(',') : []
})
const bomSpec = computed(() => {
  const bom = bomList.value.find((b) => b.id === form.value.door_bom_id)
  return bom?.standard_size || ''
})

// 欠款计算（决策2：已付 paid_amount，欠款=应收-已付）
// 表单内实时欠款（收款tab用）
const balanceDue = computed(() => {
  const total = Number(form.value.total_amount) || 0
  const paid = Number(form.value.paid_amount) || 0
  return Math.round((total - paid) * 100) / 100
})
// 列表行欠款（R7）
function balanceOf(row) {
  if (row.paid_amount == null) return 0
  const total = Number(row.total_amount) || 0
  const paid = Number(row.paid_amount) || 0
  return Math.round((total - paid) * 100) / 100
}

function statusType(s) {
  return { 新建: 'info', 已发货: 'warning', 已收款: 'success' }[s] || 'info'
}

// 批量：选中行中可发货/可收款的数量（后端也会做幂等校验，此处用于按钮可用性与提示）
const batchShipableCount = computed(() => selectedRows.value.filter((r) => r.status === '新建').length)
const batchPayableCount = computed(() => selectedRows.value.filter((r) => r.status === '新建' || r.status === '已发货').length)

function onSelectionChange(rows) {
  selectedRows.value = rows
}

function openBatchShip() {
  batchShipForm.value = { actual_ship_date: today(), ship_no: '', handler_ship: store.name }
  batchShipVisible.value = true
}

async function onBatchShip() {
  const f = batchShipForm.value
  if (!f.actual_ship_date || !f.ship_no || !f.handler_ship) return ElMessage.warning('请补全发货日/发货单号/经手人')
  const ids = selectedRows.value.map((r) => r.id)
  const res = await orderApi.batchShip(ids, { ...f })
  ElMessage.success(res.msg || '批量发货完成')
  batchShipVisible.value = false
  load()
}

function openBatchPay() {
  batchPayForm.value = { pay_date: today(), receipt_no: '', pay_method: '', handler_finance: store.name }
  batchPayVisible.value = true
}

async function onBatchPay() {
  const f = batchPayForm.value
  if (!f.pay_date || !f.receipt_no || !f.handler_finance) return ElMessage.warning('请补全收款日/收据单号/经手人')
  const ids = selectedRows.value.map((r) => r.id)
  const res = await orderApi.batchPay(ids, { ...f })
  ElMessage.success(res.msg || '批量收款完成')
  batchPayVisible.value = false
  load()
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
    door_h: null, door_w: null, wall_thick: null, style: '', board: '',
    remark: '', edge_band: null, frame_line: '', customer_type: '', address: '',
  }
  dlgVisible.value = true
}

async function openEdit(row) {
  isEdit.value = true
  dlgTitle.value = '处理订单 ' + row.order_no
  activeTab.value = 'info'
  const res = await orderApi.detail(row.id)
  form.value = { ...res.data }
  // 加载已有图片
  imgList.value = []
  try {
    const r = await attachmentApi.list('order', row.id)
    imgList.value = r.data
  } catch (e) {}
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
    qty: r.qty, unit_price: r.unit_price,
    actual_ship_date: f.actual_ship_date, ship_no: f.ship_no, handler_ship: f.handler_ship,
    pay_date: null, receipt_no: null, handler_finance: null,
  })
  ElMessage.success('已发货，状态已更新')
  shipVisible.value = false
  load()
}

// 行内收款（决策2：支持部分付款，已付默认=应收额，可改少于应收=赊账）
function openPay(row) {
  payRow.value = row
  payForm.value = {
    paid_amount: Number(row.total_amount) || 0,  // 默认全额
    pay_method: '',
    pay_date: today(),
    receipt_no: '',
    handler_finance: store.name,
  }
  payVisible.value = true
}

// 行内收款弹窗实时欠款
const payBalance = computed(() => {
  const total = Number(payRow.value?.total_amount) || 0
  const paid = Number(payForm.value.paid_amount) || 0
  return Math.round((total - paid) * 100) / 100
})

async function onPay() {
  const f = payForm.value
  if (!f.pay_date) return ElMessage.warning('请填收款日期')
  if (f.paid_amount == null || Number(f.paid_amount) <= 0) return ElMessage.warning('请填已付金额')
  const r = payRow.value
  await orderApi.update(r.id, {
    customer: r.customer, door_bom_id: r.door_bom_id, color: r.color,
    qty: r.qty, unit_price: r.unit_price,
    actual_ship_date: r.actual_ship_date, ship_no: r.ship_no, handler_ship: r.handler_ship,
    pay_date: f.pay_date, receipt_no: f.receipt_no, handler_finance: f.handler_finance,
    paid_amount: f.paid_amount, pay_method: f.pay_method,
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
.muted { color: #909399; font-size: 12px; }
/* 欠款>0 输入框标红提示 */
:deep(.balance-over .el-input__inner) { color: #f56c6c; font-weight: 600; }
/* 移动端：行内操作按钮放大到手指好点 */
@media (max-width: 768px) {
  .row-btn { min-height: 44px; padding: 0 12px; }
}
</style>
