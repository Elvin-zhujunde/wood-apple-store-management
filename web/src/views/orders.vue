<template>
  <el-card shadow="never">
    <div class="toolbar">
      <el-input v-model="query.order_no" placeholder="订单号" clearable style="width:150px" @change="load" />
      <el-input v-model="query.customer" placeholder="客户名称" clearable style="width:160px" @change="load" />
      <el-select v-model="query.door_bom_id" placeholder="门型" clearable style="width:140px" @change="load">
        <el-option v-for="b in bomList" :key="b.id" :label="`${b.code} ${b.name}`" :value="b.id" />
      </el-select>
      <el-input v-model="query.handler_sale" placeholder="经手人" clearable style="width:110px" @change="load" />
      <el-select v-model="query.status" placeholder="状态" clearable style="width:110px" @change="load">
        <el-option label="新建" value="新建" />
        <el-option label="已发货" value="已发货" />
        <el-option label="赊账中" value="赊账中" />
        <el-option label="已收款" value="已收款" />
      </el-select>
      <el-select v-model="query.cut_status" placeholder="下料状态" clearable style="width:120px" @change="load">
        <el-option label="未下料" value="未下料" />
        <el-option label="已下料" value="已下料" />
      </el-select>
      <el-date-picker v-model="query.dateRange" type="daterange" range-separator="至" start-placeholder="下单开始" end-placeholder="下单结束" value-format="YYYY-MM-DD" style="width:240px" @change="load" />
      <el-button type="primary" @click="load">查询</el-button>
      <el-button @click="resetQuery">重置</el-button>
      <el-button type="success" @click="openAdd">+ 接单</el-button>
      <el-button type="warning" :disabled="batchShipableCount === 0" @click="openBatchShip">批量发货 ({{ batchShipableCount }})</el-button>
      <el-button type="warning" :disabled="batchPayableCount === 0" @click="openBatchPay">批量收款 ({{ batchPayableCount }})</el-button>
      <el-button type="primary" :disabled="selectedRows.length === 0" @click="openBatchEdit">批量编辑 ({{ selectedRows.length }})</el-button>
      <el-button type="warning" :disabled="selectedRows.length === 0" @click="openBatchPrint">打印下料单 ({{ selectedRows.length }})</el-button>
      <el-button type="success" :disabled="selectedRows.length === 0" @click="openBatchLabel">标签打印 ({{ selectedRows.length }})</el-button>
      <el-button type="primary" :disabled="batchCuttableCount === 0" @click="openBatchCut">批量下料 ({{ batchCuttableCount }})</el-button>
      <el-button type="info" :disabled="selectedRows.length < 2" @click="openBatchReq">批量领料 ({{ selectedRows.length }})</el-button>
      <el-button type="warning" @click="openConvert">测量转单</el-button>
      <ColumnSettings :columns="allColumns" storage-key="orders-cols" @change="(v) => (visibleCols = v)" />
    </div>
    <el-table ref="tableRef" :data="list" stripe border :height="tableHeight" @selection-change="onSelectionChange" @row-click="onRowClick" @select="onSelect">
      <el-table-column type="selection" width="42" />
      <el-table-column v-if="colVisible('order_no')" prop="order_no" label="订单号" width="160" />
      <el-table-column v-if="colVisible('customer')" prop="customer" label="客户" min-width="120" />
      <el-table-column v-if="colVisible('size')" label="尺寸(高×宽)" width="150">
        <template #default="{ row }">
          <span v-if="row.door_h || row.door_w">{{ row.door_h || '-' }}×{{ row.door_w || '-' }}</span>
          <span v-else class="muted">-</span>
        </template>
      </el-table-column>
      <el-table-column v-if="colVisible('wall_thick')" prop="wall_thick" label="墙厚" width="90" align="center">
        <template #default="{ row }">{{ row.wall_thick != null ? row.wall_thick : '-' }}</template>
      </el-table-column>
      <el-table-column v-if="colVisible('cut_door')" label="门扇(高×宽)" width="150">
        <template #default="{ row }">
          <span v-if="row.cut_door_height || row.cut_door_width" style="color:#f56c6c;font-weight:600">{{ row.cut_door_height }}×{{ row.cut_door_width }}</span>
          <span v-else class="muted">未下料</span>
        </template>
      </el-table-column>
      <el-table-column v-if="colVisible('cut_status')" label="下料状态" width="90">
        <template #default="{ row }">
          <el-tag v-if="row.cut_status" :type="cutStatusType(row.cut_status)" size="small">{{ row.cut_status }}</el-tag>
          <span v-else class="muted">未下料</span>
        </template>
      </el-table-column>
      <el-table-column v-if="colVisible('cut_date')" prop="cut_date" label="下料日" width="110" :formatter="dateFmt" />
      <el-table-column v-if="colVisible('cut_remark_tags')" label="加工备注" min-width="120">
        <template #default="{ row }">
          <span v-if="parseTags(row.cut_remark_tags).length" class="tag-row">
            <el-tag v-for="(t, i) in parseTags(row.cut_remark_tags)" :key="i" size="small" :type="tagType(t)" class="tag-item">{{ t }}</el-tag>
          </span>
          <span v-else class="muted">-</span>
        </template>
      </el-table-column>
      <el-table-column v-if="colVisible('sub_customer')" prop="sub_customer" label="子客户" min-width="140">
        <template #default="{ row }">{{ row.sub_customer || '-' }}</template>
      </el-table-column>
      <el-table-column v-if="colVisible('lock_hole')" prop="lock_hole" label="锁孔" width="100" align="center">
        <template #default="{ row }">{{ row.lock_hole || '-' }}</template>
      </el-table-column>
      <el-table-column v-if="colVisible('door_bom_name')" prop="door_bom_name" label="门型" width="120" />
      <el-table-column v-if="colVisible('color')" prop="color" label="颜色" width="80" />
      <el-table-column v-if="colVisible('style')" prop="style" label="款式" width="100">
        <template #default="{ row }">{{ row.style || '-' }}</template>
      </el-table-column>
      <el-table-column v-if="colVisible('board')" prop="board" label="门扇板材" width="90" align="center">
        <template #default="{ row }">{{ row.board || '-' }}</template>
      </el-table-column>
      <el-table-column v-if="colVisible('total_amount')" label="应收" width="90" align="right" prop="total_amount" />
      <el-table-column v-if="colVisible('paid_amount')" label="已收" width="90" align="right">
        <template #default="{ row }">{{ row.paid_amount != null ? row.paid_amount : '-' }}</template>
      </el-table-column>
      <el-table-column v-if="colVisible('balance')" label="欠款" width="90" align="right">
        <template #default="{ row }">
          <span v-if="balanceOf(row) > 0" style="color:#f56c6c;font-weight:600">{{ balanceOf(row) }}</span>
          <span v-else-if="row.paid_amount != null" style="color:#67c23a">0</span>
          <span v-else class="muted">-</span>
        </template>
      </el-table-column>
      <el-table-column v-if="colVisible('customer_type')" prop="customer_type" label="客户类别" width="90" align="center">
        <template #default="{ row }">{{ row.customer_type || '-' }}</template>
      </el-table-column>
      <el-table-column v-if="colVisible('pay_method')" prop="pay_method" label="付款方式" width="90" align="center">
        <template #default="{ row }">{{ row.pay_method || '-' }}</template>
      </el-table-column>
      <el-table-column v-if="colVisible('handler_sale')" prop="handler_sale" label="经手人" width="80" />
      <el-table-column v-if="colVisible('salesperson')" prop="salesperson" label="业务员" width="80">
        <template #default="{ row }">{{ row.salesperson || '-' }}</template>
      </el-table-column>
      <el-table-column v-if="colVisible('installer')" prop="installer" label="安装师傅" width="90">
        <template #default="{ row }">{{ row.installer || '-' }}</template>
      </el-table-column>
      <el-table-column v-if="colVisible('order_date')" prop="order_date" label="下单日" width="120" :formatter="dateFmt" />
      <el-table-column v-if="colVisible('actual_ship_date')" prop="actual_ship_date" label="发货日" width="120" :formatter="dateFmt" />
      <el-table-column v-if="colVisible('ship_no')" prop="ship_no" label="发货单号" width="130">
        <template #default="{ row }">{{ row.ship_no || '-' }}</template>
      </el-table-column>
      <el-table-column v-if="colVisible('pay_date')" prop="pay_date" label="收款日" width="120" :formatter="dateFmt" />
      <el-table-column v-if="colVisible('receipt_no')" prop="receipt_no" label="收据号" width="120">
        <template #default="{ row }">{{ row.receipt_no || '-' }}</template>
      </el-table-column>
      <el-table-column v-if="colVisible('remark')" prop="remark" label="订单备注" min-width="140">
        <template #default="{ row }">
          <span v-if="row.remark">{{ row.remark }}</span>
          <span v-else class="muted">-</span>
        </template>
      </el-table-column>
      <el-table-column v-if="colVisible('status')" label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column v-if="colVisible('aging')" label="账龄" width="80" align="center">
        <template #default="{ row }">
          <span v-if="agingOf(row) != null" :style="agingStyle(agingOf(row))">{{ agingOf(row) }}天</span>
          <span v-else class="muted">-</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="290" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status === '新建'" link type="primary" class="row-btn" @click="openShip(row)">发货</el-button>
          <el-button v-if="row.status === '已发货' || row.status === '赊账中'" link type="success" class="row-btn" @click="openPay(row)">{{ row.status === '赊账中' ? '收尾款' : '收款' }}</el-button>
          <el-button v-if="row.status === '已收款'" link disabled class="row-btn">已完成</el-button>
          <el-button link type="primary" @click="openEdit(row)">详情</el-button>
          <el-button v-if="!row.cut_status" link type="warning" class="row-btn" @click="openCutting(row)">下料</el-button>
          <template v-else>
            <el-button link type="warning" class="row-btn" @click="printSingle(row)">打印</el-button>
            <el-button link type="primary" class="row-btn" @click="openCuttingEdit(row)">编辑</el-button>
            <el-button link type="success" class="row-btn" @click="openLabel(row)">标签</el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-model:current-page="query.page"
      v-model:page-size="query.pageSize"
      :total="total"
      :page-sizes="[20, 50, 100, 200]"
      layout="total, sizes, prev, pager, next, jumper"
      style="margin-top:12px"
      @current-change="load"
      @size-change="onSizeChange"
    />

    <!-- 行内发货小弹窗 -->
    <el-dialog v-model="shipVisible" title="发货回填" width="420px" :close-on-click-modal="false">
      <el-alert type="info" :closable="false" style="margin-bottom:12px">
        订单 <strong>{{ shipRow?.order_no }}</strong> · {{ shipRow?.customer }}
      </el-alert>
      <el-form :model="shipForm" label-width="100px">
        <el-form-item label="实际发货日" required>
          <el-date-picker v-model="shipForm.actual_ship_date" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
        <el-form-item label="发货单号" required>
          <el-input v-model="shipForm.ship_no" placeholder="物流运单号" />
        </el-form-item>
        <el-form-item label="发货经手人">
          <el-input v-model="shipForm.handler_ship" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="shipVisible = false">取消</el-button>
        <el-button type="primary" @click="onShip">确认发货</el-button>
      </template>
    </el-dialog>

    <!-- 行内收款小弹窗 -->
    <el-dialog v-model="payVisible" title="收款回填" width="420px" :close-on-click-modal="false">
      <el-alert type="info" :closable="false" style="margin-bottom:12px">
        订单 <strong>{{ payRow?.order_no }}</strong> · {{ payRow?.customer }}
      </el-alert>
      <el-form :model="payForm" label-width="100px">
        <el-form-item label="应收金额">
          <el-input :model-value="payRow?.total_amount" disabled />
        </el-form-item>
        <el-form-item v-if="payRow?.paid_amount != null" label="已付金额">
          <el-input :model-value="payRow?.paid_amount" disabled />
          <div class="muted">本次填累计已付额；填到应收=结清，少于应收=继续赊账</div>
        </el-form-item>
        <el-form-item label="更新已付" required>
          <el-input-number v-model="payForm.paid_amount" :min="0" :precision="2" controls-position="right" style="width:100%" />
          <div class="muted">默认填应收额=全额结清；填少于应收=赊账，欠款={{ payBalance }}</div>
        </el-form-item>
        <el-form-item label="付款方式">
          <el-select v-model="payForm.pay_method" clearable style="width:100%">
            <el-option label="扫码" value="扫码" /><el-option label="现金" value="现金" /><el-option label="转账" value="转账" /><el-option label="赊账" value="赊账" />
          </el-select>
        </el-form-item>
        <el-form-item label="收款日期" required>
          <el-date-picker v-model="payForm.pay_date" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
        <el-form-item label="收据单号">
          <el-input v-model="payForm.receipt_no" />
        </el-form-item>
        <el-form-item label="收款经手人">
          <el-input v-model="payForm.handler_finance" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="payVisible = false">取消</el-button>
        <el-button type="primary" @click="onPay">确认收款</el-button>
      </template>
    </el-dialog>

    <!-- 批量发货弹窗 -->
    <el-dialog v-model="batchShipVisible" title="批量发货" width="440px" :close-on-click-modal="false">
      <el-alert type="info" :closable="false" style="margin-bottom:12px">
        共选中 <strong>{{ selectedRows.length }}</strong> 单，其中 <strong>{{ batchShipableCount }}</strong> 单为"新建"可发货
        <div v-if="batchShipableCount < selectedRows.length" style="color:#e6a23c;margin-top:4px">非"新建"订单将自动跳过</div>
      </el-alert>
      <el-form :model="batchShipForm" label-width="100px">
        <el-form-item label="实际发货日" required>
          <el-date-picker v-model="batchShipForm.actual_ship_date" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
        <el-form-item label="发货单号" required>
          <el-input v-model="batchShipForm.ship_no" placeholder="同一批次共用一个发货单号" />
        </el-form-item>
        <el-form-item label="发货经手人">
          <el-input v-model="batchShipForm.handler_ship" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchShipVisible = false">取消</el-button>
        <el-button type="primary" :disabled="batchShipableCount === 0" @click="onBatchShip">确认批量发货</el-button>
      </template>
    </el-dialog>

    <!-- 批量收款弹窗 -->
    <el-dialog v-model="batchPayVisible" title="批量收款" width="440px" :close-on-click-modal="false">
      <el-alert type="info" :closable="false" style="margin-bottom:12px">
        共选中 <strong>{{ selectedRows.length }}</strong> 单，其中 <strong>{{ batchPayableCount }}</strong> 单可收款
        <div v-if="batchPayableCount < selectedRows.length" style="color:#e6a23c;margin-top:4px">已收款订单将自动跳过</div>
      </el-alert>
      <el-form :model="batchPayForm" label-width="100px">
        <el-form-item label="收款日期" required>
          <el-date-picker v-model="batchPayForm.pay_date" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
        <el-form-item label="收据单号" required>
          <el-input v-model="batchPayForm.receipt_no" placeholder="同一批次共用一个收据单号" />
        </el-form-item>
        <el-form-item label="付款方式">
          <el-select v-model="batchPayForm.pay_method" clearable style="width:100%">
            <el-option label="扫码" value="扫码" /><el-option label="现金" value="现金" /><el-option label="转账" value="转账" /><el-option label="赊账" value="赊账" />
          </el-select>
          <div class="muted">批量默认全额结清；部分付款/赊账请逐单操作</div>
        </el-form-item>
        <el-form-item label="收款经手人">
          <el-input v-model="batchPayForm.handler_finance" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchPayVisible = false">取消</el-button>
        <el-button type="primary" :disabled="batchPayableCount === 0" @click="onBatchPay">确认批量收款</el-button>
      </template>
    </el-dialog>

    <!-- 批量编辑弹窗（勾选式：勾哪项改哪项，未勾保持原值） -->
    <el-dialog v-model="batchEditVisible" title="批量编辑" width="560px" :close-on-click-modal="false">
      <el-alert type="info" :closable="false" style="margin-bottom:12px">
        已选 <strong>{{ selectedRows.length }}</strong> 单。勾选要改的项并填新值，未勾选的保持原值。
        <div class="muted" style="margin-top:4px">提示：先按客户/状态等条件筛选，再用表头全选或 shift+点击区间选择，可快速圈选一批单。</div>
      </el-alert>
      <el-form :model="batchEditForm" label-width="110px">
        <el-form-item label="改状态">
          <el-checkbox v-model="batchEditForm.enableStatus" style="margin-right:12px" />
          <el-select v-model="batchEditForm.status" :disabled="!batchEditForm.enableStatus" style="width:160px" placeholder="选择状态">
            <el-option label="新建" value="新建" />
            <el-option label="已发货" value="已发货" />
            <el-option label="赊账中" value="赊账中" />
          </el-select>
          <div class="muted">仅前向流转（新建→已发货→赊账中）；已收款锁，回退跳过；改"已收款"请用批量收款</div>
        </el-form-item>
        <el-form-item label="改经手人(销售)">
          <el-checkbox v-model="batchEditForm.enableHandlerSale" style="margin-right:12px" />
          <el-input v-model="batchEditForm.handler_sale" :disabled="!batchEditForm.enableHandlerSale" placeholder="销售经手人" style="width:220px" />
        </el-form-item>
        <el-form-item label="改业务员">
          <el-checkbox v-model="batchEditForm.enableSalesperson" style="margin-right:12px" />
          <el-input v-model="batchEditForm.salesperson" :disabled="!batchEditForm.enableSalesperson" placeholder="业务员" style="width:220px" />
        </el-form-item>
        <el-form-item label="改安装师傅">
          <el-checkbox v-model="batchEditForm.enableInstaller" style="margin-right:12px" />
          <el-input v-model="batchEditForm.installer" :disabled="!batchEditForm.enableInstaller" placeholder="安装师傅" style="width:220px" />
        </el-form-item>
        <el-form-item label="改客户类别">
          <el-checkbox v-model="batchEditForm.enableCustomerType" style="margin-right:12px" />
          <el-select v-model="batchEditForm.customer_type" :disabled="!batchEditForm.enableCustomerType" clearable style="width:220px">
            <el-option label="经销商" value="经销商" /><el-option label="直销" value="直销" />
          </el-select>
        </el-form-item>
        <el-form-item label="改付款方式">
          <el-checkbox v-model="batchEditForm.enablePayMethod" style="margin-right:12px" />
          <el-select v-model="batchEditForm.pay_method" :disabled="!batchEditForm.enablePayMethod" clearable style="width:220px">
            <el-option label="扫码" value="扫码" /><el-option label="现金" value="现金" /><el-option label="转账" value="转账" /><el-option label="赊账" value="赊账" />
          </el-select>
        </el-form-item>
        <el-form-item label="改发货经手人">
          <el-checkbox v-model="batchEditForm.enableHandlerShip" style="margin-right:12px" />
          <el-input v-model="batchEditForm.handler_ship" :disabled="!batchEditForm.enableHandlerShip" placeholder="发货经手人" style="width:220px" />
        </el-form-item>
        <el-form-item label="改收款经手人">
          <el-checkbox v-model="batchEditForm.enableHandlerFinance" style="margin-right:12px" />
          <el-input v-model="batchEditForm.handler_finance" :disabled="!batchEditForm.enableHandlerFinance" placeholder="收款经手人" style="width:220px" />
        </el-form-item>
        <el-form-item label="改备注">
          <el-checkbox v-model="batchEditForm.enableRemark" style="margin-right:12px" />
          <el-input v-model="batchEditForm.remark" :disabled="!batchEditForm.enableRemark" type="textarea" :rows="2" placeholder="覆盖所选订单备注（留空=清空）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchEditVisible = false">取消</el-button>
        <el-button type="primary" @click="onBatchUpdate">确认批量编辑</el-button>
      </template>
    </el-dialog>

    <!-- 生成下料单弹窗（门扇高宽给默认值=门洞−扣尺，可改） -->
    <el-dialog v-model="cuttingVisible" title="生成下料单" width="620px" :close-on-click-modal="false">
      <el-alert type="info" :closable="false" style="margin-bottom:16px">
        订单 <strong>{{ cutRow?.order_no }}</strong> · {{ cutRow?.customer }} · 门洞 {{ cutRow?.door_h }}×{{ cutRow?.door_w }}
        <span v-if="cutRow?.wall_thick"> · 墙厚 {{ cutRow?.wall_thick }}</span>
        <span class="muted"> · 默认扣尺 高-{{ cutConfig.defaultHeightCut }} 宽-{{ cutConfig.defaultWidthCut }}</span>
      </el-alert>
      <el-form :model="cutForm" label-width="90px" label-position="right">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="门扇高" required>
              <el-input-number v-model="cutForm.door_height" :min="0" :precision="2" controls-position="right" style="width:100%" />
              <div class="muted">= 门洞高 {{ cutRow?.door_h }} − {{ cutConfig.defaultHeightCut }}（默认值，可改）</div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="门扇宽" required>
              <el-input-number v-model="cutForm.door_width" :min="0" :precision="2" controls-position="right" style="width:100%" />
              <div class="muted">= 门洞宽 {{ cutRow?.door_w }} − {{ cutConfig.defaultWidthCut }}</div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="经手人">
              <el-input v-model="cutForm.handler" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="下料日期" required>
              <el-date-picker v-model="cutForm.cut_date" type="date" value-format="YYYY-MM-DD" style="width:100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="加工备注">
          <TagInput v-model="cutForm.tags" :suggestions="cutTagOptions" placeholder="输入标签，回车添加" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cuttingVisible = false">取消</el-button>
        <el-button type="primary" @click="onCutting">确认生成</el-button>
      </template>
    </el-dialog>

    <!-- 编辑下料单弹窗：改门扇尺寸/下料日期/经手人/加工备注，含删除下料 -->
    <el-dialog v-model="cutEditVisible" title="编辑下料单" width="640px" :close-on-click-modal="false">
      <el-alert type="info" :closable="false" style="margin-bottom:16px">
        订单 <strong>{{ cutEditRow?.order_no }}</strong> · {{ cutEditRow?.customer }}
        <span v-if="cutEditRow?.style"> · 款式 {{ cutEditRow?.style }}</span>
        <span v-if="cutEditRow?.board"> · 板材 {{ cutEditRow?.board }}</span>
      </el-alert>
      <el-form :model="cutEditForm" label-width="90px" label-position="right">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="门洞高"><el-input :model-value="cutEditRow?.door_h" disabled /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="门洞宽"><el-input :model-value="cutEditRow?.door_w" disabled /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="门扇高" required>
              <el-input-number v-model="cutEditForm.door_height" :min="0" :precision="2" controls-position="right" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="门扇宽" required>
              <el-input-number v-model="cutEditForm.door_width" :min="0" :precision="2" controls-position="right" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="墙厚"><el-input :model-value="cutEditRow?.wall_thick" disabled /></el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="经手人"><el-input v-model="cutEditForm.handler" /></el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="下料日期" required>
              <el-date-picker v-model="cutEditForm.cut_date" type="date" value-format="YYYY-MM-DD" style="width:100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="加工备注">
          <TagInput v-model="cutEditForm.tags" :suggestions="cutTagOptions" placeholder="输入标签，回车添加" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="danger" plain @click="onCuttingDelete(cutEditRow)">删除下料</el-button>
        <el-button @click="cutEditVisible = false">取消</el-button>
        <el-button type="primary" @click="onCuttingEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 批量下料弹窗：按门洞高×宽分组，同组共用门扇尺寸 -->
    <el-dialog v-model="batchCutVisible" title="批量下料" width="760px" :close-on-click-modal="false">
      <el-alert type="info" :closable="false" style="margin-bottom:12px">
        选中 <strong>{{ selectedRows.length }}</strong> 单，其中 <strong>{{ batchCuttableCount }}</strong> 单未下料可批量生成。
        <div class="muted" style="margin-top:4px">按门洞高×宽分组，同组共用门扇尺寸（门洞−扣尺默认，可改）；已下料单自动跳过。</div>
      </el-alert>
      <el-form :model="batchCutForm" label-width="90px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="下料日期" required>
              <el-date-picker v-model="batchCutForm.cut_date" type="date" value-format="YYYY-MM-DD" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="经手人">
              <el-input v-model="batchCutForm.handler" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="加工备注">
          <TagInput v-model="batchCutForm.tags" :suggestions="cutTagOptions" placeholder="输入标签，回车添加" />
        </el-form-item>
      </el-form>
      <div class="batch-cut-groups">
        <div v-for="g in batchCutGroups" :key="g.key" class="batch-cut-group">
          <div class="group-head">
            <span class="group-size">门洞 {{ g.hole }}（{{ g.items.length }} 单）</span>
            <span class="muted">门扇高×宽：</span>
            <el-input-number v-model="g.door_height" :min="0" :precision="2" controls-position="right" style="width:120px" size="small" />
            <span style="margin:0 4px">×</span>
            <el-input-number v-model="g.door_width" :min="0" :precision="2" controls-position="right" style="width:120px" size="small" />
          </div>
          <div class="group-orders">
            <el-tag v-for="(it, i) in g.items" :key="i" size="small" style="margin:2px">{{ it.order_no }} · {{ it.customer }}</el-tag>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="batchCutVisible = false">取消</el-button>
        <el-button type="primary" :disabled="batchCuttableCount === 0" @click="onBatchCut">确认批量下料</el-button>
      </template>
    </el-dialog>

    <!-- 批量领料弹窗：一个物料总量分给多笔订单，快捷输入1+3+5+7 -->
    <el-dialog v-model="batchReqVisible" title="批量领料" width="860px" :close-on-click-modal="false">
      <el-form :model="batchReqForm" label-width="90px" inline>
        <el-form-item label="物料" required>
          <el-select v-model="batchReqForm.material_id" filterable placeholder="选物料(可搜索)" style="width:260px">
            <el-option v-for="m in materialList" :key="m.id" :label="`${m.code} ${m.name}（库存${m.stock_qty}${m.unit}）`" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="总领料量" required>
          <el-input-number v-model="batchReqForm.total_qty" :min="0" :precision="3" controls-position="right" style="width:150px" placeholder="总量" />
        </el-form-item>
        <el-form-item label="领料日期" required>
          <el-date-picker v-model="batchReqForm.req_date" type="date" value-format="YYYY-MM-DD" style="width:150px" />
        </el-form-item>
        <el-form-item label="经手人" required>
          <el-input v-model="batchReqForm.handler" style="width:120px" />
        </el-form-item>
      </el-form>
      <div v-if="selectedMaterial" class="batch-req-stock">
        <span class="stock-cur">当前库存：<b>{{ selectedMaterial.stock_qty }}</b> {{ selectedMaterial.unit }}</span>
        <span class="stock-sep">|</span>
        <span class="stock-after">
          领料后剩：<b :class="afterReqStock < 0 ? 'danger' : 'ok'">{{ afterReqStock }}</b> {{ selectedMaterial.unit }}
          <span v-if="afterReqStock < 0" class="danger">（不够，差 {{ -afterReqStock }}）</span>
          <span v-else-if="afterReqStock === 0" class="warn">（刚好用完）</span>
        </span>
      </div>
      <div class="batch-req-bar">
        <div class="batch-req-actions">
          <el-button size="small" type="primary" plain @click="avgFill">① 平均预填</el-button>
          <el-button size="small" type="primary" plain @click="autoFillRemain">⑦ 自动分配余量</el-button>
          <span class="batch-req-hint muted">③ 同上按钮逐行复制 · 键盘 Tab/↑↓/Enter 切行</span>
        </div>
        <div class="batch-req-sum">
          已填 <b>{{ filledSum }}</b> / 总量 <b>{{ batchReqForm.total_qty || 0 }}</b>
          <span v-if="remainQty > 0" class="warn">（剩 {{ remainQty }}）</span>
          <span v-else-if="remainQty < 0" class="danger">（超 {{ -remainQty }}）</span>
          <span v-else-if="batchReqForm.total_qty" class="ok">（已齐）</span>
        </div>
      </div>
      <el-table :data="batchReqItems" border size="small" max-height="340">
        <el-table-column prop="order_no" label="订单号" width="150" />
        <el-table-column prop="customer" label="客户" min-width="100" />
        <el-table-column prop="door_bom_name" label="门型" width="100" />
        <el-table-column prop="size" label="尺寸" width="110" />
        <el-table-column label="领料数量" width="150">
          <template #default="{ row, $index }">
            <el-input
              :ref="(el) => (qtyInputs[$index] = el)"
              v-model="row.qty"
              placeholder="0"
              @keydown.enter.prevent="onQtyEnter($index)"
              @keydown="onQtyKeydown($event, $index)"
              style="width:120px"
            />
          </template>
        </el-table-column>
        <el-table-column label="同上" width="70" align="center">
          <template #default="{ $index }">
            <el-button link size="small" :disabled="$index === 0" @click="copyPrev($index)" title="复制上一行数量">⎘</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="batchReqVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!canSubmitBatchReq" @click="onBatchReq">确认领料</el-button>
      </template>
    </el-dialog>

    <!-- 标签打印选择弹窗：4 种标签类型 -->
    <el-dialog v-model="labelVisible" title="标签打印" width="520px" :close-on-click-modal="false">
      <el-alert type="info" :closable="false" style="margin-bottom:12px">
        订单 <strong>{{ labelRow?.order_no }}</strong> · {{ labelRow?.customer }}
        <span v-if="labelRow?.sub_customer"> · {{ labelRow.sub_customer }}</span>
        <div class="muted" style="margin-top:4px">选标签类型后跳打印页；标签内容取订单字段（锁孔/子客户请在订单详情维护）。</div>
      </el-alert>
      <el-radio-group v-model="labelType" class="label-radio-group">
        <el-radio-button label="door-in">门扇内标签<br /><span class="muted">40×50mm</span></el-radio-button>
        <el-radio-button label="door-out">门扇外标签<br /><span class="muted">40×80mm</span></el-radio-button>
        <el-radio-button label="frame">门套标签<br /><span class="muted">40×80mm</span></el-radio-button>
        <el-radio-button label="frame-in">门套内标签<br /><span class="muted">40×30mm</span></el-radio-button>
      </el-radio-group>
      <template #footer>
        <el-button @click="labelVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!labelType" @click="labelRow ? printLabel() : printBatchLabel()">打印</el-button>
      </template>
    </el-dialog>

    <!-- 新增/编辑对话框（保留原完整表单） -->
    <el-dialog v-model="dlgVisible" :title="dlgTitle" width="960px" :close-on-click-modal="false">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="订单信息" name="info">
          <el-form :model="form" label-width="110px" size="default">
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="客户/项目" required>
                  <el-input v-model="form.customer" :disabled="isEdit" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="门型" required>
                  <el-select v-model="form.door_bom_id" :disabled="isEdit" @change="onBomChange" style="width:100%">
                    <el-option v-for="b in bomList" :key="b.id" :label="`${b.code} ${b.name}`" :value="b.id" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="颜色" required>
                  <el-select v-model="form.color" style="width:100%">
                    <el-option v-for="c in colorOptions" :key="c" :label="c" :value="c" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="规格" >
                  <el-input :model-value="bomSpec" disabled placeholder="由门型带出" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="门洞高"><el-input-number v-model="form.door_h" :min="0" :precision="2" controls-position="right" style="width:100%" placeholder="mm" /></el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="门洞宽"><el-input-number v-model="form.door_w" :min="0" :precision="2" controls-position="right" style="width:100%" placeholder="mm" /></el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="墙厚"><el-input-number v-model="form.wall_thick" :min="0" :precision="2" controls-position="right" style="width:100%" placeholder="mm" /></el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="款式"><el-input v-model="form.style" placeholder="如 1016 / XF-2471" /></el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="门扇板材"><el-input v-model="form.board" placeholder="如 3号 / 5号" /></el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="销售单价" required><el-input-number v-model="form.unit_price" :min="0" :precision="2" style="width:100%" /></el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="经手人(销售)" required><el-input v-model="form.handler_sale" /></el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="下单日期" required><el-date-picker v-model="form.order_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" placeholder="加急/颜色定制/包安装/客户交代等" /></el-form-item>
              </el-col>
              <!-- 可选信息（默认收起，降低录入负担） -->
              <el-col :span="24">
                <el-collapse>
                  <el-collapse-item title="可选信息（客户类别/地址/包边/套板线条/五金/业务员/锁孔/子客户）" name="opt">
                    <el-row :gutter="12">
                      <el-col :span="12"><el-form-item label="客户类别"><el-select v-model="form.customer_type" clearable style="width:100%"><el-option label="经销商" value="经销商" /><el-option label="直销" value="直销" /></el-select></el-form-item></el-col>
                      <el-col :span="12"><el-form-item label="地址"><el-input v-model="form.address" /></el-form-item></el-col>
                      <el-col :span="12"><el-form-item label="包边(mm)"><el-input-number v-model="form.edge_band" :min="0" :precision="2" controls-position="right" style="width:100%" /></el-form-item></el-col>
                      <el-col :span="12"><el-form-item label="套板线条"><el-input v-model="form.frame_line" /></el-form-item></el-col>
                      <el-col :span="12"><el-form-item label="五金"><el-input v-model="form.hardware" /></el-form-item></el-col>
                      <el-col :span="12"><el-form-item label="业务员"><el-input v-model="form.salesperson" /></el-form-item></el-col>
                      <el-col :span="12">
                        <el-form-item label="锁孔">
                          <el-select v-model="form.lock_hole" allow-create filterable clearable default-first-option style="width:100%" placeholder="如 58锁子孔">
                            <el-option v-for="h in lockHoleOptions" :key="h" :label="h" :value="h" />
                          </el-select>
                        </el-form-item>
                      </el-col>
                      <el-col :span="12"><el-form-item label="子客户"><el-input v-model="form.sub_customer" placeholder="如 碧桂园X栋X层X房（安装定位）" /></el-form-item></el-col>
                    </el-row>
                  </el-collapse-item>
                </el-collapse>
              </el-col>
            </el-row>
          </el-form>
        </el-tab-pane>

        <el-tab-pane v-if="isEdit" label="发货回填" name="ship">
          <el-form :model="form" label-width="110px">
            <el-form-item label="实际发货日"><el-date-picker v-model="form.actual_ship_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
            <el-form-item label="发货单号"><el-input v-model="form.ship_no" placeholder="物流运单号" /></el-form-item>
            <el-form-item label="发货经手人"><el-input v-model="form.handler_ship" /></el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane v-if="isEdit" label="收款回填" name="pay">
          <el-form :model="form" label-width="110px">
            <el-alert v-if="payLocked" type="warning" :closable="false" style="margin-bottom:12px">
              该订单已完成（已收款），收款信息已锁定，普通编辑不可改动。如需修正多收/误标，请<span style="color:#f56c6c;font-weight:600">反结订单</span>回到赊账中再核对。
            </el-alert>
            <el-form-item label="应收款">
              <el-input :model-value="form.total_amount" disabled />
              <div class="muted">订单总金额（自动）</div>
            </el-form-item>
            <el-form-item label="已付金额">
              <el-input-number v-model="form.paid_amount" :min="0" :precision="2" :disabled="payLocked" controls-position="right" style="width:100%" placeholder="默认填应收额=全额结清，填少于应收=赊账欠款" />
            </el-form-item>
            <el-form-item label="欠款">
              <el-input :model-value="balanceDue" disabled :class="{ 'balance-over': balanceDue > 0 }" />
              <div class="muted">= 应收 − 已付，欠款&gt;0 为未结清</div>
            </el-form-item>
            <el-form-item label="付款方式">
              <el-select v-model="form.pay_method" :disabled="payLocked" clearable style="width:100%">
                <el-option label="扫码" value="扫码" /><el-option label="现金" value="现金" /><el-option label="转账" value="转账" /><el-option label="赊账" value="赊账" />
              </el-select>
            </el-form-item>
            <el-form-item label="收款日期"><el-date-picker v-model="form.pay_date" :disabled="payLocked" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
            <el-form-item label="收据单号"><el-input v-model="form.receipt_no" :disabled="payLocked" /></el-form-item>
            <el-form-item label="收款经手人"><el-input v-model="form.handler_finance" :disabled="payLocked" /></el-form-item>
            <el-form-item v-if="payLocked">
              <el-button type="danger" plain @click="onReopen">反结订单（回赊账中）</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane v-if="isEdit" label="领料·成本" name="req">
          <el-alert v-if="reqList.length === 0" type="info" :closable="false" style="margin-bottom:12px">该订单暂无关联领料记录，材料成本为 0</el-alert>
          <template v-else>
            <el-table :data="reqList" border size="small">
              <el-table-column prop="code" label="编码" width="100" />
              <el-table-column prop="material_name" label="物料" min-width="140" />
              <el-table-column prop="spec" label="规格" min-width="120" />
              <el-table-column prop="unit" label="单位" width="70" />
              <el-table-column prop="qty" label="领用数量" width="100" align="right" />
              <el-table-column prop="unit_price" label="单价" width="90" align="right" />
              <el-table-column label="小计" width="100" align="right">
                <template #default="{ row }">{{ reqLineTotal(row) }}</template>
              </el-table-column>
              <el-table-column prop="req_date" label="领料日" width="110" />
              <el-table-column prop="handler" label="经手人" width="80" />
            </el-table>
            <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center">
              <span class="muted">共 {{ reqList.length }} 条领料</span>
              <span>材料成本合计：<strong style="color:#f56c6c;font-size:16px">{{ reqTotalCost }}</strong> 元</span>
            </div>
          </template>
        </el-tab-pane>

        <el-tab-pane v-if="isEdit" label="图片附件" name="images">
          <el-alert type="info" :closable="false" style="margin-bottom:12px">可上传客户确认图、合同、发货实拍等。图片非必填。</el-alert>
          <ImageUpload v-model="imgList" entity-type="order" :entity-id="form.id" />
        </el-tab-pane>
      </el-tabs>

      <template #footer>
        <el-button @click="dlgVisible = false">取消</el-button>
        <el-button type="primary" @click="onSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 测量转单弹窗（H5工地录单闭环：boss 把工人 H5 现场测量记录转成正式 SO）-->
    <el-dialog v-model="convDlg" title="测量转单" width="720px">
      <!-- 列表态 -->
      <div v-if="!convRow">
        <el-input v-model="convKw" placeholder="搜客户/定位" style="width:240px;margin-bottom:8px" @keyup.enter="loadPending" clearable @clear="loadPending" />
        <el-table :data="pending" border max-height="400">
          <el-table-column prop="customer_name" label="客户" />
          <el-table-column prop="location_name" label="定位" />
          <el-table-column label="尺寸" width="160"><template #default="{row}">{{ `${row.door_h}×${row.door_w} 墙厚${row.wall_thick}` }}</template></el-table-column>
          <el-table-column prop="photo_count" label="照片" width="60" />
          <el-table-column prop="measured_at" label="测量时间" width="160" />
          <el-table-column label="操作" width="100"><template #default="{row}"><el-button size="small" type="primary" @click="pickConvert(row)">转单</el-button></template></el-table-column>
        </el-table>
      </div>
      <!-- 转单态 -->
      <div v-else>
        <el-descriptions :column="2" border size="small" style="margin-bottom:12px">
          <el-descriptions-item label="客户">{{ convRow.customer_name }}</el-descriptions-item>
          <el-descriptions-item label="定位">{{ convRow.location_name }}</el-descriptions-item>
          <el-descriptions-item label="门洞高">{{ convRow.door_h }}</el-descriptions-item>
          <el-descriptions-item label="门洞宽">{{ convRow.door_w }}</el-descriptions-item>
          <el-descriptions-item label="墙厚">{{ convRow.wall_thick }}</el-descriptions-item>
          <el-descriptions-item label="现场备注">{{ convRow.remark || '-' }}</el-descriptions-item>
        </el-descriptions>
        <el-form :model="convForm" label-width="80px">
          <el-form-item label="门型"><el-select v-model="convForm.door_bom_id" filterable @change="onConvBomChange"><el-option v-for="b in bomList" :key="b.id" :label="b.name" :value="b.id" /></el-select></el-form-item>
          <el-form-item label="颜色"><el-input v-model="convForm.color" /></el-form-item>
          <el-form-item label="数量"><el-input-number v-model="convForm.qty" :min="1" /></el-form-item>
          <el-form-item label="单价"><el-input-number v-model="convForm.unit_price" :min="0" :precision="2" /></el-form-item>
          <el-form-item label="经手人"><el-input v-model="convForm.handler_sale" /></el-form-item>
          <el-form-item label="下单日期"><el-date-picker v-model="convForm.order_date" type="date" value-format="YYYY-MM-DD" /></el-form-item>
          <el-form-item label="锁孔"><el-input v-model="convForm.lock_hole" /></el-form-item>
        </el-form>
        <div style="text-align:right">
          <el-button @click="convRow=null">返回列表</el-button>
          <el-button type="primary" :loading="converting" @click="doConvert">确认转单</el-button>
        </div>
      </div>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { orderApi, bomApi, measureApi, attachmentApi, cuttingApi, requisitionApi, materialApi } from '../api'
