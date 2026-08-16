<template>
  <div class="m-list">
    <van-nav-bar :title="store.name + ' 的测量记录'">
      <template #right><van-button size="small" @click="onLogout">退出</van-button></template>
    </van-nav-bar>
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list v-model:loading="loading" :finished="finished" @load="onLoad">
        <van-cell v-for="r in list" :key="r.id" :title="r.customer_name" :label="`${r.location_name} · ${r.door_h}×${r.door_w} · 墙厚${r.wall_thick}`" @click="$router.push('/m/measure/'+r.id)">
          <template #value>
            <van-tag :type="r.status==='待转单'?'warning':'success'">{{ r.status }}</van-tag>
          </template>
        </van-cell>
      </van-list>
    </van-pull-refresh>
    <div class="fab"><van-button type="primary" round size="large" @click="$router.push('/m/measure')">+ 新建测量</van-button></div>
  </div>
</template>
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { measureApi } from '../api/index'
import { useUserStore } from '../store/user'
const router = useRouter()
const store = useUserStore()
const list = ref([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(0)
const onLoad = async () => {
  page.value++
  const { data } = await measureApi.mine({ page: page.value, size: 20 })
  list.value.push(...data)
  loading.value = false
  if (data.length < 20) finished.value = true
}
const onRefresh = () => { list.value=[]; page.value=0; finished.value=false; onLoad(); refreshing.value=false }
const onLogout = () => { store.logout(); router.replace('/m/login') }
</script>
<style scoped>
.fab { position:fixed; bottom:0; left:0; right:0; padding:12px; max-width:640px; margin:0 auto; background:#fff; box-shadow:0 -2px 8px rgba(0,0,0,.05) }
</style>
