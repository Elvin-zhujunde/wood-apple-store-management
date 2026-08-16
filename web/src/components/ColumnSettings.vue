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
      <el-checkbox-group v-model="visibleProps" class="col-settings-list">
        <el-checkbox v-for="c in columns" :key="c.prop" :value="c.prop" :label="c.prop">
          {{ c.label }}
        </el-checkbox>
      </el-checkbox-group>
      <div class="col-settings-tip">勾选即显示，关闭即隐藏，自动记忆</div>
    </div>
  </el-popover>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { Setting } from '@element-plus/icons-vue'

// columns: [{ prop, label, defaultVisible }]——defaultVisible 省略或 true=默认显示
// storageKey: localStorage 键，按页面隔离记忆
// emit change: visibleProps 数组（当前显示的 prop 集合）
const props = defineProps({
  columns: { type: Array, required: true },
  storageKey: { type: String, required: true },
  width: { type: Number, default: 220 },
})
const emit = defineEmits(['change'])

const visibleProps = ref([])

function defaults() {
  return props.columns.filter((c) => c.defaultVisible !== false).map((c) => c.prop)
}
function load() {
  try {
    const saved = localStorage.getItem(props.storageKey)
    if (saved) {
      const arr = JSON.parse(saved)
      // 过滤掉已不存在的列（列定义变更后兼容）
      const valid = new Set(props.columns.map((c) => c.prop))
      visibleProps.value = arr.filter((p) => valid.has(p))
    } else {
      visibleProps.value = defaults()
    }
  } catch {
    visibleProps.value = defaults()
  }
}
function resetDefaults() {
  visibleProps.value = defaults()
}

watch(visibleProps, (v) => {
  localStorage.setItem(props.storageKey, JSON.stringify(v))
  emit('change', v)
}, { deep: true })

onMounted(() => {
  load()
  emit('change', visibleProps.value)
})
</script>

<style scoped>
.col-settings { font-size: 13px; }
.col-settings-hd { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-weight: 600; }
.col-settings-list { display: flex; flex-direction: column; gap: 4px; max-height: 320px; overflow-y: auto; }
.col-settings-tip { margin-top: 8px; font-size: 11px; color: #909399; }
</style>
