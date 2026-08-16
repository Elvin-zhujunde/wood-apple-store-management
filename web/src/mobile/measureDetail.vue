<template>
  <div class="m-detail">
    <van-nav-bar title="测量详情" left-text="返回" left-arrow @click-left="$router.back()" />
    <van-cell-group inset v-if="r">
      <van-cell title="客户" :value="r.customer_name" />
      <van-cell title="安装定位" :value="r.location_name" />
      <van-cell title="门洞高" :value="r.door_h + ' mm'" />
      <van-cell title="门洞宽" :value="r.door_w + ' mm'" />
      <van-cell title="墙厚" :value="r.wall_thick + ' mm'" />
      <van-cell title="备注" :value="r.remark || '-'" />
      <van-cell title="测量时间" :value="r.measured_at" />
      <van-cell title="状态">
        <template #value><van-tag :type="r.status==='待转单'?'warning':'success'">{{ r.status }}</van-tag></template>
      </van-cell>
      <van-cell v-if="r.sales_order_id" title="关联订单" :value="'SO #' + r.sales_order_id" />
    </van-cell-group>
    <van-cell-group inset title="现场照片" v-if="r && r.photos && r.photos.length">
      <div class="thumbs">
        <van-image v-for="p in r.photos" :key="p.id" :src="imgUrl(p.file_path)" width="30%" height="100" @click="preview(p)" fit="cover" />
      </div>
    </van-cell-group>
    <div class="bar" v-if="r && r.status==='待转单'">
      <van-button block type="danger" @click="onDel">删除记录</van-button>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showImagePreview, showConfirmDialog, showSuccessToast } from 'vant'
import { measureApi } from '../api/index'
import { imgUrl } from '../utils/file'
const route = useRoute(), router = useRouter()
const r = ref(null)
onMounted(async () => { const { data } = await measureApi.detail(route.params.id); r.value = data })
const preview = (p) => { showImagePreview([imgUrl(p.file_path)]) }
const onDel = async () => {
  await showConfirmDialog({ title:'确认删除', message:'删除后不可恢复' })
  await measureApi.remove(route.params.id)
  showSuccessToast('已删除')
  router.replace('/m')
}
</script>
<style scoped>
.m-detail { min-height:100vh; background:#f7f8fa; padding-bottom:80px }
.thumbs { display:flex; gap:8px; padding:12px; flex-wrap:wrap }
.bar { padding:12px }
</style>
