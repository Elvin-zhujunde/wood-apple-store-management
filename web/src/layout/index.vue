<template>
  <el-container class="layout">
    <el-aside width="220px" class="aside">
      <div class="logo">木门库存系统</div>
      <el-menu :default-active="activeMenu" router class="menu">
        <el-menu-item v-for="m in menus" :key="m.path" :index="m.path">
          <el-icon><component :is="m.icon" /></el-icon>
          <span>{{ m.title }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="header-title">{{ currentTitle }}</div>
        <div class="header-right">
          <el-tag type="info" size="small">{{ roleLabel[role] }}</el-tag>
          <span class="username">{{ name }}</span>
          <el-button text @click="logout">退出</el-button>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../store/user'
import { menusForRole, roleLabel } from '../router/menu'

const route = useRoute()
const router = useRouter()
const store = useUserStore()

const role = computed(() => store.role)
const name = computed(() => store.name)
const menus = computed(() => menusForRole(store.role))
const activeMenu = computed(() => route.path)
const currentTitle = computed(() => route.meta.title || '工作台')

function logout() {
  store.logout()
  router.push('/login')
}
</script>

<style scoped>
.layout { height: 100vh; }
.aside { background: #304156; }
.logo { height: 60px; line-height: 60px; text-align: center; color: #fff; font-size: 16px; font-weight: 600; }
.menu { border-right: none; background: #304156; }
.menu :deep(.el-menu-item) { color: #bfcbd9; }
.menu :deep(.el-menu-item.is-active) { background: #263445; color: #409eff; }
.menu :deep(.el-menu-item:hover) { background: #263445; }
.header { display: flex; align-items: center; justify-content: space-between; background: #fff; border-bottom: 1px solid #ebeef5; }
.header-title { font-size: 16px; font-weight: 600; }
.header-right { display: flex; align-items: center; gap: 12px; }
.username { font-size: 14px; color: #606266; }
.main { background: #f0f2f5; padding: 16px; }
</style>
