<template>
  <div class="m-form">
    <van-nav-bar title="新建测量" left-text="返回" left-arrow @click-left="$router.back()" />
    <van-steps :active="step" active-color="#1989fa">
      <van-step>客户</van-step><van-step>定位</van-step><van-step>尺寸</van-step><van-step>备注照片</van-step>
    </van-steps>

    <!-- 第①步 客户 -->
    <div v-if="step===0">
      <van-search v-model="custKw" placeholder="搜索客户" @search="searchCust" />
      <van-cell-group>
        <van-cell v-for="c in custList" :key="c.id" :title="c.name" :label="c.customer_type" is-link @click="pickCust(c)">
          <template #right-icon><van-icon v-if="form.customer_id===c.id" name="success" color="#07c160" /></template>
        </van-cell>
      </van-cell-group>
      <div class="bar"><van-button block type="primary" :disabled="!form.customer_id" @click="step=1">下一步</van-button></div>
    </div>

    <!-- 第②步 定位 -->
    <div v-if="step===1">
      <van-field v-model="locKw" placeholder="搜索或输入新定位" @input="searchLoc" />
      <van-cell-group>
        <van-cell v-for="l in locList" :key="l.id" :title="l.name" is-link @click="pickLoc(l)">
          <template #right-icon><van-icon v-if="form.location_id===l.id" name="success" color="#07c160" /></template>
        </van-cell>
      </van-cell-group>
      <div v-if="locKw && !locList.find(l=>l.name===locKw)" class="bar">
        <van-button block type="warning" @click="createLoc">+ 新建定位「{{ locKw }}」</van-button>
      </div>
      <div class="bar">
        <van-button block @click="step=0">上一步</van-button>
        <van-button block type="primary" :disabled="!form.location_id" @click="step=2" style="margin-top:8px">下一步</van-button>
      </div>
    </div>

    <!-- 第③步 尺寸 -->
    <div v-if="step===2">
      <van-cell-group inset>
        <van-field v-model.number="form.door_h" type="number" label="门洞高" placeholder="mm" />
        <van-field v-model.number="form.door_w" type="number" label="门洞宽" placeholder="mm" />
        <van-field v-model.number="form.wall_thick" type="number" label="墙厚" placeholder="mm" />
      </van-cell-group>
      <div class="bar">
        <van-button block @click="step=1">上一步</van-button>
        <van-button block type="primary" :disabled="!form.door_h||!form.door_w||!form.wall_thick" @click="step=3" style="margin-top:8px">下一步</van-button>
      </div>
    </div>

    <!-- 第④步 备注+照片 -->
    <div v-if="step===3">
      <van-cell-group inset>
        <van-field v-model="form.remark" type="textarea" label="备注" placeholder="现场备注（可选）" />
      </van-cell-group>
      <van-cell-group inset title="现场照片（可选）">
        <van-uploader v-model="photos" :after-read="onAfterRead" @delete="onDelete" multiple />
      </van-cell-group>
      <div class="bar">
        <van-button block @click="step=2">上一步</van-button>
        <van-button block type="success" :loading="submitting" @click="onSubmit" style="margin-top:8px">提交测量记录</van-button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showSuccessToast } from 'vant'
import { customerApi, measureApi, attachmentApi } from '../api/index'

const router = useRouter()
const step = ref(0)
const custKw = ref(''), custList = ref([])
const locKw = ref(''), locList = ref([])
const form = reactive({ customer_id: null, customer_name: '', location_id: null, location_name: '', door_h: null, door_w: null, wall_thick: null, remark: '' })
const photos = ref([])
const submitting = ref(false)

onMounted(async () => { const { data } = await customerApi.all(); custList.value = data })
const searchCust = () => {}
const pickCust = (c) => { form.customer_id = c.id; form.customer_name = c.name; form.location_id = null; form.location_name = ''; locKw.value = ''; step.value = 1; loadLoc() }
const loadLoc = async () => { if (!form.customer_id) return; const { data } = await customerApi.locations(form.customer_id); locList.value = data }
const searchLoc = () => { /* 已全量加载，前端过滤或后端搜；这里简化全量 */ }
const pickLoc = (l) => { form.location_id = l.id; form.location_name = l.name }
const createLoc = async () => {
  const { data } = await customerApi.addLocation(form.customer_id, { name: locKw.value })
  form.location_id = data.id; form.location_name = locKw.value
  showSuccessToast('定位已新建')
}
const onAfterRead = async (file) => {
  // file 可能是数组（multiple）
  const arr = Array.isArray(file) ? file : [file]
  for (const f of arr) {
    const fd = new FormData()
    fd.append('file', f.file)
    fd.append('entity_type', 'measure')
    const { data } = await attachmentApi.upload(fd, { params: { customer_name: form.customer_name, location_name: form.location_name } })
    f.photo_id = data.id
    f.url = data.file_path
  }
}
const onDelete = async (file) => { if (file.photo_id) await attachmentApi.remove(file.photo_id) }
const onSubmit = async () => {
  submitting.value = true
  try {
    const photo_ids = photos.value.map(p => p.photo_id).filter(Boolean)
    const { data } = await measureApi.create({ ...form, photo_ids })
    showSuccessToast('记录已保存')
    router.replace('/m')
  } catch (e) { showToast(e.message || '提交失败') }
  finally { submitting.value = false }
}
</script>
<style scoped>
.m-form { min-height:100vh; background:#f7f8fa; padding-bottom:80px }
.bar { padding:12px }
</style>
