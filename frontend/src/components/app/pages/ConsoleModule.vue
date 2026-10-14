<script setup lang="ts">
// @ts-nocheck
import { computed as vueComputed, isRef, unref, ref, watch } from 'vue';
import WorkspaceHeader from '../../ui/WorkspaceHeader.vue';
import type { PageMode } from '../../../types';

const props = defineProps<{ app: Record<string, any> }>();
const app = props.app;
const bind = (target: Record<string, any>, key: string) => vueComputed({
  get: () => unref(target[key]),
  set: (value) => {
    if (isRef(target[key])) target[key].value = value;
    else target[key] = value;
  },
});

const SwitchButton = bind(app, 'SwitchButton');
const formatTime = bind(app, 'formatTime');
const isAuthDialogOpen = bind(app, 'isAuthDialogOpen');
const authUser = bind(app, 'authUser');
const rechargeOrders = bind(app, 'rechargeOrders');
const rechargeOrdersLoading = bind(app, 'rechargeOrdersLoading');
const billingLedger = bind(app, 'billingLedger');
const status = bind(app, 'status');
const isAuthLoaded = bind(app, 'isAuthLoaded');
const consoleDailyUsage = bind(app, 'consoleDailyUsage');
const consoleChartDays = bind(app, 'consoleChartDays');
const isAuthenticated = bind(app, 'isAuthenticated');
const authCreditsText = bind(app, 'authCreditsText');
const authSpentText = bind(app, 'authSpentText');
const handleUserMenu = bind(app, 'handleUserMenu');
const logout = bind(app, 'logout');
const openRechargeDialog = bind(app, 'openRechargeDialog');
const loadRechargeOrders = bind(app, 'loadRechargeOrders');
const consolePricingRows = bind(app, 'consolePricingRows');
const loadConsoleDailyUsage = bind(app, 'loadConsoleDailyUsage');
const detailTab = ref('usage');
const ledgerPage = ref(1), rechargePage = ref(1);
const ledgerPageRows = vueComputed(() => billingLedger.value.slice((ledgerPage.value - 1) * 20, ledgerPage.value * 20));
const rechargePageRows = vueComputed(() => rechargeOrders.value.slice((rechargePage.value - 1) * 10, rechargePage.value * 10));
watch(() => billingLedger.value.length, () => { ledgerPage.value = 1; });
watch(() => rechargeOrders.value.length, () => { rechargePage.value = 1; });
</script>

