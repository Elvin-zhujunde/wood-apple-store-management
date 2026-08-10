<template>
  <el-card shadow="never">
    <div class="toolbar">
      <el-select v-model="query.status" placeholder="状态" clearable style="width:130px" @change="load">
        <el-option label="待采购" value="待采购" />
        <el-option label="已采购" value="已采购" />
      </el-select>
      <el-select v-model="query.priority" placeholder="优先级" clearable style="width:130px" @change="load">
        <el-option label="紧急" value="紧急" />
        <el-option label="常规" value="常规" />
      </el-select>
      <el-button type="primary" @click="load">查询</el-button>
    </div>
    <el-alert type="warning" :closable="false" style="margin-bottom:12px">
      系统在<strong>销售订单保存时自动按 BOM 拆解</strong>物料需求并对比库存生成采购建议，下方为当前待办。
    </el-alert>
    <el-table :data="list" stripe border>
      <el-table-column prop="order_no" label="关联订单" width="160" />
      <el-table-column prop="customer" label="客户" min-width="120" />
      <el-table-column prop="code" label="物料编码" width="100" />
      <el-table-column prop="name" label="物料名称" width="110" />
      <el-table-column prop="spec" label="规格" min-width="140" />
      <el-table-column prop="suggest_qty" label="建议采购量" width="110" align="right">
        <template #default="{ row }"><strong style="color:#f56c6c">{{ row.suggest_qty }}</strong></template>
      </el-table-column>
      <el-table-column label="优先级" width="90">
        <template #default="{ row }">
          <el-tag :type="row.priority === '紧急' ? 'danger' : 'info'" size="small">{{ row.priority }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === '已采购' ? 'success' : 'warning'" size="small">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="生成时间" width="170" />
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status === '待采购'" link type="primary" @click="markDone(row)">标记已采购</el-button>
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
  </el-card>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { suggestionApi } from '../api'
import { ElMessage } from 'element-plus'

const query = ref({ status: '待采购', priority: '', page: 1, pageSize: 20 })
const list = ref([])
const total = ref(0)

async function load() {
  const res = await suggestionApi.list(query.value)
  list.value = res.data.list
  total.value = res.data.total
}

async function markDone(row) {
  await suggestionApi.updateStatus(row.id, '已采购')
  ElMessage.success('已标记为已采购')
  load()
}

onMounted(load)
</script>