import { dateFmt, todayLocal } from '../utils/date'
import { tagType } from '../utils/tagColor'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '../store/user'
import ImageUpload from '../components/ImageUpload.vue'
import TagInput from '../components/TagInput.vue'
import ColumnSettings from '../components/ColumnSettings.vue'

const store = useUserStore()
const route = useRoute()
const router = useRouter()
const query = ref({ order_no: '', customer: '', door_bom_id: '', handler_sale: '', status: '', cut_status: '', dateRange: [], page: 1, pageSize: 50 })
const list = ref([])
const total = ref(0)
const bomList = ref([])

// 列配置器：全量列定义（现有列默认显示，新增可选列 defaultVisible:false 默认隐藏）
// key 与 colVisible(key) 对应；操作列固定显示不进配置器
const allColumns = [
  { prop: 'order_no', label: '订单号' },
  { prop: 'customer', label: '客户' },
  { prop: 'size', label: '尺寸(高×宽)' },
  { prop: 'wall_thick', label: '墙厚' },
  { prop: 'cut_door', label: '门扇(高×宽)' },
  { prop: 'cut_status', label: '下料状态' },
  { prop: 'cut_date', label: '下料日' },
  { prop: 'cut_remark_tags', label: '加工备注' },
  { prop: 'sub_customer', label: '子客户', defaultVisible: false },
  { prop: 'lock_hole', label: '锁孔', defaultVisible: false },
  { prop: 'door_bom_name', label: '门型' },
  { prop: 'color', label: '颜色' },
  { prop: 'style', label: '款式', defaultVisible: false },
  { prop: 'board', label: '门扇板材', defaultVisible: false },
  { prop: 'total_amount', label: '应收' },
  { prop: 'paid_amount', label: '已收' },
  { prop: 'balance', label: '欠款' },
  { prop: 'customer_type', label: '客户类别', defaultVisible: false },
  { prop: 'pay_method', label: '付款方式', defaultVisible: false },
  { prop: 'handler_sale', label: '经手人' },
  { prop: 'salesperson', label: '业务员', defaultVisible: false },
  { prop: 'installer', label: '安装师傅', defaultVisible: false },
  { prop: 'order_date', label: '下单日' },
  { prop: 'actual_ship_date', label: '发货日' },
  { prop: 'ship_no', label: '发货单号', defaultVisible: false },
  { prop: 'pay_date', label: '收款日' },
  { prop: 'receipt_no', label: '收据号', defaultVisible: false },
  { prop: 'remark', label: '订单备注', defaultVisible: false },
  { prop: 'status', label: '状态' },
  { prop: 'aging', label: '账龄' },
]
const visibleCols = ref(allColumns.filter((c) => c.defaultVisible !== false).map((c) => c.prop))
function colVisible(key) { return visibleCols.value.includes(key) }

