<template>
  <el-button :icon="Setting" size="small" title="列设置" @click="visible = true">列设置</el-button>
  <el-drawer
    v-model="visible"
    title="列设置"
    direction="rtl"
    size="440px"
    :with-header="true"
  >
    <div class="col-settings">
      <div class="col-settings-hd">
        <span>显示列 <b>{{ visibleProps.length }}</b> / {{ columns.length }}</span>
        <div>
          <el-button link size="small" @click="toggleAll">{{ allOn ? '全部隐藏' : '全部显示' }}</el-button>
          <el-button link size="small" @click="resetDefaults">重置</el-button>
        </div>
      </div>
      <div class="col-settings-tip">拖动 = 调整列顺序 · 开关 = 显示/隐藏 · 自动记忆</div>
      <div class="col-settings-list">
        <div
          v-for="(c, idx) in orderedCols"
          :key="c.prop"
          class="col-row"
          :class="{ dragging: dragIdx === idx, 'drag-over': dragOverIdx === idx }"
          draggable="true"
          @dragstart="onDragStart(idx, $event)"
          @dragover.prevent="onDragOver(idx)"
          @dragleave="onDragLeave(idx)"
          @drop="onDrop(idx)"
          @dragend="onDragEnd"
        >
          <el-icon class="drag-handle" title="拖拽排序"><Rank /></el-icon>
          <span class="col-idx">{{ idx + 1 }}</span>
          <span class="col-label">{{ c.label }}</span>
          <el-switch :model-value="isVisible(c.prop)" size="small" @change="(v) => toggleProp(c.prop, v)" />
        </div>
      </div>
    </div>
    <template #footer>
      <div class="drawer-foot">
        <el-button @click="visible = false">完成</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { Setting, Rank } from '@element-plus/icons-vue'

// columns: [{ prop, label, defaultVisible }]——defaultVisible 省略或 true=默认显示
// storageKey: localStorage 键，按页面隔离记忆（visible 存 ${storageKey}-visible，order 存 ${storageKey}-order）
// emit change: { visible, order }——visible=显示的 prop 数组，order=全部 prop 的排序数组
const props = defineProps({
  columns: { type: Array, required: true },
  storageKey: { type: String, required: true },
})
const emit = defineEmits(['change'])

const visible = ref(false) // 抽屉显隐
const visibleProps = ref([]) // 显示的 prop 数组
const orderedCols = ref([]) // 全部列按当前排序（含隐藏），驱动列表渲染与拖拽

const dragIdx = ref(-1)    // 正在拖拽的项索引
const dragOverIdx = ref(-1) // 拖拽悬停目标索引

const allOn = computed(() => visibleProps.value.length === props.columns.length)

function isVisible(prop) { return visibleProps.value.includes(prop) }
function toggleProp(prop, on) {
  if (on) {
    if (!visibleProps.value.includes(prop)) visibleProps.value = [...visibleProps.value, prop]
  } else {
    visibleProps.value = visibleProps.value.filter((p) => p !== prop)
  }
}

function defaultsVisible() {
  return props.columns.filter((c) => c.defaultVisible !== false).map((c) => c.prop)
}
function load() {
  const valid = new Set(props.columns.map((c) => c.prop))
  // order：从 localStorage 读，过滤失效列，补齐新增列（新列追加到末尾）
  let order
  try {
    const saved = localStorage.getItem(props.storageKey + '-order')
    order = saved ? JSON.parse(saved).filter((p) => valid.has(p)) : []
  } catch { order = [] }
  for (const c of props.columns) if (!order.includes(c.prop)) order.push(c.prop)
  orderedCols.value = order.map((p) => props.columns.find((c) => c.prop === p)).filter(Boolean)

  // visible：兼容旧键（曾只存 ${storageKey} 一个 visible 数组，无 order）
  try {
    const savedVis = localStorage.getItem(props.storageKey + '-visible')
    if (savedVis) {
      visibleProps.value = JSON.parse(savedVis).filter((p) => valid.has(p))
    } else {
      const legacy = localStorage.getItem(props.storageKey)
      visibleProps.value = legacy ? JSON.parse(legacy).filter((p) => valid.has(p)) : defaultsVisible()
    }
  } catch { visibleProps.value = defaultsVisible() }
}
function resetDefaults() {
  orderedCols.value = [...props.columns]
  visibleProps.value = defaultsVisible()
}
function toggleAll() {
  visibleProps.value = allOn.value ? [] : props.columns.map((c) => c.prop)
}

// HTML5 拖拽排序
function onDragStart(idx, e) {
  dragIdx.value = idx
  e.dataTransfer.effectAllowed = 'move'
}
function onDragOver(idx) {
  if (dragIdx.value !== -1 && dragIdx.value !== idx) dragOverIdx.value = idx
}
function onDragLeave(idx) {
  if (dragOverIdx.value === idx) dragOverIdx.value = -1
}
function onDrop(idx) {
  const from = dragIdx.value
  const to = idx
  if (from === -1 || from === to) { dragIdx.value = -1; dragOverIdx.value = -1; return }
  const arr = [...orderedCols.value]
  const [moved] = arr.splice(from, 1)
  arr.splice(to, 0, moved)
  orderedCols.value = arr
  dragIdx.value = -1
  dragOverIdx.value = -1
}
function onDragEnd() { dragIdx.value = -1; dragOverIdx.value = -1 }

function persist() {
  const order = orderedCols.value.map((c) => c.prop)
  localStorage.setItem(props.storageKey + '-order', JSON.stringify(order))
  localStorage.setItem(props.storageKey + '-visible', JSON.stringify(visibleProps.value))
  localStorage.removeItem(props.storageKey) // 清理旧键
  emit('change', { visible: [...visibleProps.value], order })
}

watch(visibleProps, persist, { deep: true })
watch(orderedCols, persist, { deep: true })

onMounted(() => {
  load()
  emit('change', { visible: [...visibleProps.value], order: orderedCols.value.map((c) => c.prop) })
})
</script>

<style scoped>
.col-settings { font-size: 14px; }
.col-settings-hd { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-weight: 600; }
.col-settings-hd b { color: #409eff; }
.col-settings-tip { font-size: 12px; color: #909399; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #ebeef5; }
.col-settings-list { display: flex; flex-direction: column; gap: 2px; }
.col-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 6px; border: 1px solid transparent; cursor: grab; transition: background .12s, border-color .12s; }
.col-row:hover { background: #f5f7fa; }
.col-row.dragging { opacity: .4; }
.col-row.drag-over { background: #ecf5ff; border-color: #409eff; }
.drag-handle { color: #c0c4cc; cursor: grab; flex-shrink: 0; }
.col-idx { width: 22px; height: 22px; line-height: 22px; text-align: center; background: #f0f2f5; border-radius: 50%; font-size: 12px; color: #909399; flex-shrink: 0; }
.col-label { flex: 1; }
.drawer-foot { text-align: right; }
</style>
