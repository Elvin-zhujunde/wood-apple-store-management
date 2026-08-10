<template>
  <el-container class="layout">
    <!-- 桌面端固定侧边栏 -->
    <el-aside v-if="!isMobile" width="220px" class="aside">
      <div class="logo">木门库存系统</div>
      <el-menu :default-active="activeMenu" router class="menu">
        <el-menu-item v-for="m in menus" :key="m.path" :index="m.path">
          <el-icon><component :is="m.icon" /></el-icon>
          <span>{{ m.title }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <!-- 移动端抽屉侧边栏 -->
    <el-drawer v-else v-model="drawerVisible" direction="ltr" :size="220" :with-header="false">
      <div class="aside drawer-aside">
        <div class="logo">木门库存系统</div>
        <el-menu :default-active="activeMenu" router class="menu" @select="onMenuSelect">
          <el-menu-item v-for="m in menus" :key="m.path" :index="m.path">
            <el-icon><component :is="m.icon" /></el-icon>
            <span>{{ m.title }}</span>
          </el-menu-item>
        </el-menu>
      </div>
    </el-drawer>

    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-icon v-if="isMobile" class="hamburger" @click="drawerVisible = true"><Fold /></el-icon>
          <span class="header-title">{{ currentTitle }}</span>
        </div>
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Fold } from '@element-plus/icons-vue'
import { useUserStore } from '../store/user'
import { menusForRole, roleLabel } from '../router/menu'

const route = useRoute()
const router = useRouter()
const store = useUserStore()

// 移动端断点：≤768px 视为移动端
const isMobile = ref(false)
const drawerVisible = ref(false)

function checkMobile() {
  isMobile.value = window.innerWidth <= 768
}
onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', checkMobile)
})

const role = computed(() => store.role)
const name = computed(() => store.name)
const menus = computed(() => menusForRole(store.role))
const activeMenu = computed(() => route.path)
const currentTitle = computed(() => route.meta.title || '工作台')

function onMenuSelect() {
  // 移动端选完菜单收起抽屉
  drawerVisible.value = false
}

function logout() {
  store.logout()
  router.push('/login')
}
</script>

<style scoped>
.layout { height: 100vh; }
.aside { background: #304156; }
.drawer-aside { height: 100%; }
.logo { height: 60px; line-height: 60px; text-align: center; color: #fff; font-size: 16px; font-weight: 600; }
.menu { border-right: none; background: #304156; }
.menu :deep(.el-menu-item) { color: #bfcbd9; }
.menu :deep(.el-menu-item.is-active) { background: #263445; color: #409eff; }
.menu :deep(.el-menu-item:hover) { background: #263445; }
.header { display: flex; align-items: center; justify-content: space-between; background: #fff; border-bottom: 1px solid #ebeef5; }
.header-left { display: flex; align-items: center; gap: 12px; }
.header-title { font-size: 16px; font-weight: 600; }
.header-right { display: flex; align-items: center; gap: 12px; }
.username { font-size: 14px; color: #606266; }
.main { background: #f0f2f5; padding: 16px; }
.hamburger { font-size: 22px; cursor: pointer; }
/* 移动端：主内容区 padding 收紧，给表格更多空间 */
@media (max-width: 768px) {
  .main { padding: 8px; }
  .header-title { font-size: 15px; }
  .username { display: none; }
}
</style>
