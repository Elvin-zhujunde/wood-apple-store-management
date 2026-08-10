<template>
  <div class="login-wrap">
    <el-card class="login-card">
      <h2 class="title">木门库存与订单管理系统</h2>
      <p class="subtitle">内网登录</p>
      <el-form :model="form" label-width="0" @submit.prevent="onLogin">
        <el-form-item>
          <el-input v-model="form.username" placeholder="账号" prefix-icon="User" size="large" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" type="password" placeholder="密码" prefix-icon="Lock" size="large" show-password />
        </el-form-item>
        <el-button type="primary" size="large" style="width:100%" :loading="loading" @click="onLogin">登 录</el-button>
      </el-form>
      <div class="accounts">
        <p>任选账号登录，菜单全开（密码均 123456）：</p>
        <el-space wrap>
          <el-button size="small" @click="quick('sale')">sale</el-button>
          <el-button size="small" @click="quick('stock')">stock</el-button>
          <el-button size="small" @click="quick('finance')">finance</el-button>
        </el-space>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { authApi } from '../api'
import { useUserStore } from '../store/user'

const router = useRouter()
const store = useUserStore()
const form = ref({ username: '', password: '' })
const loading = ref(false)

function quick(u) {
  form.value = { username: u, password: '123456' }
}

async function onLogin() {
  if (!form.value.username || !form.value.password) return ElMessage.warning('请输入账号密码')
  loading.value = true
  try {
    const res = await authApi.login(form.value)
    store.setLogin(res.data.token, res.data.user)
    ElMessage.success('登录成功')
    router.push('/dashboard')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-wrap { height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea, #764ba2); }
.login-card { width: 380px; padding: 20px; }
.title { margin: 0 0 4px; text-align: center; color: #303133; }
.subtitle { margin: 0 0 20px; text-align: center; color: #909399; font-size: 13px; }
.accounts { margin-top: 16px; padding-top: 12px; border-top: 1px dashed #ebeef5; font-size: 12px; color: #909399; }
.accounts p { margin: 0 0 8px; }
</style>