// 表格固定滚动高度：搜索条件固定不滚，只有表格表体内部滚动
// 按窗口高度动态算（留出搜索区/分页/卡片边距约 280px），最小 300 保证小屏可用
const tableHeight = ref(Math.max(300, window.innerHeight - 280))
function onResize() { tableHeight.value = Math.max(300, window.innerHeight - 280) }

// 切换每页条数：回到第1页重载
function onSizeChange() {
  query.value.page = 1
  load()
}

const dlgVisible = ref(false)
const dlgTitle = ref('')
const isEdit = ref(false)
const activeTab = ref('info')
const form = ref({})
const imgList = ref([])

// 行内发货/收款
const shipVisible = ref(false)
const shipRow = ref(null)
const shipForm = ref({})
const payVisible = ref(false)
const payRow = ref(null)
const payForm = ref({})

// 批量操作
const selectedRows = ref([])
const tableRef = ref(null)
const batchShipVisible = ref(false)
const batchShipForm = ref({})
const batchPayVisible = ref(false)
const batchPayForm = ref({})
// 批量编辑（勾选式：勾哪项改哪项）
const batchEditVisible = ref(false)
const batchEditForm = ref({})
// shift 区间选择：记录上次点击行，shift+点击选中区间
let lastClickedRow = null

// 下料单生成
const cuttingVisible = ref(false)
const cutRow = ref(null)
const cutForm = ref({})
const cutConfig = ref({ defaultHeightCut: 40, defaultWidthCut: 70 })
const cutTagOptions = ref([])
const lockHoleOptions = ref([]) // 锁孔常用备选（近期去重，订单表单 el-select 备选）
// 下料单编辑（已下料订单：改门扇尺寸/下料日期/经手人/加工备注，含删除下料）
const cutEditVisible = ref(false)
const cutEditRow = ref(null)
const cutEditForm = ref({})
// 批量下料（未下料订单：按门洞高×宽分组，同组共用门扇尺寸）
const batchCutVisible = ref(false)
const batchCutForm = ref({})
const batchCutGroups = ref([])
const batchCuttableCount = computed(() => selectedRows.value.filter((r) => !r.cut_status && r.door_h != null && r.door_w != null).length)

