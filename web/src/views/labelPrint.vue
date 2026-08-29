<template>
  <!-- 动态注入当前标签类型的 @page 纸张尺寸（每次进页只渲染单一类型，故只需一条 @page） -->
  <component :is="'style'" v-html="pageCss" />
  <div class="label-root" :class="'lt-' + type">
    <!-- 工具栏：仅屏幕预览，打印时隐藏 -->
    <div class="print-toolbar no-print">
      <span class="ttl">{{ def.name }} · 共 {{ list.length }} 张</span>
      <div>
        <el-button @click="goBack">返回</el-button>
        <el-button type="primary" :disabled="!list.length" @click="doPrint">打印</el-button>
        <el-button type="success" :disabled="!list.length" @click="exportPdf">导出PDF</el-button>
      </div>
    </div>

    <div v-if="loading" class="state-tip no-print">加载中…</div>
    <div v-else-if="!list.length" class="state-tip no-print">未找到订单数据。</div>

    <template v-if="list.length">
      <!-- 每条订单一张标签，按类型布局；page-break-after 分页 -->
      <section v-for="row in list" :key="row.id" class="label-sheet">
        <div v-if="def.bigChar" class="big-char">{{ def.bigChar }}</div>
        <table class="label-table">
          <tbody>
            <tr v-for="f in fields" :key="f">
              <td class="lbl">{{ LABEL_FIELD_MAP[f].label }}</td>
              <td class="val">{{ LABEL_FIELD_MAP[f].get(row) }}</td>
            </tr>
          </tbody>
        </table>
        <div class="label-foot">{{ def.foot }}</div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { orderApi } from '../api'
import { LABEL_TYPES, LABEL_FIELD_MAP, print } from '../utils/printEngine'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const type = ref('door-in')
const list = ref([])
const loading = ref(true)

const def = computed(() => LABEL_TYPES[type.value] || LABEL_TYPES['door-in'])
const fields = computed(() => def.value.fields)
// 当前标签类型的 @page 纸张尺寸（mm）。@page 是 at-rule，不能挂在类选择器后；
// 每次进页只渲染单一类型，故按 type 动态注入一条全局 @page 即可。
const pageCss = computed(() => {
  const s = def.value.size
  return `@page { size: ${s.w}mm ${s.h}mm; margin: 1mm; }`
})

function goBack() {
  router.push('/orders')
}
function doPrint() {
  print() // 抽象层：当前 A=window.print，日后可切 B
}

// 导出 PDF：每张标签一页，页面尺寸=标签物理尺寸(mm)。
// 复用已渲染的 .label-sheet DOM（中文系统字体免嵌字体），html2canvas scale:2 提清晰。
// 打印 PDF 时选"实际尺寸 100%"即匹配标签纸，解决浏览器直印小尺寸自定义纸偏小的问题。
async function exportPdf() {
  if (!list.value.length) return
  const exporting = ElMessage.info('正在生成 PDF…', 0)
  try {
    const s = def.value.size
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [s.w, s.h] })
    const sheets = document.querySelectorAll('.label-sheet')
    for (let i = 0; i < sheets.length; i++) {
      const canvas = await html2canvas(sheets[i], { scale: 2, useCORS: true, backgroundColor: '#fff' })
      const img = canvas.toDataURL('image/png')
      if (i > 0) doc.addPage([s.w, s.h])
      doc.addImage(img, 'PNG', 0, 0, s.w, s.h)
    }
    const d = new Date()
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    doc.save(`labels-${type.value}-${stamp}.pdf`)
    ElMessage.success(`已导出 ${sheets.length} 张标签 PDF`)
  } finally {
    exporting.close()
  }
}

onMounted(async () => {
  type.value = route.query.type || 'door-in'
  const ids = route.query.ids
  if (!ids) {
    loading.value = false
    ElMessage.warning('未指定打印订单')
    return
  }
  try {
    // 直接走订单列表 ids 批量过滤（so.* 含标签全部字段：customer/sub_customer/lock_hole 等）
    const res = await orderApi.list({ ids, page: 1, pageSize: 9999 })
    list.value = res.data.list || []
  } finally {
    loading.value = false
  }
})
</script>

<style>
/* 标签页样式非 scoped：独立路由，类名不冲突；@page 须全局 */
.label-root { background:#f5f5f5; min-height:100vh; padding:16px; }
.print-toolbar { display:flex; justify-content:space-between; align-items:center; max-width:200mm; margin:0 auto 16px; background:#fff; padding:12px 16px; border-radius:6px; box-shadow:0 1px 4px rgba(0,0,0,.08); }
.print-toolbar .ttl { font-size:15px; font-weight:600; }
.state-tip { max-width:200mm; margin:40px auto; text-align:center; color:#909399; }

/* 标签卡片：按类型 @page 设纸张尺寸；屏幕预览时按比例缩放展示 */
/* 字号回退原 px 值（mm 撑满致内容溢出丢失，回退）；顶部大字(扇/套) 再缩 18px→16px；全表去加粗 */
.label-sheet {
  width: var(--lw); height: var(--lh);
  background:#fff; color:#000;
  box-sizing:border-box; box-shadow:0 1px 6px rgba(0,0,0,.12);
  margin:0 auto 10px; padding:2mm;
  display:flex; flex-direction:column; font-size:9px; line-height:1.3;
}

/* 大字（扇/套）：顶部居中，18px→16px 再小一号；去加粗 */
.big-char { font-size:16px; font-weight:400; text-align:center; letter-spacing:2px; border-bottom:1px solid #000; padding-bottom:1mm; margin-bottom:1mm; }

/* 字段表：label 列窄 + val 列宽，无边框靠间距区分；val 去加粗 */
.label-table { width:100%; border-collapse:collapse; flex:1; }
.label-table td { border:none; padding:0.4mm 0; vertical-align:top; }
.label-table td.lbl { width:26%; color:#555; white-space:nowrap; }
.label-table td.val { font-weight:400; word-break:break-all; }

.label-foot { margin-top:1mm; border-top:1px solid #999; padding-top:0.5mm; font-size:7px; color:#555; text-align:center; }

/* 各类型纸张尺寸（mm→屏幕用 3.78px/mm 近似预览，打印由 @page 精确控制） */
.lt-door-in  { --lw:151px; --lh:189px; }   /* 40×50 */
.lt-door-out { --lw:151px; --lh:302px; }   /* 40×80 */
.lt-frame    { --lw:151px; --lh:302px; }   /* 40×80 */
.lt-frame-in { --lw:151px; --lh:113px; }   /* 40×30 */

@media print {
  .no-print { display:none !important; }
  .label-root { background:#fff; padding:0; }
  /* 打印时卡片撑满页面：@page（上方动态注入）已定纸张尺寸+1mm 边距，每张标签独占一页 */
  .label-sheet { width:100%; height:auto; box-shadow:none; margin:0; page-break-after:always; }
  .label-sheet:last-child { page-break-after:auto; }
}
</style>
