import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus, { ElDialog } from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import './styles/global.css'

// 全局让所有 el-dialog 默认可拖动：patch 组件 props.draggable 默认值。
// 业务里仍可显式 :draggable="false" 关闭单个弹窗的拖动。
// Element-Plus 的 draggable 是 epProp（buildProp）产物，default 未显式设（运行时按 Boolean 当 false），
// 直接替换为标准 Vue prop 对象 { type: Boolean, default: true }，Vue 运行时读取此 default 生效。
ElDialog.props.draggable = { type: Boolean, default: true }

const app = createApp(App)
for (const [key, comp] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, comp)
}
app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })
app.mount('#app')
