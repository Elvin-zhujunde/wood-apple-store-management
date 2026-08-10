<template>
  <el-card shadow="never">
    <div class="toolbar">
      <el-select v-model="query.category" placeholder="分类" clearable style="width:120px" @change="load">
        <el-option label="主材" value="主材" /><el-option label="耗材" value="耗材" />
      </el-select>
      <el-input v-model="query.keyword" placeholder="名称/编码" clearable style="width:180px" @change="load" />
      <el-button type="primary" @click="load">查询</el-button>
      <el-button type="success" @click="openAdd">+ 新增物料</el-button>
    </div>
    <el-table :data="list" stripe border>
      <el-table-column prop="code" label="编码" width="100" />
      <el-table-column prop="name" label="名称" width="120" />
      <el-table-column prop="category" label="分类" width="80" />
      <el-table-column prop="spec" label="规格型号" min-width="160" />
      <el-table-column prop="unit" label="单位" width="70" />
      <el-table-column prop="stock_qty" label="当前库存" width="100" align="right" />
      <el-table-column prop="safety_stock" label="安全库存" width="100" align="right" />
      <el-table-column label="操作" width="130" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="onDel(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-model:current-page="query.page" :page-size="query.pageSize" :total="total" layout="total, prev, pager, next" style="margin-top:12px" @current-change="load" />

    <el-dialog v-model="dlgVisible" :title="isEdit ? '编辑物料' : '新增物料'" width="560px" :close-on-click-modal="false">
      <el-form :model="form" label-width="100px">
        <el-form-item label="物料编码" required><el-input v-model="form.code" :disabled="isEdit" placeholder="如 CL-008" /></el-form-item>
        <el-form-item label="物料名称" required><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="分类" required>
          <el-radio-group v-model="form.category"><el-radio value="主材">主材</el-radio><el-radio value="耗材">耗材</el-radio></el-radio-group>
        </el-form-item>
        <el-form-item label="规格型号" required><el-input v-model="form.spec" placeholder="如 9mm 1220x2440mm" /></el-form-item>
        <el-form-item label="计量单位" required><el-input v-model="form.unit" placeholder="如 张/米/公斤" /></el-form-item>
        <el-form-item label="安全库存"><el-input-number v-model="form.safety_stock" :min="0" :precision="3" style="width:100%" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dlgVisible = false">取消</el-button>
        <el-button type="primary" @click="onSave">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { materialApi } from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'

const query = ref({ category: '', keyword: '', page: 1, pageSize: 20 })
const list = ref([])
const total = ref(0)
const dlgVisible = ref(false)
const isEdit = ref(false)
const form = ref({})

async function load() {
  const res = await materialApi.list(query.value)
  list.value = res.data.list
  total.value = res.data.total
}

function openAdd() {
  isEdit.value = false
  form.value = { code: '', name: '', category: '主材', spec: '', unit: '', safety_stock: 0 }
  dlgVisible.value = true
}

function openEdit(row) {
  isEdit.value = true
  form.value = { ...row }
  dlgVisible.value = true
}

async function onSave() {
  const f = form.value
  if (!f.code || !f.name || !f.category || !f.spec || !f.unit) return ElMessage.warning('请补全必填项')
  if (isEdit.value) await materialApi.update(f.id, f)
  else await materialApi.create(f)
  ElMessage.success('保存成功')
  dlgVisible.value = false
  load()
}

async function onDel(row) {
  await ElMessageBox.confirm(`确认删除物料 ${row.name}？`, '提示', { type: 'warning' })
  await materialApi.remove(row.id)
  ElMessage.success('删除成功')
  load()
}

onMounted(load)
</script>
