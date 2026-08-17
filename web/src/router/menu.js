// 角色模型：boss（超管，桌面全功能）+ worker（仅 H5 量尺，桌面拒入）
const ALL = ['boss']
export const menuList = [
  { path: '/dashboard', title: '工作台', icon: 'HomeFilled', roles: ALL },
  { path: '/inventory', title: '库存查询', icon: 'Box', roles: ALL },
  { path: '/suggestion', title: '采购建议', icon: 'Warning', roles: ALL },
  { path: '/orders', title: '销售订单', icon: 'Document', roles: ALL },
  { path: '/measures', title: '测量记录', icon: 'Aim', roles: ALL },
  { path: '/inbound', title: '采购入库', icon: 'Goods', roles: ALL },
  { path: '/requisition', title: '生产领料', icon: 'Tools', roles: ALL },
  { path: '/materials', title: '物料档案', icon: 'Files', roles: ALL },
  { path: '/door-bom', title: '门型BOM', icon: 'Setting', roles: ALL },
  { path: '/customers', title: '客户档案', icon: 'OfficeBuilding', roles: ALL },
  { path: '/users', title: '用户管理', icon: 'User', roles: ALL },
]

export function menusForRole(role) {
  return menuList.filter((m) => m.roles.includes(role))
}

export const roleLabel = { boss: '老板', worker: '工人' }
