<!--
  通用标签输入组件（加工备注等场景）
  - v-model 绑定字符串数组（DB 存 JSON.stringify 字符串数组，纯文本）
  - 标签按文本 hash 自动配色，相同文本同色（颜色区分）；点标签循环换色（覆盖能力）
  - 联想：:suggestions 传近期去重数组（近期用过的排前）；输入时本地 includes 过滤
  - 常用标签行：未选中的建议渲染成可点芯片，点一下即加（不必打字）；回车/选中追加；空输入按 Backspace 删尾
-->
<template>
  <div class="tag-input-wrap">
    <div class="tag-row">
      <el-tag
        v-for="(t, i) in modelValue"
        :key="t + '_' + i"
        :type="colorOf(t)"
        closable
        class="tag-chip"
        @close="remove(i)"
        @click="cycleColor(t)"
      >{{ t }}</el-tag>
      <el-autocomplete
        v-model="input"
        :fetch-suggestions="fetch"
        :placeholder="placeholder"
        class="tag-field"
        @select="onSelect"
        @keyup.enter="onEnter"
        @keyup.delete="onBackspace"
      >
        <template #default="{ item }">{{ item.value }}</template>
      </el-autocomplete>
    </div>
    <div v-if="unusedSuggestions.length" class="suggest-row">
      <span class="suggest-label">常用</span>
      <el-tag
        v-for="t in unusedSuggestions"
        :key="t"
        :type="tagType(t)"
        size="small"
        effect="plain"
        class="suggest-chip"
        @click="addTag(t)"
      >{{ t }}</el-tag>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { TAG_TYPES, tagType } from '../utils/tagColor'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  suggestions: { type: Array, default: () => [] },
  placeholder: { type: String, default: '输入标签，回车添加' },
})
const emit = defineEmits(['update:modelValue'])

const input = ref('')
const colorOverride = reactive({}) // 文本→覆盖type（点击换色用）

function colorOf(text) {
  return colorOverride[text] ?? tagType(text)
}
function cycleColor(text) {
  const idx = TAG_TYPES.indexOf(colorOf(text))
  colorOverride[text] = TAG_TYPES[(idx + 1) % TAG_TYPES.length]
}

// 常用标签行：建议中未选中的，点一下即加（限 30 个避免过长）
const unusedSuggestions = computed(() =>
  props.suggestions.filter((s) => !props.modelValue.includes(s)).slice(0, 30)
)

function fetch(qs, cb) {
  const pool = props.suggestions
  const results = qs
    ? pool.filter((s) => s.includes(qs)).map((s) => ({ value: s }))
    : pool.map((s) => ({ value: s }))
  cb(results)
}

function addTag(val) {
  const v = (val || '').trim()
  if (!v) return
  if (!props.modelValue.includes(v)) {
    emit('update:modelValue', [...props.modelValue, v])
  }
  input.value = ''
}
function onSelect(item) {
  addTag(item && typeof item === 'object' ? item.value : item)
}
function onEnter() {
  addTag(input.value)
}
function onBackspace() {
  if (input.value === '' && props.modelValue.length) {
    emit('update:modelValue', props.modelValue.slice(0, -1))
  }
}
function remove(i) {
  const arr = [...props.modelValue]
  arr.splice(i, 1)
  emit('update:modelValue', arr)
}
</script>

<style scoped>
.tag-input-wrap { width: 100%; }
.tag-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.tag-chip { margin: 0; cursor: pointer; user-select: none; }
.tag-field { width: 180px; }
.suggest-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 8px; }
.suggest-label { font-size: 12px; color: #909399; }
.suggest-chip { margin: 0; cursor: pointer; }
</style>
