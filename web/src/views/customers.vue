<template>
  <div class="page">
    <div class="toolbar">
      <el-input v-model="kw" placeholder="搜索客户名/电话" style="width:240px" clearable @clear="load" @keyup.enter="load" />
      <el-button type="primary" @click="openAdd">+ 新增客户</el-button>
    </div>
    <el-table :data="list" border>
      <el-table-column prop="name" label="客户名称" />
      <el-table-column prop="customer_type" label="类别" width="100" />
      <el-table-column prop="phone" label="电话" width="140" />
      <el-table-column prop="address" label="地址" />
      <el-table-column label="操作" width="240">
        <template #default="{row}">
          <el-button size="small" @click="openLoc(row)">定位</el-button>
          <el-button size="small" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="onDel(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dlg" :title="editId?'编辑客户':'新增客户'" width="500px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="类别"><el-select v-model="form.customer_type" clearable><el-option label="经销商" value="经销商" /><el-option label="直销" value="直销" /></el-select></el-form-item>
        <el-form-item label="电话"><el-input v-model="form.phone" /></el-form-item>
        <el-form-item label="地址"><el-input v-model="form.address" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dlg=false">取消</el-button><el-button type="primary" @click="onSave">保存</el-button></template>
    </el-dialog>

    <el-dialog v-model="locDlg" :title="locRow?.name + ' - 安装定位'" width="560px">
      <div style="margin-bottom:12px"><el-input v-model="newLoc" placeholder="如 3栋1单元501" style="width:300px" /><el-button type="primary" @click="addLoc" style="margin-left:8px">+ 新增</el-button></div>
      <el-table :data="locs" border>
        <el-table-column prop="name" label="定位" />
        <el-table-column prop="remark" label="备注" />
        <el-table-column label="操作" width="100"><template #default="{row}"><el-button size="small" type="danger" @click="delLoc(row)">删除</el-button></template></el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>
<script setup>
import { ref, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { customerApi } from '../api/index'
const list = ref([]), kw = ref('')
const dlg = ref(false), editId = ref(null)
const form = reactive({ name:'',customer_type:'',phone:'',address:'',remark:'' })
const locDlg = ref(false), locRow = ref(null), locs = ref([]), newLoc = ref('')
const load = async () => { const { data } = await customerApi.list({ keyword: kw.value }); list.value = data }
load()
const openAdd = () => { editId.value=null; Object.assign(form,{name:'',customer_type:'',phone:'',address:'',remark:''}); dlg.value=true }
const openEdit = (row) => { editId.value=row.id; Object.assign(form,row); dlg.value=true }
const onSave = async () => {
  if (editId.value) await customerApi.update(editId.value, form)
  else await customerApi.create(form)
  ElMessage.success('保存成功'); dlg.value=false; load()
}
const onDel = async (row) => { await ElMessageBox.confirm('确认删除该客户?'); await customerApi.remove(row.id); ElMessage.success('已删除'); load() }
const openLoc = async (row) => { locRow.value=row; locDlg.value=true; const { data } = await customerApi.locations(row.id); locs.value=data }
const addLoc = async () => { if(!newLoc.value) return; await customerApi.addLocation(locRow.value.id,{name:newLoc.value}); newLoc.value=''; const {data}=await customerApi.locations(locRow.value.id); locs.value=data }
const delLoc = async (row) => { await customerApi.removeLocation(row.id); const {data}=await customerApi.locations(locRow.value.id); locs.value=data }
</script>
<style scoped>.toolbar{margin-bottom:12px;display:flex;gap:8px}</style>
