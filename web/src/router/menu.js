// 菜单配置：按角色过滤
// roles: ['sale','stock','finance'] 哪些角色可见
export const menuList = [
  { path: '/dashboard', title: '工作台', icon: 'HomeFilled', roles: ['sale', 'stock', 'finance'] },
  { path: '/inventory', title: '库存查询', icon: 'Box', roles: ['sale', 'stock', 'finance'] },
  { path: '/suggestion', title: '采购建议', icon: 'Warning', roles: ['stock', 'finance'] },
  { path: '/orders', title: '销售订单', icon: 'Document', roles: ['sale', 'finance'] },
  { path: '/inbound', title: '采购入库', icon: 'Goods', roles: ['stock', 'finance'] },
  { path: '/requisition', title: '生产领料', icon: 'Tools', roles: ['stock', 'finance'] },
  { path: '/materials', title: '物料档案', icon: 'Files', roles: ['stock', 'finance'] },
  { path: '/door-bom', title: '门型BOM', icon: 'Setting', roles: ['stock', 'finance'] },
  { path: '/report/inventory', title: '库存总表', icon: 'PieChart', roles: ['stock', 'finance'] },
  { path: '/report/orders', title: '订单跟踪表', icon: 'List', roles: ['sale', 'stock', 'finance'] },
]

export function menusForRole(role) {
  return menuList.filter((m) => m.roles.includes(role))
}

// 角色中文名
export const roleLabel = { sale: '销售', stock: '库管/采购', finance: '财务/老板' }
