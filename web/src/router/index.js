import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../store/user'
import { menuList } from './menu'

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/login.vue') },
  // ARE-112：打印专用页，顶层路由（脱离 layout，无侧栏/导航），登录后任意角色可访问
  { path: '/cutting-list/print', name: 'cutting-list-print', component: () => import('../views/cuttingListPrint.vue'), meta: { title: '下料单打印' } },
  {
    path: '/',
    component: () => import('../layout/index.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'dashboard', component: () => import('../views/dashboard.vue'), meta: { title: '工作台' } },
      { path: 'inventory', name: 'inventory', component: () => import('../views/inventory.vue'), meta: { title: '库存查询' } },
      { path: 'suggestion', name: 'suggestion', component: () => import('../views/suggestion.vue'), meta: { title: '采购建议' } },
      { path: 'orders', name: 'orders', component: () => import('../views/orders.vue'), meta: { title: '销售订单' } },
      { path: 'cutting-list', name: 'cutting-list', component: () => import('../views/cuttingList.vue'), meta: { title: '下料单' } },
      { path: 'inbound', name: 'inbound', component: () => import('../views/inbound.vue'), meta: { title: '采购入库' } },
      { path: 'requisition', name: 'requisition', component: () => import('../views/requisition.vue'), meta: { title: '生产领料' } },
      { path: 'materials', name: 'materials', component: () => import('../views/materials.vue'), meta: { title: '物料档案' } },
      { path: 'report/inventory', name: 'report-inventory', component: () => import('../views/reportInventory.vue'), meta: { title: '库存总表' } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
]

const router = createRouter({ history: createWebHistory(), routes })

// 路由守卫：登录校验 + 角色菜单校验
router.beforeEach((to, from, next) => {
  const store = useUserStore()
  if (to.path === '/login') return next()
  if (!store.isLogin) return next('/login')
  // 校验该路由是否在当前角色菜单中
  const fullPath = to.path.startsWith('/') ? to.path : '/' + to.path
  const menu = menuList.find((m) => m.path === fullPath)
  if (menu && !menu.roles.includes(store.role)) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
