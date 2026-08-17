import request from './request'

// 鉴权
export const authApi = {
  login: (data) => request.post('/auth/login', data),
  me: () => request.get('/auth/me'),
}

// 物料档案
export const materialApi = {
  list: (params) => request.get('/materials', { params }),
  all: () => request.get('/materials/all'),
  detail: (id) => request.get('/materials/' + id),
  create: (data) => request.post('/materials', data),
  update: (id, data) => request.put('/materials/' + id, data),
  remove: (id) => request.delete('/materials/' + id),
}

// 门型BOM（管理模块已还原：列表/详情/增删改 + 只读下拉源）
export const bomApi = {
  list: (params) => request.get('/door-bom', { params }),
  all: () => request.get('/door-bom/all'),
  detail: (id) => request.get('/door-bom/' + id),
  create: (data) => request.post('/door-bom', data),
  update: (id, data) => request.put('/door-bom/' + id, data),
  remove: (id) => request.delete('/door-bom/' + id),
}

// 销售订单
export const orderApi = {
  list: (params) => request.get('/sales-orders', { params }),
  detail: (id) => request.get('/sales-orders/' + id),
  create: (data) => request.post('/sales-orders', data),
  update: (id, data) => request.put('/sales-orders/' + id, data),
  reopen: (id) => request.put('/sales-orders/' + id + '/reopen'),
  batchShip: (data) => request.put('/sales-orders/batch/ship', data),
  batchPay: (data) => request.put('/sales-orders/batch/pay', data),
  batchUpdate: (data) => request.put('/sales-orders/batch/update', data),
  lockHoles: () => request.get('/sales-orders/lock-holes'),
}

// 采购入库
export const inboundApi = {
  list: (params) => request.get('/purchase-inbound', { params }),
  detail: (id) => request.get('/purchase-inbound/' + id),
  create: (data) => request.post('/purchase-inbound', data),
  confirm: (id, data) => request.put('/purchase-inbound/' + id + '/confirm', data),
  batchConfirm: (data) => request.put('/purchase-inbound/batch/confirm', data),
}

// 生产领料
export const requisitionApi = {
  list: (params) => request.get('/requisition', { params }),
  create: (data) => request.post('/requisition', data),
  batch: (data) => request.post('/requisition/batch', data),
}

// 库存
export const inventoryApi = {
  list: (params) => request.get('/inventory', { params }),
  detail: (id, params) => request.get('/inventory/' + id, { params }),
}

// 采购建议
export const suggestionApi = {
  list: (params) => request.get('/purchase-suggestion', { params }),
  generate: (order_id) => request.post('/purchase-suggestion/generate', { order_id }),
  updateStatus: (id, status) => request.put('/purchase-suggestion/' + id + '/status', { status }),
  adopt: (id, data) => request.post('/purchase-suggestion/' + id + '/adopt', data),
}

// 下料单（ARE-110/111/112）
export const cuttingApi = {
  list: (params) => request.get('/cutting-list', { params }),
  detail: (id) => request.get('/cutting-list/' + id),
  create: (data) => request.post('/cutting-list', data),
  update: (id, data) => request.put('/cutting-list/' + id, data),
  remove: (id) => request.delete('/cutting-list/' + id),
  getConfig: () => request.get('/cutting-list/config'),
  getTags: () => request.get('/cutting-list/tags'),
  batch: (data) => request.post('/cutting-list/batch', data),
}

// 工作台看板聚合
export const dashboardApi = {
  stats: () => request.get('/dashboard'),
}

// 业务图片附件
export const attachmentApi = {
  list: (entity_type, entity_id) => request.get('/attachments', { params: { entity_type, entity_id } }),
  upload: (formData, config) => request.post('/attachments/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' }, ...config }),
  remove: (id) => request.delete('/attachments/' + id),
}

// 客户档案
export const customerApi = {
  list: (params) => request.get('/customers', { params }),
  all: () => request.get('/customers/all'),
  create: (data) => request.post('/customers', data),
  update: (id, data) => request.put('/customers/' + id, data),
  remove: (id) => request.delete('/customers/' + id),
  locations: (cid) => request.get('/customers/' + cid + '/locations'),
  addLocation: (cid, data) => request.post('/customers/' + cid + '/locations', data),
  removeLocation: (lid) => request.delete('/customers/locations/' + lid),
}

// 测量记录
export const measureApi = {
  mine: (params) => request.get('/measure', { params }),
  pending: (params) => request.get('/measure/pending', { params }),
  detail: (id) => request.get('/measure/' + id),
  create: (data) => request.post('/measure', data),
  update: (id, data) => request.put('/measure/' + id, data),
  remove: (id) => request.delete('/measure/' + id),
  convert: (id, data) => request.post('/measure/' + id + '/convert', data),
  all: (params) => request.get('/measure/all', { params }),
  batchConvert: (data) => request.post('/measure/batch-convert', data),
}

// 用户管理
export const userApi = {
  list: () => request.get('/users'),
  create: (data) => request.post('/users', data),
  update: (id, data) => request.put('/users/' + id, data),
  resetPassword: (id, new_password) => request.put('/users/' + id + '/password', { new_password }),
  remove: (id) => request.delete('/users/' + id),
}
