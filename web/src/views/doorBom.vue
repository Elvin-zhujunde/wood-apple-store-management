<template>
  <el-card shadow="never">
    <div class="toolbar">
      <el-input v-model="keyword" placeholder="门型名称/编号" clearable style="width:200px" @change="load" />
      <el-button type="primary" @click="load">查询</el-button>
      <el-button type="success" @click="openAdd">+ 新增门型</el-button>
    </div>
    <el-table :data="list" stripe border>
      <el-table-column prop="code" label="门型编号" width="110" />
      <el-table-column prop="name" label="门型名称" width="160" />
      <el-table-column prop="standard_size" label="标准尺寸" width="160" />
      <el-table-column prop="colors" label="可选颜色" min-width="160" />
      <el-table-column prop="nonstd_markup" label="非标加价%" width="100" />
      <el-table-column label="操作" width="130" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="onDel(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dlgVisible" :title="isEdit ? '编辑门型BOM' : '新增门型BOM'" width="820px" :close-on-click-modal="false">
      <el-form :model="form" label-width="100px">
        <el-row :gutter="12">
          <el-col :span="8"><el-form-item label="门型编号" required><el-input v-model="form.code" :disabled="isEdit" placeholder="M-101" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="门型名称" required><el-input v-model="form.name" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="标准尺寸" required><el-input v-model="form.standard_size" placeholder="2100x900x45mm" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="可选颜色" required><el-input v-model="form.colors" placeholder="逗号分隔：肤感白,黑胡桃" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="非标加价%"><el-input-number v-model="form.nonstd_markup" :min="0" :precision="2" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <!-- 门型关联的物料损耗明细已隐藏：物料消耗统计全走领料，门型不再关联物料明细。
             door_bom_items 表与后端 items 透传逻辑保留，恢复时取消下方注释即可。 -->
        <!--
        <el-divider content-position="left">BOM 物料明细</el-divider>
        <div style="margin-bottom:8px"><el-button type="primary" size="small" @click="addItem">+ 添加物料</el-button></div>
        <el-table :data="form.items" border size="small">
          <el-table-column label="物料" min-width="200">
            <template #default="{ row }">
              <el-select v-model="row.material_id" filterable placeholder="选择物料" style="width:100%">
                <el-option v-for="m in mats" :key="m.id" :label="`${m.code} ${m.name} (${m.spec})`" :value="m.id" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="单位用量" width="130">
            <template #default="{ row }"><el-input-number v-model="row.unit_usage" :min="0" :precision="3" :controls="false" style="width:100%" /></template>
          </el-table-column>
          <el-table-column label="损耗系数%" width="130">
            <template #default="{ row }"><el-input-number v-model="row.loss_rate" :min="0" :precision="2" :controls="false" style="width:100%" /></template>
          </el-table-column>
          <el-table-column label="操作" width="80">
            <template #default="{ $index }"><el-button link type="danger" @click="form.items.splice($index,1)">删除</el-button></template>
          </el-table-column>
        </el-table>
        -->
        <el-form-item v-if="isEdit" label="门型样图" style="margin-top:12px">
          <ImageUpload v-model="imgList" entity-type="bom" :entity-id="form.id" />
        </el-form-item>
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
import { bomApi, attachmentApi } from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'
import ImageUpload from '../components/ImageUpload.vue'

const keyword = ref('')
const list = ref([])
const dlgVisible = ref(false)
const isEdit = ref(false)
const form = ref({})
const imgList = ref([])

async function load() {
  const res = await bomApi.list({ keyword: keyword.value })
  list.value = res.data
}

function openAdd() {
  isEdit.value = false
  form.value = { code: '', name: '', standard_size: '', colors: '', nonstd_markup: 0, items: [] }
  dlgVisible.value = true
}

async function openEdit(row) {
  isEdit.value = true
  const res = await bomApi.detail(row.id)
  form.value = {
    id: res.data.id, code: res.data.code, name: res.data.name,
    standard_size: res.data.standard_size, colors: res.data.colors,
    nonstd_markup: Number(res.data.nonstd_markup),
    items: res.data.items.map((it) => ({ id: it.id, material_id: it.material_id, unit_usage: Number(it.unit_usage), loss_rate: Number(it.loss_rate) })),
  }
  imgList.value = []
  try {
    const r = await attachmentApi.list('bom', row.id)
    imgList.value = r.data
  } catch (e) {}
  dlgVisible.value = true
}

function addItem() {
  form.value.items.push({ material_id: '', unit_usage: 1, loss_rate: 0 })
}

async function onSave() {
  const f = form.value
  if (!f.code || !f.name || !f.standard_size || !f.colors) return ElMessage.warning('请补全门型基础信息')
  // 物料明细校验已随明细区隐藏移除（门型不关联物料损耗，items 传空数组）
  if (isEdit.value) await bomApi.update(f.id, f)
  else await bomApi.create(f)
  ElMessage.success('保存成功')
  dlgVisible.value = false
  load()
}

async function onDel(row) {
  await ElMessageBox.confirm(`确认删除门型 ${row.name}？`, '提示', { type: 'warning' })
  await bomApi.remove(row.id)
  ElMessage.success('删除成功')
  load()
}

onMounted(() => {
  load()
})
</script>
