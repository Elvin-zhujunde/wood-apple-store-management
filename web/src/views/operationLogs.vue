<template>
  <div class="page">
    <div class="toolbar">
      <el-input v-model="query.user_name" placeholder="操作人" clearable style="width:140px" @change="load" @clear="load" />
      <el-select v-model="query.module" placeholder="模块" clearable style="width:150px" @change="load">
        <el-option v-for="m in modules" :key="m" :label="m" :value="m" />
      </el-select>
      <el-select v-model="query.method" placeholder="方法" clearable style="width:110px" @change="load">
        <el-option label="POST(创建/操作)" value="POST" />
        <el-option label="PUT(更新)" value="PUT" />
        <el-option label="DELETE(删除)" value="DELETE" />
      </el-select>
      <el-select v-model="query.status" placeholder="结果" clearable style="width:100px" @change="load">
        <el-option label="成功" value="成功" />
        <el-option label="失败" value="失败" />
      </el-select>
      <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" style="width:240px" @change="onDateChange" />
      <el-button type="primary" @click="load">查询</el-button>
      <el-button @click="resetQuery">重置</el-button>
    </div>
    <el-table :data="list" border v-loading="loading" size="small">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column label="时间" width="150">
        <template #default="{row}">{{ fmt(row.created_at) }}</template>
      </el-table-column>
      <el-table-column prop="user_name" label="操作人" width="100">
        <template #default="{row}">{{ row.user_name || '-' }}</template>
      </el-table-column>
      <el-table-column prop="module" label="模块" width="100" />
      <el-table-column prop="action" label="动作" width="90">
        <template #default="{row}"><el-tag size="small" :type="actionType(row.action)">{{ row.action }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="method" label="方法" width="80" />
      <el-table-column prop="path" label="路径" min-width="180" show-overflow-tooltip />
      <el-table-column label="目标ID" width="80">
        <template #default="{row}">{{ row.target_id || '-' }}</template>
      </el-table-column>
      <el-table-column label="结果" width="70">
        <template #default="{row}"><el-tag size="small" :type="row.status==='成功'?'success':'danger'">{{ row.status }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="ip" label="IP" width="120" />
      <el-table-column prop="detail" label="摘要" min-width="200" show-overflow-tooltip />
    </el-table>
    <div class="pager">
      <el-pagination background layout="total, prev, pager, next, jumper, sizes" :total="total" :current-page="query.page" :page-size="query.size" :page-sizes="[50, 100, 200]" @current-change="onPage" @size-change="onSize" />
    </div>
  </div>
</template>
<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { logApi } from '../api/index'

const list = ref([]), total = ref(0), loading = ref(false), modules = ref([])
const dateRange = ref([])
const query = ref({ user_name: '', module: '', method: '', status: '', start: '', end: '', page: 1, size: 50 })

const fmt = (s) => s ? s.replace('T', ' ').slice(0, 19) : '-'
const actionType = (a) => {
  if (a === '删除') return 'danger'
  if (a === '创建') return 'success'
  if (a === '批量操作' || a === '重置密码') return 'warning'
  return 'info'
}

const load = async () => {
  loading.value = true
  try {
    const { data } = await logApi.list(query.value)
    list.value = data.list
    total.value = data.total
  } catch (e) { ElMessage.error(e.message || '加载失败') }
  finally { loading.value = false }
}
const loadModules = async () => {
  try { const { data } = await logApi.modules(); modules.value = data } catch (e) { /* 空表时无模块 */ }
}
const onPage = (p) => { query.value.page = p; load() }
const onSize = (s) => { query.value.size = s; query.value.page = 1; load() }
const onDateChange = (v) => {
  query.value.start = v ? v[0] : ''
  query.value.end = v ? v[1] : ''
  load()
}
const resetQuery = () => {
  query.value = { user_name: '', module: '', method: '', status: '', start: '', end: '', page: 1, size: 50 }
  dateRange.value = []
  load()
}
load()
loadModules()
</script>
<style scoped>
.toolbar{margin-bottom:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.pager{margin-top:12px;display:flex;justify-content:flex-end}
</style>
