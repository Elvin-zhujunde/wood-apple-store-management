<template>
  <el-card shadow="never">
    <div class="toolbar">
      <el-input v-model="query.customer" placeholder="客户名称" clearable style="width:180px" @change="load" />
      <el-select v-model="query.status" placeholder="状态" clearable style="width:120px" @change="load">
        <el-option label="新建" value="新建" />
        <el-option label="已发货" value="已发货" />
        <el-option label="已收款" value="已收款" />
      </el-select>
      <el-button type="primary" @click="load">查询</el-button>
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
      <el-table-column prop="order_date" label="下单日" width="110" />
      <el-table-column prop="actual_ship_date" label="发货日" width="110" />
      <el-table-column prop="pay_date" label="收款日" width="110" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">处理</el-button>
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

    <!-- 新增/编辑对话框 -->
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
import { orderApi, bomApi } from '../api'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../store/user'

const store = useUserStore()
const query = ref({ customer: '', status: '', page: 1, pageSize: 20 })
const list = ref([])
const total = ref(0)
const bomList = ref([])

const dlgVisible = ref(false)
const dlgTitle = ref('')
const isEdit = ref(false)
const activeTab = ref('info')
const form = ref({})

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

async function load() {
  const res = await orderApi.list(query.value)
  list.value = res.data.list
  total.value = res.data.total
}

function openAdd() {
  isEdit.value = false
  dlgTitle.value = '接单'
  activeTab.value = 'info'
  form.value = {
    customer: '', door_bom_id: '', color: '', qty: 1, unit_price: 0,
    handler_sale: store.name, order_date: new Date().toISOString().slice(0, 10),
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

onMounted(async () => {
  bomList.value = (await bomApi.all()).data
  load()
})
</script>
