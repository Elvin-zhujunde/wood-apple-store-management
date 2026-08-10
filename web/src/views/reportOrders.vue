<template>
  <el-card shadow="never">
    <template #header><span>订单全流程跟踪表</span></template>
    <div class="toolbar">
      <el-input v-model="query.customer" placeholder="客户" clearable style="width:160px" @change="load" />
      <el-select v-model="query.status" placeholder="状态" clearable style="width:120px" @change="load">
        <el-option label="新建" value="新建" /><el-option label="已发货" value="已发货" /><el-option label="已收款" value="已收款" />
      </el-select>
      <el-button type="primary" @click="load">查询</el-button>
    </div>
    <el-table :data="list" stripe border size="small">
      <el-table-column prop="order_no" label="订单号" width="150" fixed />
      <el-table-column prop="customer" label="客户" min-width="110" />
      <el-table-column prop="door_bom_name" label="门型" width="110" />
      <el-table-column prop="color" label="颜色" width="70" />
      <el-table-column prop="qty" label="数量" width="60" align="right" />
      <el-table-column prop="total_amount" label="金额" width="90" align="right" />
      <el-table-column prop="handler_sale" label="销售经手" width="80" />
      <el-table-column prop="order_date" label="下单日" width="120" />
      <el-table-column prop="expected_ship_date" label="约定发货" width="120" />
      <el-table-column prop="actual_ship_date" label="实际发货" width="120" />
      <el-table-column prop="ship_no" label="发货单号" width="120" />
      <el-table-column prop="handler_ship" label="发货经手" width="80" />
      <el-table-column prop="pay_date" label="收款日" width="120" />
      <el-table-column prop="receipt_no" label="收据号" width="100" />
      <el-table-column prop="handler_finance" label="收款经手" width="80" />
      <el-table-column label="状态" width="80" fixed="right">
        <template #default="{ row }"><el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag></template>
      </el-table-column>
    </el-table>
    <el-pagination v-model:current-page="query.page" :page-size="query.pageSize" :total="total" layout="total, prev, pager, next" style="margin-top:12px" @current-change="load" />
  </el-card>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { orderApi } from '../api'

const query = ref({ customer: '', status: '', page: 1, pageSize: 50 })
const list = ref([])
const total = ref(0)

function statusType(s) { return { 新建: 'info', 已发货: 'warning', 已收款: 'success' }[s] || 'info' }

async function load() {
  const res = await orderApi.list(query.value)
  list.value = res.data.list
  total.value = res.data.total
}

onMounted(load)
</script>