// remark_tags：DB 存 JSON.stringify 字符串数组，前端解析回数组
function parseTags(raw) {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((s) => typeof s === 'string' && s) : []
  } catch {
    return []
  }
}

const colorOptions = computed(() => {
  const bom = bomList.value.find((b) => b.id === form.value.door_bom_id)
  return bom?.colors ? bom.colors.split(',') : []
})
const bomSpec = computed(() => {
  const bom = bomList.value.find((b) => b.id === form.value.door_bom_id)
  return bom?.standard_size || ''
})

// 欠款计算（决策2：已付 paid_amount，欠款=应收-已付）
// 表单内实时欠款（收款tab用）
const balanceDue = computed(() => {
  const total = Number(form.value.total_amount) || 0
  const paid = Number(form.value.paid_amount) || 0
  return Math.round((total - paid) * 100) / 100
})
// 已收款订单收款信息锁定（防误操作拖回状态）；反结入口在收款 tab
const payLocked = computed(() => form.value.status === '已收款')

// 领料·成本 tab：关联领料明细 + 材料成本合计（口径A：按当前物料参考单价实时算）
const reqList = ref([])
const reqTotalCost = computed(() =>
  Math.round(reqList.value.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.unit_price) || 0), 0) * 100) / 100
)
function reqLineTotal(row) {
  return Math.round((Number(row.qty) || 0) * (Number(row.unit_price) || 0) * 100) / 100
}

