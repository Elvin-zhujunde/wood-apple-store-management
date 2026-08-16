<template>
  <el-card shadow="never">
    <div class="toolbar">
      <el-input v-model="query.order_no" placeholder="订单号" clearable style="width:140px" @change="load" />
      <el-input v-model="query.customer" placeholder="客户名称" clearable style="width:150px" @change="load" />
      <el-date-picker v-model="query.dateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" style="width:240px" @change="load" />
      <el-button type="primary" @click="load">查询</el-button>
      <el-button @click="resetQuery">重置</el-button>
      <el-button type="warning" :disabled="selectedRows.length === 0" @click="openBatchPrint">批量打印 ({{ selectedRows.length }})</el-button>
    </div>
    <el-alert type="info" :closable="false" style="margin-bottom:12px">
      门扇尺寸 = 门洞尺寸 − 扣尺默认值（当前 <strong>高-{{ cutConfig.defaultHeightCut }} 宽-{{ cutConfig.defaultWidthCut }}</strong>）。普通模式自动算、特殊模式手填，生成后师傅仍可微调。
    </el-alert>
    <el-table :data="list" stripe border @selection-change="onSelectionChange">
      <el-table-column type="selection" width="42" />
      <el-table-column prop="customer" label="客户" min-width="120" />
      <el-table-column prop="order_no" label="订单号" width="110" />
      <el-table-column label="门洞" width="80" align="center">
        <template #default="{ row }">
          <div class="size-cell">
            <span>{{ row.hole_height || '-' }}</span>
            <span class="muted">×{{ row.hole_width || '-' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="wall_thick" label="墙厚" width="70" align="center" />
      <el-table-column prop="style" label="款式" width="100" />
      <el-table-column prop="color" label="颜色" width="80" />
      <el-table-column prop="frame_line" label="套板线条" min-width="120" show-overflow-tooltip />
      <el-table-column label="备注" min-width="120">
        <template #default="{ row }">
          <span v-if="parseTags(row.remark_tags).length" class="tag-row">
            <el-tag v-for="(t, i) in parseTags(row.remark_tags)" :key="i" size="small" :type="tagType(t)" class="tag-item">{{ t }}</el-tag>
          </span>
          <span v-else class="muted">{{ row.remark || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="board" label="板材" width="70" />
      <el-table-column label="门扇高" width="90" align="center">
        <template #default="{ row }"><strong style="color:#f56c6c">{{ row.door_height }}</strong></template>
      </el-table-column>
      <el-table-column label="门扇宽" width="90" align="center">
        <template #default="{ row }"><strong style="color:#f56c6c">{{ row.door_width }}</strong></template>
      </el-table-column>
      <el-table-column label="模式" width="70" align="center">
        <template #default="{ row }">
          <el-tag :type="row.mode === 2 ? 'warning' : 'info'" size="small">{{ row.mode === 2 ? '特殊' : '普通' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === '已下料' ? 'success' : 'warning'" size="small">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="cut_date" label="下料日" width="110" :formatter="dateFmt" />
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="warning" @click="printSingle(row)">打印</el-button>
          <el-button link type="danger" @click="onDelete(row)">删除</el-button>
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

    <!-- 编辑弹窗：改门扇尺寸 + 加工备注标签 -->
    <el-dialog v-model="editVisible" title="编辑下料单" width="640px" :close-on-click-modal="false">
      <el-alert type="info" :closable="false" style="margin-bottom:16px">
        订单 <strong>{{ editRow?.order_no }}</strong> · {{ editRow?.customer }}
        <span v-if="editRow?.style"> · 款式 {{ editRow?.style }}</span>
        <span v-if="editRow?.board"> · 板材 {{ editRow?.board }}</span>
      </el-alert>
      <el-form :model="editForm" label-width="90px" label-position="right">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="门洞高"><el-input :model-value="editRow?.hole_height" disabled /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="门洞宽"><el-input :model-value="editRow?.hole_width" disabled /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="门扇高" required>
              <el-input-number v-model="editForm.door_height" :min="0" :precision="2" controls-position="right" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="门扇宽" required>
              <el-input-number v-model="editForm.door_width" :min="0" :precision="2" controls-position="right" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="墙厚"><el-input :model-value="editRow?.wall_thick" disabled /></el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="经手人"><el-input v-model="editForm.handler" /></el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="下料日期" required>
              <el-date-picker v-model="editForm.cut_date" type="date" value-format="YYYY-MM-DD" style="width:100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="加工备注">
          <TagInput v-model="editForm.tags" :suggestions="tagOptions" placeholder="输入标签，回车添加" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="onEdit">保存</el-button>
      </template>
    </el-dialog>

  </el-card>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { cuttingApi } from '../api'
import { dateFmt, todayLocal } from '../utils/date'
import { tagType } from '../utils/tagColor'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '../store/user'
import TagInput from '../components/TagInput.vue'

const router = useRouter()
const store = useUserStore()
const query = ref({ order_no: '', customer: '', dateRange: [], page: 1, pageSize: 20 })
const list = ref([])
const total = ref(0)
const cutConfig = ref({ defaultHeightCut: 40, defaultWidthCut: 70 })
const selectedRows = ref([])
const tagOptions = ref([]) // 加工备注标签联想库（全量去重，onMounted 拉一次）

const editVisible = ref(false)
const editRow = ref(null)
const editForm = ref({})

// remark_tags：DB 存 JSON.stringify 字符串数组，前端解析回数组渲染
function parseTags(raw) {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((s) => typeof s === 'string' && s) : []
  } catch {
    return []
  }
}

async function load() {
  const params = { ...query.value }
  if (params.dateRange && params.dateRange.length === 2) {
    params.startDate = params.dateRange[0]
    params.endDate = params.dateRange[1]
  }
  delete params.dateRange
  const res = await cuttingApi.list(params)
  list.value = res.data.list
  total.value = res.data.total
}

function resetQuery() {
  query.value = { order_no: '', customer: '', dateRange: [], page: 1, pageSize: 20 }
  load()
}

function onSelectionChange(rows) {
  selectedRows.value = rows
}

function openEdit(row) {
  editRow.value = row
  editForm.value = {
    door_height: Number(row.door_height),
    door_width: Number(row.door_width),
    handler: row.handler || store.name,
    cut_date: row.cut_date ? String(row.cut_date).slice(0, 10) : todayLocal(),
    tags: parseTags(row.remark_tags),
  }
  editVisible.value = true
}

async function onEdit() {
  const f = editForm.value
  if (!f.door_height || !f.door_width) return ElMessage.warning('门扇高/宽必填')
  if (!f.cut_date) return ElMessage.warning('请填下料日期')
  await cuttingApi.update(editRow.value.id, {
    door_height: f.door_height,
    door_width: f.door_width,
    cut_date: f.cut_date,
    handler: f.handler,
    remark_tags: JSON.stringify(f.tags),
  })
  ElMessage.success('已更新')
  editVisible.value = false
  load()
}

// 打印入口（ARE-112 实现专用打印页，此处先跳转带参）
function printSingle(row) {
  router.push({ path: '/cutting-list/print', query: { mode: 'single', ids: row.id } })
}
function openBatchPrint() {
  const ids = selectedRows.value.map((r) => r.id).join(',')
  router.push({ path: '/cutting-list/print', query: { mode: 'ledger', ids } })
}

async function onDelete(row) {
  await ElMessageBox.confirm(`确认删除下料单 #${row.id}（订单 ${row.order_no}）？删除后该订单可重新生成。`, '删除确认', { type: 'warning' })
  await cuttingApi.remove(row.id)
  ElMessage.success('已删除')
  load()
}

onMounted(async () => {
  cutConfig.value = (await cuttingApi.getConfig()).data
  tagOptions.value = (await cuttingApi.getTags()).data || []
  load()
})
</script>

<style scoped>
.muted { color: #909399; font-size: 12px; }
.size-cell { line-height: 1.4; }
.size-cell .muted { display: block; }
.tag-row { display: flex; flex-wrap: wrap; gap: 4px; }
.tag-item { margin: 0; }
</style>
