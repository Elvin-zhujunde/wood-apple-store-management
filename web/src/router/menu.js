// 菜单配置：去角色化 —— 实际使用为 2-3 个自己人、角色不分，所有菜单对全部角色开放
// roles 字段保留用于前端兼容，但三个角色均全可见
const ALL = ['sale', 'stock', 'finance']
export const menuList = [
  { path: '/dashboard', title: '工作台', icon: 'HomeFilled', roles: ALL },
  { path: '/inventory', title: '库存查询', icon: 'Box', roles: ALL },
  { path: '/suggestion', title: '采购建议', icon: 'Warning', roles: ALL },
  { path: '/orders', title: '销售订单', icon: 'Document', roles: ALL },
  { path: '/inbound', title: '采购入库', icon: 'Goods', roles: ALL },
  { path: '/requisition', title: '生产领料', icon: 'Tools', roles: ALL },
  { path: '/materials', title: '物料档案', icon: 'Files', roles: ALL },
  { path: '/door-bom', title: '门型BOM', icon: 'Setting', roles: ALL },
  { path: '/report/inventory', title: '库存总表', icon: 'PieChart', roles: ALL },
  { path: '/report/orders', title: '订单跟踪表', icon: 'List', roles: ALL },
]

export function menusForRole(role) {
  return menuList.filter((m) => m.roles.includes(role))
}

// 角色中文名
export const roleLabel = { sale: '销售', stock: '库管/采购', finance: '财务/老板' }