// 反结：已收款 → 赊账中（保留已付金额，回到可重新核对收款的状态）
async function onReopen() {
  const f = form.value
  try {
    await ElMessageBox.confirm(
      `确认反结订单 ${f.order_no}？\n订单将从"已收款"回到"赊账中"，已付金额保留，可重新核对收款信息。`,
      '反结确认',
      { confirmButtonText: '反结', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return // 用户取消
  }
  await orderApi.reopen(f.id)
  ElMessage.success('已反结，回到赊账中')
  // 重新拉详情刷新 form.status → 收款 tab 字段解锁，可继续核对
  const res = await orderApi.detail(f.id)
  form.value = { ...res.data }
  load()
}
// 列表行欠款（R7）
function balanceOf(row) {
  if (row.paid_amount == null) return 0
  const total = Number(row.total_amount) || 0
  const paid = Number(row.paid_amount) || 0
  return Math.round((total - paid) * 100) / 100
}

// 账龄（天）：已发货按发货日、赊账中按上次收款日；>30红 >15橙
function daysBetween(fromStr, toStr) {
  if (!fromStr || !toStr) return null
  const a = String(fromStr).slice(0, 10).split('-').map(Number)
  const b = String(toStr).slice(0, 10).split('-').map(Number)
  if (!a[0] || !b[0]) return null
  return Math.floor((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000)
}
function agingOf(row) {
  if (row.status === '已发货') return daysBetween(row.actual_ship_date, today())
  if (row.status === '赊账中') return daysBetween(row.pay_date, today())
  return null
}
function agingStyle(days) {
  if (days > 30) return 'color:#f56c6c;font-weight:600'
  if (days > 15) return 'color:#e6a23c;font-weight:600'
  return 'color:#909399'
}

function statusType(s) {
  return { 新建: 'info', 已发货: 'warning', 赊账中: 'danger', 已收款: 'success' }[s] || 'info'
}
// 下料单状态配色（已下料=success绿；未下料在列表由 v-else 兜底显示灰字，不进此函数）
function cutStatusType(s) {
  return { 已下料: 'success' }[s] || 'info'
}

// 批量：选中行中可发货/可收款的数量（后端也会做幂等校验，此处用于按钮可用性与提示）
const batchShipableCount = computed(() => selectedRows.value.filter((r) => r.status === '新建').length)
const batchPayableCount = computed(() => selectedRows.value.filter((r) => r.status === '新建' || r.status === '已发货' || r.status === '赊账中').length)

function onSelectionChange(rows) {
  selectedRows.value = rows
}

// shift 区间选择：用户实际点的是行首 checkbox（走 @select，无 event 对象拿不到 shiftKey），
// 故用全局 shiftKey 标志：window keydown/keyup 记录 shift 按下状态，@select 时读标志做区间选择
let shiftDown = false
function onShiftDown(e) { if (e.key === 'Shift') shiftDown = true }
function onShiftUp(e) { if (e.key === 'Shift') shiftDown = false }

// @select(selection, row)：checkbox 单击时触发。row=被点击的行。
// 若按住 shift 且有锚点行，选中锚点到当前行之间所有行；否则仅更新锚点
function onSelect(selection, row) {
  if (shiftDown && lastClickedRow && lastClickedRow !== row) {
    const listVal = list.value
    const startIdx = listVal.indexOf(lastClickedRow)
    const endIdx = listVal.indexOf(row)
    if (startIdx !== -1 && endIdx !== -1) {
      const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx]
      for (let i = from; i <= to; i++) {
        tableRef.value && tableRef.value.toggleRowSelection(listVal[i], true)
      }
    }
  }
  lastClickedRow = row
}
// 点行体（非 checkbox）也更新锚点，方便后续 shift+checkbox 选区间
function onRowClick(row) {
  lastClickedRow = row
}

// 批量编辑：勾选式表单，勾哪项改哪项，未勾不传
function openBatchEdit() {
  batchEditForm.value = {
    enableStatus: false, status: '',
    enableHandlerSale: false, handler_sale: '',
    enableSalesperson: false, salesperson: '',
    enableInstaller: false, installer: '',
    enableCustomerType: false, customer_type: '',
    enablePayMethod: false, pay_method: '',
    enableHandlerShip: false, handler_ship: '',
    enableHandlerFinance: false, handler_finance: '',
    enableRemark: false, remark: '',
  }
  batchEditVisible.value = true
}

async function onBatchUpdate() {
  const f = batchEditForm.value
  const fields = {}
  if (f.enableStatus) fields.status = f.status
  if (f.enableHandlerSale) fields.handler_sale = f.handler_sale
  if (f.enableSalesperson) fields.salesperson = f.salesperson
  if (f.enableInstaller) fields.installer = f.installer
  if (f.enableCustomerType) fields.customer_type = f.customer_type
  if (f.enablePayMethod) fields.pay_method = f.pay_method
  if (f.enableHandlerShip) fields.handler_ship = f.handler_ship
  if (f.enableHandlerFinance) fields.handler_finance = f.handler_finance
  if (f.enableRemark) fields.remark = f.remark
  if (Object.keys(fields).length === 0) return ElMessage.warning('请至少勾选一项要修改的字段')
  if (f.enableStatus && !f.status) return ElMessage.warning('勾选了改状态但未选目标状态')
  const ids = selectedRows.value.map((r) => r.id)
  const res = await orderApi.batchUpdate({ ids, fields })
  ElMessage.success(res.msg || '批量编辑完成')
  batchEditVisible.value = false
  load()
}

function openBatchShip() {
  batchShipForm.value = { actual_ship_date: today(), ship_no: '', handler_ship: store.name }
  batchShipVisible.value = true
}

async function onBatchShip() {
  const f = batchShipForm.value
  if (!f.actual_ship_date || !f.ship_no || !f.handler_ship) return ElMessage.warning('请补全发货日/发货单号/经手人')
  const ids = selectedRows.value.map((r) => r.id)
  const res = await orderApi.batchShip(ids, { ...f })
  ElMessage.success(res.msg || '批量发货完成')
  batchShipVisible.value = false
  load()
}

function openBatchPay() {
  batchPayForm.value = { pay_date: today(), receipt_no: '', pay_method: '', handler_finance: store.name }
  batchPayVisible.value = true
}

async function onBatchPay() {
  const f = batchPayForm.value
  if (!f.pay_date || !f.receipt_no || !f.handler_finance) return ElMessage.warning('请补全收款日/收据单号/经手人')
  const ids = selectedRows.value.map((r) => r.id)
  const res = await orderApi.batchPay(ids, { ...f })
  ElMessage.success(res.msg || '批量收款完成')
  batchPayVisible.value = false
  load()
}

function today() {
  return todayLocal()
}

async function load() {
  const params = { ...query.value }
  if (params.dateRange && params.dateRange.length === 2) {
    params.startDate = params.dateRange[0]
    params.endDate = params.dateRange[1]
  }
  delete params.dateRange
  const res = await orderApi.list(params)
  list.value = res.data.list
  total.value = res.data.total
}

function resetQuery() {
  query.value = { order_no: '', customer: '', door_bom_id: '', handler_sale: '', status: '', cut_status: '', dateRange: [], page: 1, pageSize: 50 }
  if (route.query.status) query.value.status = String(route.query.status)
  load()
}

function openAdd() {
  isEdit.value = false
  dlgTitle.value = '接单'
  activeTab.value = 'info'
  form.value = {
    customer: '', sub_customer: '', door_bom_id: '', color: '', qty: 1, unit_price: 0,
    handler_sale: store.name, order_date: today(),
    door_h: null, door_w: null, wall_thick: null, style: '', board: '',
    remark: '', edge_band: null, frame_line: '', customer_type: '', address: '',
    lock_hole: '',
  }
  dlgVisible.value = true
}

async function openEdit(row) {
  isEdit.value = true
  dlgTitle.value = '处理订单 ' + row.order_no
  activeTab.value = 'info'
  const res = await orderApi.detail(row.id)
  form.value = { ...res.data }
  // 加载已有图片
  imgList.value = []
  try {
    const r = await attachmentApi.list('order', row.id)
    imgList.value = r.data
  } catch (e) {}
  // 加载关联领料（材料成本展示）
  reqList.value = []
  try {
    const rr = await requisitionApi.list({ order_id: row.id, pageSize: 200 })
    reqList.value = rr.data.list || []
  } catch (e) {}
  dlgVisible.value = true
}

function onBomChange() {
  form.value.color = ''
}

async function onSubmit() {
  const f = form.value
  if (!f.customer || !f.door_bom_id || !f.color || !f.qty || !f.unit_price || !f.handler_sale || !f.order_date) {
    return ElMessage.warning('请补全订单必填项')
  }
  if (isEdit.value) {
    await orderApi.update(f.id, f)
    ElMessage.success('更新成功')
  } else {
    const res = await orderApi.create(f)
    const sug = res.data.suggestion
    if (sug && sug.generated > 0) {
      ElMessage.success(`接单成功，已生成 ${sug.generated} 条采购建议`)
    } else {
      ElMessage.success('接单成功，库存充足无需采购')
    }
  }
  dlgVisible.value = false
  load()
}

// 行内发货：只填关键字段，其余从订单详情带出，经手人默认当前登录人
function openShip(row) {
  shipRow.value = row
  shipForm.value = {
    actual_ship_date: today(),
    ship_no: '',
    handler_ship: store.name,
  }
  shipVisible.value = true
}

async function onShip() {
  const f = shipForm.value
  if (!f.actual_ship_date || !f.ship_no) return ElMessage.warning('请填发货日与发货单号')
  const r = shipRow.value
  // 复用 PUT，带上订单原有字段 + 发货字段，触发状态流转
  await orderApi.update(r.id, {
    customer: r.customer, door_bom_id: r.door_bom_id, color: r.color,
    qty: r.qty, unit_price: r.unit_price,
    actual_ship_date: f.actual_ship_date, ship_no: f.ship_no, handler_ship: f.handler_ship,
    pay_date: null, receipt_no: null, handler_finance: null,
  })
  ElMessage.success('已发货，状态已更新')
  shipVisible.value = false
  load()
}

// 行内收款（决策2：支持部分付款，已付默认=应收额，可改少于应收=赊账）
function openPay(row) {
  payRow.value = row
  payForm.value = {
    paid_amount: Number(row.total_amount) || 0,  // 默认全额
    pay_method: '',
    pay_date: today(),
    receipt_no: '',
    handler_finance: store.name,
  }
  payVisible.value = true
}

// 行内收款弹窗实时欠款
const payBalance = computed(() => {
  const total = Number(payRow.value?.total_amount) || 0
  const paid = Number(payForm.value.paid_amount) || 0
  return Math.round((total - paid) * 100) / 100
})

async function onPay() {
  const f = payForm.value
  if (!f.pay_date) return ElMessage.warning('请填收款日期')
  if (f.paid_amount == null || Number(f.paid_amount) <= 0) return ElMessage.warning('请填已付金额')
  const r = payRow.value
  await orderApi.update(r.id, {
    customer: r.customer, door_bom_id: r.door_bom_id, color: r.color,
    qty: r.qty, unit_price: r.unit_price,
    actual_ship_date: r.actual_ship_date, ship_no: r.ship_no, handler_ship: r.handler_ship,
    pay_date: f.pay_date, receipt_no: f.receipt_no, handler_finance: f.handler_finance,
    paid_amount: f.paid_amount, pay_method: f.pay_method,
  })
  ElMessage.success('已收款，状态已更新')
  payVisible.value = false
  load()
}

// 生成下料单（未下料订单）：门扇高宽给默认值=门洞−扣尺，可改
function openCutting(row) {
  if (row.door_h == null || row.door_w == null) {
    return ElMessage.warning('订单未录门洞尺寸，请先在订单详情补录')
  }
  cutRow.value = row
  cutForm.value = {
    door_height: Number(row.door_h) - Number(cutConfig.value.defaultHeightCut),
    door_width: Number(row.door_w) - Number(cutConfig.value.defaultWidthCut),
    handler: store.name,
    cut_date: todayLocal(),
    tags: [],
  }
  cuttingVisible.value = true
}

async function onCutting() {
  const f = cutForm.value
  const r = cutRow.value
  if (!f.door_height || !f.door_width) {
    return ElMessage.warning('门扇高/宽必填')
  }
  if (!f.cut_date) return ElMessage.warning('请填下料日期')
  await cuttingApi.create({
    order_id: r.id,
    door_height: f.door_height,
    door_width: f.door_width,
    handler: f.handler,
    cut_date: f.cut_date,
    remark_tags: JSON.stringify(f.tags),
  })
  ElMessage.success('下料单已生成（已下料）')
  cuttingVisible.value = false
  load() // 刷新列表：下料状态/门扇列即时更新
}

// 编辑下料单（已下料订单）：行内"编辑"按钮入口
function openCuttingEdit(row) {
  cutEditRow.value = row
  cutEditForm.value = {
    door_height: Number(row.cut_door_height),
    door_width: Number(row.cut_door_width),
    handler: row.cut_handler || store.name,
    cut_date: row.cut_date ? String(row.cut_date).slice(0, 10) : todayLocal(),
    tags: parseTags(row.cut_remark_tags),
  }
  cutEditVisible.value = true
}

async function onCuttingEdit() {
  const f = cutEditForm.value
  if (!f.door_height || !f.door_width) return ElMessage.warning('门扇高/宽必填')
  if (!f.cut_date) return ElMessage.warning('请填下料日期')
  await cuttingApi.update(cutEditRow.value.id, {
    door_height: f.door_height,
    door_width: f.door_width,
    cut_date: f.cut_date,
    handler: f.handler,
    remark_tags: JSON.stringify(f.tags),
  })
  ElMessage.success('已更新下料单')
  cutEditVisible.value = false
  load()
}

async function onCuttingDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确认删除下料单 #${row.id}（订单 ${row.order_no}）？删除后该订单回到"未下料"，可重新生成。`,
      '删除确认',
      { type: 'warning' }
    )
  } catch {
    return
  }
  await cuttingApi.remove(row.id)
  ElMessage.success('已删除下料单')
  cutEditVisible.value = false
  load()
}

