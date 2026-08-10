import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '../router'

const request = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

// 请求拦截：带 token
request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = 'Bearer ' + token
  return config
})

// 响应拦截：统一处理 code
request.interceptors.response.use(
  (resp) => {
    const data = resp.data
    if (data.code === 0) return data
    ElMessage.error(data.msg || '请求失败')
    return Promise.reject(data)
  },
  (err) => {
    const status = err.response?.status
    const msg = err.response?.data?.msg
    if (status === 401) {
      ElMessage.error(msg || '登录已过期')
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      router.push('/login')
    } else {
      ElMessage.error(msg || '网络错误')
    }
    return Promise.reject(err)
  }
)

export default request
