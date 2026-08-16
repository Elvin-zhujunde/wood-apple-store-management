<template>
  <div class="page">
    <div class="toolbar"><el-button type="primary" @click="openAdd">+ 新增账号</el-button></div>
    <el-table :data="list" border>
      <el-table-column prop="username" label="账号" />
      <el-table-column prop="name" label="姓名" />
      <el-table-column prop="role" label="角色" width="120">
        <template #default="{row}"><el-tag>{{ roleLabel[row.role] }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="180" />
      <el-table-column label="操作" width="260">
        <template #default="{row}">
          <el-button size="small" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" type="warning" @click="openPwd(row)">改密码</el-button>
          <el-button size="small" type="danger" @click="onDel(row)" :disabled="row.id===store.user?.id">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dlg" :title="editId?'编辑账号':'新增账号'" width="460px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="账号"><el-input v-model="form.username" :disabled="!!editId" /></el-form-item>
        <el-form-item label="姓名"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="角色"><el-select v-model="form.role" :disabled="!!editId && editId===store.user?.id"><el-option label="老板" value="boss" /><el-option label="工人" value="worker" /></el-select></el-form-item>
        <el-form-item label="密码" v-if="!editId"><el-input v-model="form.password" type="password" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dlg=false">取消</el-button><el-button type="primary" @click="onSave">保存</el-button></template>
    </el-dialog>

    <el-dialog v-model="pwdDlg" title="重置密码" width="400px">
      <el-input v-model="newPwd" type="password" placeholder="新密码" />
      <template #footer><el-button @click="pwdDlg=false">取消</el-button><el-button type="primary" @click="onResetPwd">确定</el-button></template>
    </el-dialog>
  </div>
</template>
<script setup>
import { ref, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { userApi } from '../api/index'
import { useUserStore } from '../store/user'
import { roleLabel } from '../router/menu'
const store = useUserStore()
const list = ref([])
const dlg = ref(false), editId = ref(null)
const form = reactive({ username:'',name:'',role:'worker',password:'' })
const pwdDlg = ref(false), pwdId = ref(null), newPwd = ref('')
const load = async () => { const { data } = await userApi.list(); list.value = data }
load()
const openAdd = () => { editId.value=null; Object.assign(form,{username:'',name:'',role:'worker',password:''}); dlg.value=true }
const openEdit = (row) => { editId.value=row.id; Object.assign(form,{username:row.username,name:row.name,role:row.role,password:''}); dlg.value=true }
const onSave = async () => {
  if (editId.value) await userApi.update(editId.value, { name: form.name, role: form.role })
  else await userApi.create(form)
  ElMessage.success('保存成功'); dlg.value=false; load()
}
const openPwd = (row) => { pwdId.value=row.id; newPwd.value=''; pwdDlg.value=true }
const onResetPwd = async () => { await userApi.resetPassword(pwdId.value, newPwd.value); ElMessage.success('密码已重置'); pwdDlg.value=false }
const onDel = async (row) => { await ElMessageBox.confirm('确认删除该账号?'); await userApi.remove(row.id); ElMessage.success('已删除'); load() }
</script>
<style scoped>.toolbar{margin-bottom:12px}</style>