<template>
        <WorkspaceHeader title="控制台" :app="app"></WorkspaceHeader>

        <div class="console-page">
          <el-alert v-if="isAuthLoaded && !isAuthenticated" type="warning" :closable="false" show-icon title="请先登录以查看控制台" style="margin-bottom: 16px" />
          <template v-else-if="isAuthenticated">
            <section class="ui-account-overview">
   <div class="ui-section-toolbar"><div><h2>账户余额</h2><p class="ui-muted">{{ authUser?.username }} · 注册于 {{ formatTime(authUser?.createdAt) }}</p></div><el-button type="primary" @click="openRechargeDialog()">充值</el-button></div>
   <div class="ui-account-metrics"><div><span>可用余额</span><strong>￥{{ authCreditsText }}</strong></div><div><span>累计消费</span><strong>￥{{ authSpentText }}</strong></div></div>
 </section><el-card shadow="never" class="console-section">
              <template #header>
                <div style="display:flex;align-items:center;justify-content:space-between">
                  <strong>用量趋势</strong>
                  <el-segmented
                    :model-value="String(consoleChartDays)"
                    @change="(val: string | number) => { consoleChartDays = Number(val); loadConsoleDailyUsage(); }"
                    :options="[
                      { label: '7天', value: '7' },
                      { label: '30天', value: '30' },
                      { label: '90天', value: '90' },
                    ]"
                    size="small"
                  />
                </div>
              </template>
              <div v-if="consoleDailyUsage.length > 0" id="console-chart" style="width:100%;height:260px"></div>
              <el-empty v-else description="暂无用量数据" :image-size="48" style="padding:30px 0" />
            </el-card><el-tabs v-model="detailTab" class="ui-console-detail-tabs">
  <el-tab-pane label="用量明细" name="usage"><p class="ui-muted">当前已加载 {{ billingLedger.length }} 条记录</p><el-card shadow="never" class="console-section">

              <el-table :data="ledgerPageRows" stripe style="width:100%">
                <template #empty><el-empty description="暂无用量记录" :image-size="48" /></template>
                <el-table-column prop="model" label="模型" min-width="220" />
                <el-table-column prop="requestType" label="请求类型" min-width="120" />
                <el-table-column prop="promptTokens" label="输入 Token" min-width="130" />
                <el-table-column prop="completionTokens" label="输出 Token" min-width="130" />
                <el-table-column prop="cost" label="费用（元）" min-width="110" />
                <el-table-column label="时间" min-width="200">
                  <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
                </el-table-column>
              </el-table>
            <div class="ui-pagination"><el-pagination hide-on-single-page v-model:current-page="ledgerPage" :page-size="20" :total="billingLedger.length" layout="prev, pager, next" /></div></el-card></el-tab-pane>
  <el-tab-pane label="充值记录" name="recharge"><div class="ui-section-toolbar"><span class="ui-muted">当前已加载 {{ rechargeOrders.length }} 条记录</span><el-button size="small" plain @click="loadRechargeOrders()" :loading="rechargeOrdersLoading">刷新记录</el-button></div><el-card shadow="never" class="console-section">

              <el-table v-if="rechargeOrders.length > 0" :data="rechargePageRows" size="small" >
                <el-table-column prop="amount" label="金额" width="80">
                  <template #default="{ row }">￥{{ row.amount }}</template>
                </el-table-column>
                <el-table-column prop="status" label="状态" width="90">
                  <template #default="{ row }">
                    <el-tag :type="row.status === 'paid' ? 'success' : row.status === 'pending' ? 'warning' : 'info'" size="small">
                      {{ row.status === 'paid' ? '已支付' : row.status === 'pending' ? '待支付' : row.status }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="alipayTradeNo" label="支付宝交易号" min-width="160">
                  <template #default="{ row }">{{ row.alipayTradeNo || '-' }}</template>
                </el-table-column>
                <el-table-column prop="createdAt" label="创建时间" min-width="140">
                  <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
                </el-table-column>
                <el-table-column prop="paidAt" label="支付时间" min-width="140">
                  <template #default="{ row }">{{ row.paidAt ? formatTime(row.paidAt) : '-' }}</template>
                </el-table-column>
              </el-table>
              <el-empty v-else description="暂无充值记录" :image-size="48" style="padding:20px 0" />
            <div class="ui-pagination"><el-pagination hide-on-single-page v-model:current-page="rechargePage" :page-size="10" :total="rechargeOrders.length" layout="prev, pager, next" /></div></el-card></el-tab-pane>
  <el-tab-pane label="计费规则" name="pricing"><p class="ui-muted">价格单位：元 / 千 Token</p><el-card shadow="never" class="console-section">

              <el-table :data="consolePricingRows" stripe style="width:100%">
                <el-table-column label="档位" width="120">
                  <template #default="{ row }">
                    <el-tag :type="row.tagType" size="small">{{ row.label }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="模型举例" min-width="250">
                  <template #default="{ row }">{{ row.sampleModels }}</template>
                </el-table-column>
                <el-table-column label="输入价格" width="130" align="center">
                  <template #default="{ row }">¥{{ row.promptPrice.toFixed(4) }}</template>
                </el-table-column>
                <el-table-column label="输出价格" width="130" align="center">
                  <template #default="{ row }">¥{{ row.completionPrice.toFixed(4) }}</template>
                </el-table-column>
                <template #empty><el-empty description="暂无计费规则" :image-size="48" /></template>
              </el-table>
            </el-card></el-tab-pane>
 </el-tabs>
          </template>
        </div>
</template>
