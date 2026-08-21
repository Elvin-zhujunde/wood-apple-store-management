<template>
  <el-popover trigger="click" placement="bottom-end" :width="width" :teleported="true">
    <template #reference>
      <el-button :icon="Setting" size="small" title="列设置">列设置</el-button>
    </template>
    <div class="col-settings">
      <div class="col-settings-hd">
        <span>显示列（{{ visibleProps.length }}/{{ columns.length }}）</span>
        <el-button link size="small" @click="resetDefaults">重置</el-button>
      </div>
      <div class="col-settings-tip-top">拖拽排序 · 勾选显隐</div>
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
          <el-icon class="drag-handle"><Rank /></el-icon>
          <el-checkbox v-model="visibleProps" :value="c.prop" :label="c.prop">{{ c.label }}</el-checkbox>
        </div>
      </div>
      <div class="col-settings-tip">拖动左侧图标调整列顺序，勾选显示/隐藏，自动记忆</div>
    </div>
  </el-popover>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { Setting, Rank } from '@element-plus/icons-vue'

// columns: [{ prop, label, defaultVisible }]——defaultVisible 省略或 true=默认显示
// storageKey: localStorage 键，按页面隔离记忆（visible 存 ${storageKey}，order 存 ${storageKey}-order）
// emit change: { visible, order }——visible=显示的 prop 数组，order=全部 prop 的排序数组
const props = defineProps({
  columns: { type: Array, required: true },
  storageKey: { type: String, required: true },
  width: { type: Number, default: 240 },
})
const emit = defineEmits(['change'])

const visibleProps = ref([])
const orderedCols = ref([]) // 全部列按当前排序（含隐藏），驱动列表渲染与拖拽

const dragIdx = ref(-1)    // 正在拖拽的项索引
const dragOverIdx = ref(-1) // 拖拽悬停目标索引

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
  // 清理旧键（迁移后不再用）
  localStorage.removeItem(props.storageKey)
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
.col-settings { font-size: 13px; }
.col-settings-hd { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-weight: 600; }
.col-settings-tip-top { font-size: 11px; color: #909399; margin-bottom: 6px; }
.col-settings-list { display: flex; flex-direction: column; gap: 2px; max-height: 360px; overflow-y: auto; }
.col-row { display: flex; align-items: center; gap: 6px; padding: 3px 4px; border-radius: 4px; cursor: grab; transition: background .12s; }
.col-row:hover { background: #f5f7fa; }
.col-row.dragging { opacity: .4; }
.col-row.drag-over { background: #ecf5ff; box-shadow: inset 0 2px 0 #409eff; }
.drag-handle { color: #c0c4cc; cursor: grab; flex-shrink: 0; }
.col-settings-tip { margin-top: 8px; font-size: 11px; color: #909399; }
</style>