// 打印：单条=单张表；批量=合并一张表（仅已下料可打印）
function printSingle(row) {
  router.push({ path: '/cutting-list/print', query: { mode: 'single', ids: row.id } })
}
function openBatchPrint() {
  const cutRows = selectedRows.value.filter((r) => r.cut_status)
  if (cutRows.length === 0) return ElMessage.warning('选中订单均未下料，无可打印下料单')
  const ids = cutRows.map((r) => r.id).join(',')
  router.push({ path: '/cutting-list/print', query: { mode: 'ledger', ids } })
}

// 标签打印（4 种类型）：订单行"标签"按钮 → 选类型 → 跳 labelPrint 页
const labelVisible = ref(false)
const labelRow = ref(null)
const labelType = ref('')
function openLabel(row) {
  labelRow.value = row
  labelType.value = 'door-in'
  labelVisible.value = true
}
function printLabel() {
  if (!labelType.value || !labelRow.value) return
  router.push({ path: '/label/print', query: { type: labelType.value, ids: labelRow.value.id } })
  labelVisible.value = false
}
// 批量标签：工具栏入口（选多单同类型打印）
function openBatchLabel() {
  if (selectedRows.value.length === 0) return ElMessage.warning('请先勾选订单')
  labelRow.value = null
  labelType.value = 'door-in'
  labelVisible.value = true
}
function printBatchLabel() {
  if (!labelType.value) return ElMessage.warning('请选标签类型')
  const ids = selectedRows.value.map((r) => r.id).join(',')
  router.push({ path: '/label/print', query: { type: labelType.value, ids } })
  labelVisible.value = false
}

