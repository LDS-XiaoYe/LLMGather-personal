<script setup lang="ts">
// @ts-nocheck
import { computed as vueComputed, isRef, unref } from 'vue';
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
</script>

<template>
        <div class="page-header">
          <div class="header-left"><strong>控制台</strong></div>
          <div class="header-right">
            <template v-if="isAuthLoaded">
            <el-button v-if="!isAuthenticated" type="primary" plain @click="isAuthDialogOpen = true">登录 / 注册</el-button>
            <el-dropdown v-else trigger="click" @command="handleUserMenu">
              <el-tag type="success" style="cursor:pointer">{{ authUser?.username }} ▾</el-tag>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="logout"><el-icon><SwitchButton /></el-icon> 退出登录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            </template>
          </div>
        </div>

        <div class="console-page">
          <el-alert v-if="isAuthLoaded && !isAuthenticated" type="warning" :closable="false" show-icon title="请先登录以查看控制台" style="margin-bottom: 16px" />
          <template v-else-if="isAuthenticated">
            <el-card shadow="never" class="console-section">
              <template #header><strong>账户信息</strong></template>
              <div class="console-stats-grid">
                <div class="console-stat-card"><div class="console-stat-label">用户名</div><div class="console-stat-value">{{ authUser?.username }}</div></div>
                <div class="console-stat-card highlight"><div class="console-stat-label">余额</div><div class="console-stat-value">￥{{ authCreditsText }}</div></div>
                <div class="console-stat-card"><div class="console-stat-label">累计消费</div><div class="console-stat-value">￥{{ authSpentText }}</div></div>
                <div class="console-stat-card"><div class="console-stat-label">注册时间</div><div class="console-stat-value">{{ formatTime(authUser?.createdAt) }}</div></div>
              </div>
              <el-divider />
              <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
                <span style="font-size:14px;color:#374151">在线充值：</span>
                <el-button type="primary" @click="openRechargeDialog()">支付宝当面付</el-button>
              </div>
            </el-card>

            <el-card shadow="never" class="console-section">
              <template #header>
                <div style="display:flex;align-items:center;justify-content:space-between">
                  <strong>充值记录</strong>
                  <el-button text size="small" @click="loadRechargeOrders()" :loading="rechargeOrdersLoading">刷新</el-button>
                </div>
              </template>
              <el-table v-if="rechargeOrders.length > 0" :data="rechargeOrders" size="small" max-height="240">
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
            </el-card>

            <el-card shadow="never" class="console-section">
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
            </el-card>

            <el-card shadow="never" class="console-section">
              <template #header>
                <div style="display:flex;align-items:center;justify-content:space-between">
                  <strong>计费规则</strong>
                  <span style="font-size:11px;color:#9ca3af">元 / 千 token</span>
                </div>
              </template>
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
            </el-card>

            <el-card shadow="never" class="console-section">
              <template #header><strong>用量明细</strong></template>
              <el-table :data="billingLedger" stripe style="width:100%">
                <template #empty><el-empty description="暂无用量记录，使用 API 后将自动记录" :image-size="48" /></template>
                <el-table-column prop="model" label="模型" min-width="220" />
                <el-table-column prop="requestType" label="请求类型" min-width="120" />
                <el-table-column prop="promptTokens" label="输入Token" min-width="130" />
                <el-table-column prop="completionTokens" label="输出Token" min-width="130" />
                <el-table-column prop="cost" label="费用" min-width="110" />
                <el-table-column label="时间" min-width="200">
                  <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
                </el-table-column>
              </el-table>
            </el-card>
          </template>
        </div>
</template>
