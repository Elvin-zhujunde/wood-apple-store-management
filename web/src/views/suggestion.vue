<template>
  <el-card shadow="never">
    <div class="toolbar">
      <el-select v-model="query.status" placeholder="状态" clearable style="width:120px" @change="load">
        <el-option label="待采购" value="待采购" />
        <el-option label="已采购" value="已采购" />
      </el-select>
      <el-select v-model="query.priority" placeholder="优先级" clearable style="width:120px" @change="load">
        <el-option label="紧急" value="紧急" />
        <el-option label="常规" value="常规" />
      </el-select>
      <el-input v-model="query.customer" placeholder="客户名称" clearable style="width:150px" @change="load" />
      <el-input v-model="query.material_name" placeholder="物料名称" clearable style="width:140px" @change="load" />
      <el-button type="primary" @click="load">查询</el-button>
      <el-button @click="resetQuery">重置</el-button>
    </div>
    <el-alert type="warning" :closable="false" style="margin-bottom:12px">
      系统在<strong>销售订单保存时自动按 BOM 拆解</strong>物料需求并对比库存生成采购建议。点【采纳】可一键生成待到货采购入库单，到货确认后库存自动增加。
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
      <el-table-column prop="created_at" label="生成时间" width="170" :formatter="dateTimeFmt" />
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status === '待采购'">
            <el-button link type="primary" class="row-btn" @click="openAdopt(row)">采纳</el-button>
            <el-button link type="info" @click="markDone(row)">仅标记</el-button>
          </template>
          <el-button v-else link type="primary" @click="viewInbound(row)">查看采购单</el-button>
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

    <!-- 采纳弹窗：补厂家/进价/预计到货，数量默认建议量 -->
    <el-dialog v-model="adoptVisible" title="采纳采购建议" width="480px" :close-on-click-modal="false">
      <el-alert type="info" :closable="false" style="margin-bottom:12px">
        <strong>{{ adoptRow?.name }}</strong> · {{ adoptRow?.code }} · 关联订单 {{ adoptRow?.order_no }}（{{ adoptRow?.customer }}）
      </el-alert>
      <el-form :model="adoptForm" label-width="100px">
        <el-form-item label="采购数量" required>
          <el-input-number v-model="adoptForm.qty" :min="0" :precision="3" style="width:100%" />
          <div class="muted">默认取建议采购量 {{ adoptRow?.suggest_qty }}，可调整</div>
        </el-form-item>
        <el-form-item label="进货厂家" required>
          <el-input v-model="adoptForm.supplier" placeholder="供货厂家" />
        </el-form-item>
        <el-form-item label="进货单价" required>
          <el-input-number v-model="adoptForm.unit_price" :min="0" :precision="2" style="width:100%" />
        </el-form-item>
        <el-form-item label="物流费用">
          <el-input-number v-model="adoptForm.freight" :min="0" :precision="2" style="width:100%" />
        </el-form-item>
        <el-form-item label="预计到货">
          <el-date-picker v-model="adoptForm.expected_arrival" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
        <el-form-item label="经手人" required>
          <el-input v-model="adoptForm.handler" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adoptVisible = false">取消</el-button>
        <el-button type="primary" @click="onAdopt">确认采纳（生成采购单）</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { suggestionApi } from '../api'
import { dateTimeFmt } from '../utils/date'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../store/user'

const router = useRouter()
const store = useUserStore()
const query = ref({ status: '待采购', priority: '', customer: '', material_name: '', page: 1, pageSize: 20 })
const list = ref([])
const total = ref(0)

const adoptVisible = ref(false)
const adoptRow = ref(null)
const adoptForm = ref({})

async function load() {
  const res = await suggestionApi.list(query.value)
  list.value = res.data.list
  total.value = res.data.total
}

function resetQuery() {
  query.value = { status: '待采购', priority: '', customer: '', material_name: '', page: 1, pageSize: 20 }
  load()
}

function openAdopt(row) {
  adoptRow.value = row
  adoptForm.value = {
    qty: Number(row.suggest_qty),
    supplier: '',
    unit_price: 0,
    freight: 0,
    expected_arrival: '',
    handler: store.name,
  }
  adoptVisible.value = true
}

async function onAdopt() {
  const f = adoptForm.value
  if (!f.qty || !f.supplier || !f.unit_price || !f.handler)
    return ElMessage.warning('请补全厂家/进价/经手人')
  const res = await suggestionApi.adopt(adoptRow.value.id, f)
  ElMessage.success(`已采纳，已生成采购入库单 ${res.data.inbound_no}（待到货）`)
  adoptVisible.value = false
  load()
}

async function markDone(row) {
  await suggestionApi.updateStatus(row.id, '已采购')
  ElMessage.success('已标记为已采购')
  load()
}

function viewInbound(row) {
  // 已采纳的跳采购入库页（inbound_id 可溯源，但列表页暂不带筛选，直接跳）
  router.push('/inbound')
}

onMounted(load)
</script>

<style scoped>
.muted { color: #909399; font-size: 12px; margin-top: 2px; }
@media (max-width: 768px) {
  .row-btn { min-height: 44px; padding: 0 12px; }
}
</style>
