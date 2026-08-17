import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../store/user'
import { menuList } from './menu'

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/login.vue') },
  // ARE-112：打印专用页，顶层路由（脱离 layout，无侧栏/导航），登录后任意角色可访问
  { path: '/cutting-list/print', name: 'cutting-list-print', component: () => import('../views/cuttingListPrint.vue'), meta: { title: '下料单打印' } },
  // 标签打印专用页：4 种标签类型，window.print 实现，@page 按标签纸尺寸定纸张
  { path: '/label/print', name: 'label-print', component: () => import('../views/labelPrint.vue'), meta: { title: '标签打印' } },
  // H5 移动端路由组（脱 layout，Vant）
  { path: '/m/login', name: 'm-login', component: () => import('../mobile/login.vue') },
  { path: '/m', name: 'm-home', component: () => import('../mobile/layout.vue'), children: [
    { path: '', name: 'm-list', component: () => import('../mobile/measureList.vue') },
    { path: 'measure', name: 'm-new', component: () => import('../mobile/measureForm.vue') },
    { path: 'measure/:id', name: 'm-detail', component: () => import('../mobile/measureDetail.vue') },
  ]},
  {
    path: '/',
    component: () => import('../layout/index.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'dashboard', component: () => import('../views/dashboard.vue'), meta: { title: '工作台' } },
      { path: 'inventory', name: 'inventory', component: () => import('../views/inventory.vue'), meta: { title: '库存查询' } },
      { path: 'suggestion', name: 'suggestion', component: () => import('../views/suggestion.vue'), meta: { title: '采购建议' } },
      { path: 'orders', name: 'orders', component: () => import('../views/orders.vue'), meta: { title: '销售订单' } },
      { path: 'inbound', name: 'inbound', component: () => import('../views/inbound.vue'), meta: { title: '采购入库' } },
      { path: 'requisition', name: 'requisition', component: () => import('../views/requisition.vue'), meta: { title: '生产领料' } },
      { path: 'materials', name: 'materials', component: () => import('../views/materials.vue'), meta: { title: '物料档案' } },
      { path: 'door-bom', name: 'door-bom', component: () => import('../views/doorBom.vue'), meta: { title: '门型BOM' } },
      { path: 'customers', name: 'customers', component: () => import('../views/customers.vue'), meta: { title: '客户档案' } },
      { path: 'users', name: 'users', component: () => import('../views/users.vue'), meta: { title: '用户管理' } },
      { path: 'measures', name: 'measures', component: () => import('../views/measures.vue'), meta: { title: '测量记录' } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
]

const router = createRouter({ history: createWebHistory(), routes })

// 路由守卫：登录校验 + worker 桌面拒入 + 角色菜单校验
router.beforeEach((to, from, next) => {
  const store = useUserStore()
  // H5 路由组放行
  if (to.path.startsWith('/m')) {
    if (to.path !== '/m/login' && !store.isLogin) return next('/m/login')
    return next()
  }
  if (to.path === '/login') return next()
  if (!store.isLogin) return next('/login')
  // worker 桌面拒入 → 跳 H5
  if (store.role === 'worker') return next('/m')
  // 原角色菜单校验
  const fullPath = to.path.startsWith('/') ? to.path : '/' + to.path
  const menu = menuList.find((m) => m.path === fullPath)
  if (menu && !menu.roles.includes(store.role)) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