// 批量下料：按门洞高×宽分组，同组共用门扇尺寸（门洞−扣尺默认，可改）
function openBatchCut() {
  const dh = Number(cutConfig.value.defaultHeightCut)
  const dw = Number(cutConfig.value.defaultWidthCut)
  const uncut = selectedRows.value.filter((r) => !r.cut_status && r.door_h != null && r.door_w != null)
  if (uncut.length === 0) return ElMessage.warning('选中订单均无未下料或未录门洞尺寸，不可批量下料')
  // 按 door_h×door_w 分组
  const map = new Map()
  for (const r of uncut) {
    const key = `${r.door_h}×${r.door_w}`
    if (!map.has(key)) {
      map.set(key, {
        key,
        hole: key,
        door_height: Number(r.door_h) - dh,
        door_width: Number(r.door_w) - dw,
        items: [],
      })
    }
    map.get(key).items.push({ order_id: r.id, order_no: r.order_no, customer: r.customer })
  }
  batchCutGroups.value = [...map.values()]
  batchCutForm.value = { cut_date: todayLocal(), handler: store.name, tags: [] }
  batchCutVisible.value = true
}

async function onBatchCut() {
  const f = batchCutForm.value
  if (!f.cut_date) return ElMessage.warning('请填下料日期')
  // 展开分组为 items（每组共用其 door_height/door_width）
  const items = []
  for (const g of batchCutGroups.value) {
    if (!g.door_height || !g.door_width) return ElMessage.warning(`门洞 ${g.hole} 组门扇尺寸未填`)
    for (const it of g.items) {
      items.push({ order_id: it.order_id, door_height: g.door_height, door_width: g.door_width })
    }
  }
  const res = await cuttingApi.batch({
    items,
    cut_date: f.cut_date,
    handler: f.handler,
    remark_tags: JSON.stringify(f.tags),
  })
  ElMessage.success(res.msg || '批量下料完成')
  batchCutVisible.value = false
  load()
}

// 批量领料：一个物料总量分给多笔订单，快捷输入 1+3+5+7（平均预填/复制同上/键盘流/自动分配余量）
const materialList = ref([])
const batchReqVisible = ref(false)
const batchReqForm = ref({ material_id: '', total_qty: 0, req_date: todayLocal(), handler: store.name || '' })
const batchReqItems = ref([]) // [{order_id,order_no,customer,door_bom_name,size,qty}]
const qtyInputs = ref([]) // el-input refs，键盘流聚焦用

