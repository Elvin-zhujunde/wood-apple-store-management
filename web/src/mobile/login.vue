<template>
  <div class="m-login">
    <van-nav-bar title="木门测量录入" />
    <van-form @submit="onSubmit">
      <van-cell-group inset>
        <van-field v-model="form.username" name="username" label="账号" placeholder="账号" :rules="[{required:true}]" />
        <van-field v-model="form.password" type="password" name="password" label="密码" placeholder="密码" :rules="[{required:true}]" />
      </van-cell-group>
      <div style="margin:16px"><van-button round block type="primary" native-type="submit" :loading="loading">登录</van-button></div>
    </van-form>
  </div>
</template>
<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { authApi } from '../api/index'
import { useUserStore } from '../store/user'
const router = useRouter()
const store = useUserStore()
const form = reactive({ username: '', password: '' })
const loading = ref(false)
const onSubmit = async () => {
  loading.value = true
  try {
    const { data } = await authApi.login(form)
    store.setLogin(data.token, data.user)
    router.replace('/m')
  } catch (e) {
    showToast(e.message || '登录失败')
  } finally { loading.value = false }
}
</script>
<style scoped>
.m-login { min-height:100vh; background:#f7f8fa }
</style>
