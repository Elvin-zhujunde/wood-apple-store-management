<template>
  <div class="image-upload">
    <el-upload
      :action="uploadUrl"
      :headers="headers"
      :data="{ entity_type: entityType, entity_id: entityId }"
      :show-file-list="false"
      :before-upload="beforeUpload"
      :on-success="onSuccess"
      :on-error="onError"
      :accept="'image/jpeg,image/png,image/webp,image/gif'"
      :disabled="!entityId"
      name="file"
    >
      <el-button :icon="Plus" :disabled="!entityId">
        {{ entityId ? '上传图片' : '请先保存业务记录' }}
      </el-button>
      <template #tip>
        <div class="tip">仅 jpg/png/webp/gif，单张 ≤ 5MB{{ entityId ? '' : '（保存记录后可上传）' }}</div>
      </template>
    </el-upload>

    <div v-if="modelValue.length" class="thumbs">
      <div v-for="(item, idx) in modelValue" :key="idx" class="thumb">
        <el-image :src="imgUrl(item.file_path)" :preview-src-list="previewList" :initial-index="idx" fit="cover" class="img" :preview-teleported="true" />
        <div class="name" :title="item.file_name">{{ item.file_name }}</div>
        <el-button link type="danger" size="small" @click="onRemove(item, idx)">删除</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { attachmentApi } from '../api'
import { imgUrl } from '../utils/file'

const props = defineProps({
  // v-model: 附件对象数组 [{id, file_path, file_name, ...}]
  modelValue: { type: Array, default: () => [] },
  // 业务实体类型 order/inbound/material/bom/requisition
  entityType: { type: String, default: '' },
  // 业务实体id（新建未保存时为空，禁止上传）
  entityId: { type: [Number, String], default: '' },
})

const emit = defineEmits(['update:modelValue'])

const uploadUrl = '/api/attachments/upload'
const headers = computed(() => ({
  Authorization: 'Bearer ' + (localStorage.getItem('token') || ''),
}))

const previewList = computed(() => props.modelValue.map((i) => imgUrl(i.file_path)))

function beforeUpload(file) {
  const allow = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allow.includes(file.type)) {
    ElMessage.error('仅支持 jpg/png/webp/gif')
    return false
  }
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.error('单张不能超过 5MB')
    return false
  }
  return true
}

function onSuccess(resp) {
  if (resp.code === 0) {
    const next = [...props.modelValue, resp.data]
    emit('update:modelValue', next)
    ElMessage.success('上传成功')
  } else {
    ElMessage.error(resp.msg || '上传失败')
  }
}

function onError() {
  ElMessage.error('上传失败，请检查网络')
}

async function onRemove(item, idx) {
  try {
    await attachmentApi.remove(item.id)
    const next = props.modelValue.filter((_, i) => i !== idx)
    emit('update:modelValue', next)
    ElMessage.success('已删除')
  } catch (e) {
    // 接口已弹错误
  }
}
</script>

<style scoped>
.image-upload .thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 10px;
}
.image-upload .thumb {
  width: 120px;
  text-align: center;
}
.image-upload .img {
  width: 120px;
  height: 120px;
  border-radius: 6px;
  border: 1px solid #ebeef5;
}
.image-upload .name {
  font-size: 12px;
  color: #909399;
  margin: 4px 0 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.image-upload .tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}
</style>
