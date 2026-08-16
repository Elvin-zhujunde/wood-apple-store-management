<template>
  <el-card shadow="never">
    <div class="toolbar">
      <el-select v-model="query.category" placeholder="分类" clearable style="width:120px" @change="load">
        <el-option label="主材" value="主材" /><el-option label="耗材" value="耗材" />
      </el-select>
      <el-input v-model="query.keyword" placeholder="名称/编码" clearable style="width:180px" @change="load" />
      <el-input v-model="query.manufacturer" placeholder="厂家" clearable style="width:140px" @change="load" />
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
      <el-table-column prop="unit_price" label="参考单价" width="100" align="right" />
      <el-table-column prop="origin_place" label="生产地" min-width="100" />
      <el-table-column prop="manufacturer" label="厂家" min-width="100" />
      <el-table-column label="操作" width="130" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="onDel(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-model:current-page="query.page" :page-size="query.pageSize" :total="total" layout="total, prev, pager, next" style="margin-top:12px" @current-change="load" />

    <el-dialog v-model="dlgVisible" :title="isEdit ? '编辑物料' : '新增物料'" width="560px" :close-on-click-modal="false">
      <el-alert type="info" :closable="false" style="margin-bottom:12px">
        <strong>物料录入规格</strong>：一物一档，同物不拆分；规格取标准值（板材写 长*宽*厚，如 2440*1220*4.0）；单位从标准列表选。费用/资产/加工费不录入物料档案。
      </el-alert>
      <el-form :model="form" label-width="100px">
        <el-form-item label="物料编码" required><el-input v-model="form.code" :disabled="isEdit" placeholder="如 CL-008" /></el-form-item>
        <el-form-item label="物料名称" required><el-input v-model="form.name" placeholder="如 碳素面板" /></el-form-item>
        <el-form-item label="分类" required>
          <el-radio-group v-model="form.category"><el-radio value="主材">主材</el-radio><el-radio value="耗材">耗材</el-radio></el-radio-group>
        </el-form-item>
        <el-form-item label="规格型号" required>
          <el-input v-model="form.spec" placeholder="板材:2440*1220*4.0 / 线条:5.8*1.2*2200 / 锁具:T035" />
          <div class="muted">板材写 长*宽*厚(mm)，线条写 宽*厚*长(mm)，五金写型号</div>
        </el-form-item>
        <el-form-item label="计量单位" required>
          <el-select v-model="form.unit" filterable allow-create placeholder="选择标准单位" style="width:100%">
            <el-option v-for="u in UNIT_OPTIONS" :key="u" :label="u" :value="u" />
          </el-select>
          <div class="muted">板材:张 线条:支/米 五金:把/套 胶:桶</div>
        </el-form-item>
        <el-form-item label="生产地"><el-input v-model="form.origin_place" placeholder="如 江西赣州" /></el-form-item>
        <el-form-item label="厂家名"><el-input v-model="form.manufacturer" placeholder="如 XX板材厂" /></el-form-item>
        <el-form-item label="安全库存"><el-input-number v-model="form.safety_stock" :min="0" :precision="3" style="width:100%" /></el-form-item>
        <el-form-item label="参考单价">
          <el-input-number v-model="form.unit_price" :min="0" :precision="2" controls-position="right" style="width:100%" placeholder="非必填,默认0" />
          <div class="muted">领料材料成本计算依据；价格变动可新建"XX-8月涨价版"档案区分</div>
        </el-form-item>
        <el-form-item v-if="isEdit" label="物料图片">
          <ImageUpload v-model="imgList" entity-type="material" :entity-id="form.id" />
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
import { materialApi, attachmentApi } from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'
import ImageUpload from '../components/ImageUpload.vue'

const query = ref({ category: '', keyword: '', manufacturer: '', page: 1, pageSize: 20 })
const list = ref([])
const total = ref(0)
const dlgVisible = ref(false)
const isEdit = ref(false)
const form = ref({})
const imgList = ref([])

// 标准计量单位（业务规格约束：一物一档，单位统一从标准列表选）
const UNIT_OPTIONS = ['张', '支', '米', '把', '套', '个', '桶', '卷', '条', '件', '袋', '公斤']

async function load() {
  const res = await materialApi.list(query.value)
  list.value = res.data.list
  total.value = res.data.total
}

function openAdd() {
  isEdit.value = false
  form.value = { code: '', name: '', category: '主材', spec: '', unit: '', safety_stock: 0, origin_place: '', manufacturer: '', unit_price: 0 }
  dlgVisible.value = true
}

async function openEdit(row) {
  isEdit.value = true
  form.value = { ...row }
  imgList.value = []
  try {
    const r = await attachmentApi.list('material', row.id)
    imgList.value = r.data
  } catch (e) {}
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