// Σ已填数量（空/非法当0）
const filledSum = computed(() => batchReqItems.value.reduce((s, it) => s + (Number(it.qty) || 0), 0))
// 余量 = 总量 - 已填（正=剩, 负=超）
const remainQty = computed(() => (Number(batchReqForm.value.total_qty) || 0) - filledSum.value)
// 当前选中物料（库存参考用）
const selectedMaterial = computed(() => materialList.value.find((m) => m.id === batchReqForm.value.material_id) || null)
// 领料后剩余库存 = 当前库存 - 总领料量（负=不够）
const afterReqStock = computed(() => {
  if (!selectedMaterial.value) return null
  return Number(selectedMaterial.value.stock_qty) - (Number(batchReqForm.value.total_qty) || 0)
})
// 可提交：基础信息齐 + 至少1单有数量 + Σ=总量
const canSubmitBatchReq = computed(() => {
  const f = batchReqForm.value
  if (!f.material_id || !f.total_qty || !f.req_date || !f.handler) return false
  if (filledSum.value !== Number(f.total_qty)) return false
  return batchReqItems.value.some((it) => Number(it.qty) > 0)
})

function openBatchReq() {
  if (selectedRows.value.length < 2) return ElMessage.warning('批量领料至少勾选 2 单')
  batchReqItems.value = selectedRows.value.map((r) => ({
    order_id: r.id,
    order_no: r.order_no,
    customer: r.customer,
    door_bom_name: r.door_bom_name,
    size: `${r.door_h || '-'}×${r.door_w || '-'}`,
    qty: '',
  }))
  batchReqForm.value = { material_id: '', total_qty: 0, req_date: todayLocal(), handler: store.name || '' }
  qtyInputs.value = []
  batchReqVisible.value = true
}

// ① 平均预填：总量÷N，余数依次+1给前几单
function avgFill() {
  const total = Number(batchReqForm.value.total_qty)
  if (!total || total <= 0) return ElMessage.warning('先填总领料数量')
  const n = batchReqItems.value.length
  const base = Math.floor(total / n)
  const rem = total - base * n
  batchReqItems.value.forEach((it, i) => { it.qty = String(base + (i < rem ? 1 : 0)) })
}

// ③ 复制上一行
function copyPrev(idx) {
  if (idx === 0) return
  batchReqItems.value[idx].qty = batchReqItems.value[idx - 1].qty
  focusQty(idx)
}

// ⑦ 自动分配余量：把剩余总量平均分给 qty 为空的行
function autoFillRemain() {
  const total = Number(batchReqForm.value.total_qty)
  if (!total) return ElMessage.warning('先填总领料数量')
  const emptyIdxs = []
  batchReqItems.value.forEach((it, i) => { if (!it.qty || Number(it.qty) <= 0) emptyIdxs.push(i) })
  if (emptyIdxs.length === 0) return ElMessage.warning('无空行可分配')
  const remain = total - filledSum.value
  if (remain <= 0) return ElMessage.warning('已填数量已达/超总量，无余量可分')
  const base = Math.floor(remain / emptyIdxs.length)
  const rem = remain - base * emptyIdxs.length
  emptyIdxs.forEach((oi, i) => { batchReqItems.value[oi].qty = String(base + (i < rem ? 1 : 0)) })
}

// ⑤ 键盘流：聚焦/Enter下一行/↑↓相邻行
function focusQty(idx) { qtyInputs.value[idx]?.focus?.() }
function onQtyEnter(idx) { if (idx < batchReqItems.value.length - 1) focusQty(idx + 1) }
function onQtyKeydown(e, idx) {
  if (e.key === 'ArrowDown') { e.preventDefault(); if (idx < batchReqItems.value.length - 1) focusQty(idx + 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); if (idx > 0) focusQty(idx - 1) }
}

async function onBatchReq() {
  const f = batchReqForm.value
  const items = batchReqItems.value
    .filter((it) => Number(it.qty) > 0)
    .map((it) => ({ order_id: it.order_id, qty: Number(it.qty) }))
  if (items.length === 0) return ElMessage.warning('至少分配一单数量')
  const sum = items.reduce((s, it) => s + it.qty, 0)
  if (sum !== Number(f.total_qty)) return ElMessage.warning(`分配合计 ${sum} 与总量 ${f.total_qty} 不符`)
  const res = await requisitionApi.batch({
    material_id: f.material_id,
    req_date: f.req_date,
    handler: f.handler,
    items,
  })
  ElMessage.success(res.msg || '批量领料完成')
  batchReqVisible.value = false
  load()
}

// ===== 测量转单（H5工地录单闭环：boss 桌面把工人 H5 现场测量记录转成正式 SO）=====
const convDlg = ref(false)
const convRow = ref(null)
const pending = ref([])
const convKw = ref('')
const convForm = reactive({ door_bom_id: null, color: '', qty: 1, unit_price: 0, handler_sale: store.name, order_date: new Date().toISOString().slice(0, 10), lock_hole: '' })
const converting = ref(false)
const openConvert = async () => {
  convDlg.value = true
  convRow.value = null
  await loadPending()
  if (!bomList.value.length) { const { data } = await bomApi.all(); bomList.value = data }
}
const loadPending = async () => { const { data } = await measureApi.pending({ keyword: convKw.value }); pending.value = data }
const pickConvert = (row) => {
  convRow.value = row
  Object.assign(convForm, { door_bom_id: null, color: '', qty: 1, unit_price: 0, handler_sale: store.name, order_date: new Date().toISOString().slice(0, 10), lock_hole: '' })
}
const onConvBomChange = (id) => { const b = bomList.value.find((x) => x.id === id); if (b) convForm.color = b.colors?.split(',')[0] || '' }
const doConvert = async () => {
  if (!convForm.door_bom_id || !convForm.color || !convForm.unit_price) return ElMessage.warning('门型/颜色/单价必填')
  converting.value = true
  try {
    const { data } = await measureApi.convert(convRow.value.id, convForm)
    ElMessage.success(`转单成功 ${data.order_no}`)
    convDlg.value = false
    convRow.value = null
    load()
  } catch (e) { ElMessage.error(e.message || '转单失败') }
  finally { converting.value = false }
}

onMounted(async () => {
  bomList.value = (await bomApi.all()).data
  materialList.value = (await materialApi.all()).data || []
  cutConfig.value = (await cuttingApi.getConfig()).data
  cutTagOptions.value = (await cuttingApi.getTags()).data || []
  try { lockHoleOptions.value = (await orderApi.lockHoles()).data || [] } catch (e) {}
  // 工作台待办跳转带 status query，自动筛选
  if (route.query.status) {
    query.value.status = String(route.query.status)
  }
  load()
  window.addEventListener('keydown', onShiftDown)
  window.addEventListener('keyup', onShiftUp)
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onShiftDown)
  window.removeEventListener('keyup', onShiftUp)
  window.removeEventListener('resize', onResize)
})
</script>

<style scoped>
.muted { color: #909399; font-size: 12px; }
.tag-row { display: flex; flex-wrap: wrap; gap: 4px; }
.tag-item { margin: 0; }
/* 批量下料分组列表 */
.batch-cut-groups { max-height: 320px; overflow-y: auto; }
.batch-cut-group { border: 1px solid #ebeef5; border-radius: 4px; padding: 10px 12px; margin-bottom: 8px; }
.batch-cut-group .group-head { display: flex; align-items: center; gap: 4px; margin-bottom: 6px; }
.batch-cut-group .group-size { font-weight: 600; margin-right: 8px; }
.batch-cut-group .group-orders { line-height: 1.6; }
/* 标签类型选择按钮内换行 */
.label-radio-group .el-radio-button__inner { line-height: 1.4; padding: 8px 14px; }
/* 批量领料弹窗：库存参考行 */
.batch-req-stock { background:#f5f7fa; border:1px solid #e4e7ed; border-radius:4px; padding:8px 12px; margin:8px 0; font-size:13px; display:flex; align-items:center; gap:8px; }
.batch-req-stock .stock-cur b { color:#409eff; }
.batch-req-stock .stock-sep { color:#dcdfe6; }
.batch-req-stock .stock-after b.ok { color:#67c23a; }
.batch-req-stock .stock-after b.danger { color:#f56c6c; }
/* 批量领料弹窗：操作条 + 汇总 */
.batch-req-bar { display: flex; justify-content: space-between; align-items: center; margin: 8px 0; flex-wrap: wrap; gap: 8px; }
.batch-req-actions { display: flex; align-items: center; gap: 8px; }
.batch-req-hint { font-size: 12px; }
.batch-req-sum { font-size: 13px; }
.batch-req-sum .warn { color: #e6a23c; font-weight: 600; }
.batch-req-sum .danger { color: #f56c6c; font-weight: 600; }
.batch-req-sum .ok { color: #67c23a; font-weight: 600; }
/* 整表字号加大一号（14→15px），提升可读性 */
:deep(.el-table) { font-size: 15px; }
/* 欠款>0 输入框标红提示 */
:deep(.balance-over .el-input__inner) { color: #f56c6c; font-weight: 600; }
/* 移动端：行内操作按钮放大到手指好点 */
@media (max-width: 768px) {
  .row-btn { min-height: 44px; padding: 0 12px; }
}
</style>
