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

const Cpu = bind(app, 'Cpu');
const DataAnalysis = bind(app, 'DataAnalysis');
const Delete = bind(app, 'Delete');
const EditPen = bind(app, 'EditPen');
const MoreFilled = bind(app, 'MoreFilled');
const Plus = bind(app, 'Plus');
const Search = bind(app, 'Search');
const Setting = bind(app, 'Setting');
const TrendCharts = bind(app, 'TrendCharts');
const User = bind(app, 'User');
const UserFilled = bind(app, 'UserFilled');
const Coin = bind(app, 'Coin');
const formatTime = bind(app, 'formatTime');
const models = bind(app, 'models');
const realModels = bind(app, 'realModels');
const adminStats = bind(app, 'adminStats');
const adminUsers = bind(app, 'adminUsers');
const adminUsersTotal = bind(app, 'adminUsersTotal');
const adminUsersPage = bind(app, 'adminUsersPage');
const adminUsersSearch = bind(app, 'adminUsersSearch');
const adminBilling = bind(app, 'adminBilling');
const adminBillingTotal = bind(app, 'adminBillingTotal');
const adminBillingPage = bind(app, 'adminBillingPage');
const adminBillingFilterUsername = bind(app, 'adminBillingFilterUsername');
const adminBillingFilterModel = bind(app, 'adminBillingFilterModel');
const adminBillingFilterProvider = bind(app, 'adminBillingFilterProvider');
const adminEditUserDialog = bind(app, 'adminEditUserDialog');
const adminEditUserCredits = bind(app, 'adminEditUserCredits');
const adminEditUserRole = bind(app, 'adminEditUserRole');
const adminEditUserUsername = bind(app, 'adminEditUserUsername');
const adminEditUserEmailVerified = bind(app, 'adminEditUserEmailVerified');
const adminCreateUserDialog = bind(app, 'adminCreateUserDialog');
const adminCreateUserForm = bind(app, 'adminCreateUserForm');
const adminCreateUserSaving = bind(app, 'adminCreateUserSaving');
const adminTab = bind(app, 'adminTab');
const adminDailyUsage = bind(app, 'adminDailyUsage');
const adminChartDays = bind(app, 'adminChartDays');
const adminTodayStats = bind(app, 'adminTodayStats');
const adminModelUsage = bind(app, 'adminModelUsage');
const adminResetPwdDialog = bind(app, 'adminResetPwdDialog');
const adminResetPwdUsername = bind(app, 'adminResetPwdUsername');
const adminResetPwdValue = bind(app, 'adminResetPwdValue');
const adminBillingFromDate = bind(app, 'adminBillingFromDate');
const adminBillingToDate = bind(app, 'adminBillingToDate');
const adminProviderKeyCounts = bind(app, 'adminProviderKeyCounts');
const adminApiKeyProviderFilter = bind(app, 'adminApiKeyProviderFilter');
const adminSettings = bind(app, 'adminSettings');
const adminEditSettingDialog = bind(app, 'adminEditSettingDialog');
const adminEditSettingKey = bind(app, 'adminEditSettingKey');
const adminEditSettingValue = bind(app, 'adminEditSettingValue');
const adminEditSettingDesc = bind(app, 'adminEditSettingDesc');
const adminEditSettingModels = bind(app, 'adminEditSettingModels');
const adminEditModelTags = bind(app, 'adminEditModelTags');
const adminModelTiers = bind(app, 'adminModelTiers');
const adminTierEditDialog = bind(app, 'adminTierEditDialog');
const adminTierEditKey = bind(app, 'adminTierEditKey');
const adminTierEditLabel = bind(app, 'adminTierEditLabel');
const adminTierEditPromptPrice = bind(app, 'adminTierEditPromptPrice');
const adminTierEditCompletionPrice = bind(app, 'adminTierEditCompletionPrice');
const adminTierEditExamples = bind(app, 'adminTierEditExamples');
const adminTierEditIsNew = bind(app, 'adminTierEditIsNew');
const adminEditSettingTagFilter = bind(app, 'adminEditSettingTagFilter');
const adminEditSettingTextMode = bind(app, 'adminEditSettingTextMode');
const filteredModelsForSetting = bind(app, 'filteredModelsForSetting');
const adminProviderKeys = bind(app, 'adminProviderKeys');
const adminProviderKeyMetrics = bind(app, 'adminProviderKeyMetrics');
const adminAddKeyDialog = bind(app, 'adminAddKeyDialog');
const adminNewKeyProvider = bind(app, 'adminNewKeyProvider');
const adminNewKeyName = bind(app, 'adminNewKeyName');
const adminNewKeyValue = bind(app, 'adminNewKeyValue');
const adminProviderConfigs = bind(app, 'adminProviderConfigs');
const adminEditConfigDialog = bind(app, 'adminEditConfigDialog');
const adminEditConfigForm = bind(app, 'adminEditConfigForm');
const adminIsNewConfig = bind(app, 'adminIsNewConfig');
const isAdmin = bind(app, 'isAdmin');
const loadModels = bind(app, 'loadModels');
const refreshBillingData = bind(app, 'refreshBillingData');
const loadAdminStats = bind(app, 'loadAdminStats');
const loadAdminUsers = bind(app, 'loadAdminUsers');
const loadAdminBilling = bind(app, 'loadAdminBilling');
const openEditUser = bind(app, 'openEditUser');
const openCreateAdminUser = bind(app, 'openCreateAdminUser');
const saveCreateAdminUser = bind(app, 'saveCreateAdminUser');
const saveEditUser = bind(app, 'saveEditUser');
const loadAdminProviderKeys = bind(app, 'loadAdminProviderKeys');
const getAdminProviderKeyMetric = bind(app, 'getAdminProviderKeyMetric');
const providerKeyStatusTagType = bind(app, 'providerKeyStatusTagType');
const providerKeyStatusLabel = bind(app, 'providerKeyStatusLabel');
const openAddProviderKey = bind(app, 'openAddProviderKey');
const saveAddProviderKey = bind(app, 'saveAddProviderKey');
const deleteProviderKey = bind(app, 'deleteProviderKey');
const loadAdminProviderConfigs = bind(app, 'loadAdminProviderConfigs');
const openAddConfig = bind(app, 'openAddConfig');
const openEditConfig = bind(app, 'openEditConfig');
const saveConfig = bind(app, 'saveConfig');
const toggleProvider = bind(app, 'toggleProvider');
const deleteProviderConfig = bind(app, 'deleteProviderConfig');
const loadAdminTodayStats = bind(app, 'loadAdminTodayStats');
const loadAdminModelUsage = bind(app, 'loadAdminModelUsage');
const viewUserBilling = bind(app, 'viewUserBilling');
const openResetPassword = bind(app, 'openResetPassword');
const saveResetPassword = bind(app, 'saveResetPassword');
const handleDeleteUser = bind(app, 'handleDeleteUser');
const handleExportBillingCsv = bind(app, 'handleExportBillingCsv');
const loadAdminBillingWithDates = bind(app, 'loadAdminBillingWithDates');
const loadAdminProviderKeyCounts = bind(app, 'loadAdminProviderKeyCounts');
const loadAdminSettings = bind(app, 'loadAdminSettings');
const loadAdminModelTiers = bind(app, 'loadAdminModelTiers');
const openEditTier = bind(app, 'openEditTier');
const saveTierEdit = bind(app, 'saveTierEdit');
const deleteAdminTier = bind(app, 'deleteAdminTier');
const modelTierSearch = bind(app, 'modelTierSearch');
const modelTierTagFilter = bind(app, 'modelTierTagFilter');
const filteredModelTierRows = bind(app, 'filteredModelTierRows');
const unassignedCount = bind(app, 'unassignedCount');
const changeModelTier = bind(app, 'changeModelTier');
const tierRows = bind(app, 'tierRows');
const tierTagType = bind(app, 'tierTagType');
const defaultPricePrompt = bind(app, 'defaultPricePrompt');
const defaultPriceCompletion = bind(app, 'defaultPriceCompletion');
const adminDefaultPromptPrice = bind(app, 'adminDefaultPromptPrice');
const adminDefaultCompletionPrice = bind(app, 'adminDefaultCompletionPrice');
const initDefaultPriceFields = bind(app, 'initDefaultPriceFields');
const saveDefaultPrices = bind(app, 'saveDefaultPrices');
const openEditSetting = bind(app, 'openEditSetting');
const toggleModelTag = bind(app, 'toggleModelTag');
const toggleSettingTextMode = bind(app, 'toggleSettingTextMode');
const saveEditSetting = bind(app, 'saveEditSetting');
const adminRouterRules = bind(app, 'adminRouterRules');
const adminRouterEditDialog = bind(app, 'adminRouterEditDialog');
const adminRouterEditIntent = bind(app, 'adminRouterEditIntent');
const adminRouterEditModels = bind(app, 'adminRouterEditModels');
const loadAdminRouterRules = bind(app, 'loadAdminRouterRules');
const openAdminRouterEdit = bind(app, 'openAdminRouterEdit');
const saveAdminRouterRule = bind(app, 'saveAdminRouterRule');
const deleteAdminRouterRule = bind(app, 'deleteAdminRouterRule');
const loadAdminDailyUsage = bind(app, 'loadAdminDailyUsage');
const getModelTags = bind(app, 'getModelTags');
</script>

<template>
        <div class="page-header">
          <div class="header-left"><strong>管理后台</strong></div>
          <div class="header-right">
            <el-tag v-if="isAdmin" type="warning" effect="dark">管理员</el-tag>
          </div>
        </div>

        <div class="admin-page-content">
          <el-tabs v-model="adminTab" @tab-change="(tab: string | number) => {
            if (tab === 'dashboard') { loadAdminStats(); loadAdminDailyUsage(); loadAdminTodayStats(); loadAdminModelUsage(); }
            else if (tab === 'users') loadAdminUsers();
            else if (tab === 'billing') loadAdminBilling();
            else if (tab === 'modelstats') loadAdminModelUsage();
            else if (tab === 'modeltiers') { loadAdminModelTiers(); if (models.length === 0) loadModels(); refreshBillingData().then(() => initDefaultPriceFields()); }
            else if (tab === 'providers') { loadAdminProviderConfigs(); loadAdminProviderKeyCounts(); }
            else if (tab === 'apikeys') { loadAdminProviderKeys(); loadAdminProviderConfigs(); }
            else if (tab === 'settings') { loadAdminSettings(); }
            else if (tab === 'router') { loadAdminRouterRules(); }
          }">
            <!-- Dashboard Tab -->
            <el-tab-pane label="概览" name="dashboard">
              <div class="admin-stats-grid">
                <div class="admin-stat-card">
                  <div class="admin-stat-icon" style="background:#eff6ff"><el-icon :size="22" color="#3b82f6"><UserFilled /></el-icon></div>
                  <div class="admin-stat-body">
                    <div class="admin-stat-value">{{ adminStats ? adminStats.totalUsers : '—' }}</div>
                    <div class="admin-stat-label">用户总数</div>
                  </div>
                </div>
                <div class="admin-stat-card">
                  <div class="admin-stat-icon" style="background:#f0fdf4"><el-icon :size="22" color="#22c55e"><Plus /></el-icon></div>
                  <div class="admin-stat-body">
                    <div class="admin-stat-value">{{ adminStats ? adminStats.newUsersToday : '—' }}</div>
                    <div class="admin-stat-label">今日新增</div>
                  </div>
                </div>
                <div class="admin-stat-card">
                  <div class="admin-stat-icon" style="background:#fef3c7"><el-icon :size="22" color="#f59e0b"><Coin /></el-icon></div>
                  <div class="admin-stat-body">
                    <div class="admin-stat-value">{{ adminStats ? '¥' + adminStats.totalRevenue.toFixed(2) : '—' }}</div>
                    <div class="admin-stat-label">总收入</div>
                  </div>
                </div>
                <div class="admin-stat-card">
                  <div class="admin-stat-icon" style="background:#faf5ff"><el-icon :size="22" color="#a855f7"><TrendCharts /></el-icon></div>
                  <div class="admin-stat-body">
                    <div class="admin-stat-value">{{ adminStats ? adminStats.totalRequests : '—' }}</div>
                    <div class="admin-stat-label">请求总数</div>
                  </div>
                </div>
                <div class="admin-stat-card">
                  <div class="admin-stat-icon" style="background:#fff1f2"><el-icon :size="22" color="#f43f5e"><Cpu /></el-icon></div>
                  <div class="admin-stat-body">
                    <div class="admin-stat-value">{{ adminStats ? adminStats.activeModels : '—' }}</div>
                    <div class="admin-stat-label">活跃模型</div>
                  </div>
                </div>
              </div>

              <div class="admin-stats-grid" style="margin-top:12px">
                <div class="admin-stat-card">
                  <div class="admin-stat-icon" style="background:#ecfdf5"><el-icon :size="22" color="#10b981"><Coin /></el-icon></div>
                  <div class="admin-stat-body">
                    <div class="admin-stat-value">{{ adminTodayStats ? '¥' + adminTodayStats.revenue.toFixed(4) : '—' }}</div>
                    <div class="admin-stat-label">今日收入</div>
                  </div>
                </div>
                <div class="admin-stat-card">
                  <div class="admin-stat-icon" style="background:#f0f9ff"><el-icon :size="22" color="#0ea5e9"><TrendCharts /></el-icon></div>
                  <div class="admin-stat-body">
                    <div class="admin-stat-value">{{ adminTodayStats ? adminTodayStats.requests : '—' }}</div>
                    <div class="admin-stat-label">今日请求</div>
                  </div>
                </div>
                <div class="admin-stat-card">
                  <div class="admin-stat-icon" style="background:#fdf4ff"><el-icon :size="22" color="#d946ef"><Cpu /></el-icon></div>
                  <div class="admin-stat-body">
                    <div class="admin-stat-value">{{ adminStats ? adminStats.totalTokens.toLocaleString() : '—' }}</div>
                    <div class="admin-stat-label">总 Token 数</div>
                  </div>
                </div>
                <div class="admin-stat-card">
                  <div class="admin-stat-icon" style="background:#fefce8"><el-icon :size="22" color="#eab308"><TrendCharts /></el-icon></div>
                  <div class="admin-stat-body">
                    <div class="admin-stat-value">{{ adminTodayStats ? adminTodayStats.tokens.toLocaleString() : '—' }}</div>
                    <div class="admin-stat-label">今日 Token</div>
                  </div>
                </div>
              </div>

              <el-card shadow="never" class="admin-chart-card">
                <template #header>
                  <div style="display:flex;align-items:center;justify-content:space-between">
                    <span style="font-weight:600">用量趋势</span>
                    <el-segmented
                      :model-value="String(adminChartDays)"
                      @change="(val: string | number) => { adminChartDays = Number(val); loadAdminDailyUsage(); }"
                      :options="[
                        { label: '7天', value: '7' },
                        { label: '30天', value: '30' },
                        { label: '90天', value: '90' },
                      ]"
                      size="small"
                    />
                  </div>
                </template>
                <div v-if="adminDailyUsage.length > 0" id="admin-chart" style="width:100%;height:300px"></div>
                <el-empty v-else description="暂无用量数据" :image-size="48" style="padding:40px 0" />
              </el-card>

              <el-card shadow="never" class="admin-chart-card">
                <template #header><span style="font-weight:600">模型用量排行 (Top 10)</span></template>
                <div v-if="adminModelUsage.length > 0" id="admin-model-chart" style="width:100%;height:320px"></div>
                <el-empty v-else description="暂无模型用量数据" :image-size="48" style="padding:40px 0" />
              </el-card>
            </el-tab-pane>

            <!-- Users Tab -->
            <el-tab-pane label="用户管理" name="users">
              <div class="admin-toolbar">
                <el-input v-model="adminUsersSearch" placeholder="搜索用户名或邮箱" clearable :prefix-icon="Search" style="width: 260px" @keyup.enter="adminUsersPage = 1; loadAdminUsers()" @clear="adminUsersPage = 1; loadAdminUsers()" />
                <el-button type="primary" plain @click="adminUsersPage = 1; loadAdminUsers()">搜索</el-button>
                <el-button type="primary" :icon="Plus" @click="openCreateAdminUser()">创建用户</el-button>
              </div>
              <el-table :data="adminUsers" stripe size="small" class="admin-table" v-loading="adminUsers.length === 0 && adminUsersTotal === 0">
                <el-table-column prop="username" label="用户名" min-width="100" />
                <el-table-column prop="email" label="邮箱" min-width="160">
                  <template #default="{ row }">{{ row.email || '-' }}</template>
                </el-table-column>
                <el-table-column prop="emailVerified" label="邮箱验证" width="90" align="center">
                  <template #default="{ row }">
                    <el-tag :type="row.emailVerified ? 'success' : 'warning'" size="small">
                      {{ row.emailVerified ? '已验证' : '未验证' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="role" label="角色" width="70">
                  <template #default="{ row }">
                    <el-tag :type="row.role === 'admin' ? 'warning' : 'info'" size="small">{{ row.role }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="credits" label="余额" width="100">
                  <template #default="{ row }">{{ row.credits.toFixed(4) }}</template>
                </el-table-column>
                <el-table-column prop="totalSpent" label="累计消费" width="100">
                  <template #default="{ row }">{{ row.totalSpent.toFixed(4) }}</template>
                </el-table-column>
                <el-table-column prop="requestCount" label="请求数" width="80" align="center" />
                <el-table-column prop="invitationCode" label="邀请码" width="100">
                  <template #default="{ row }">
                    <span v-if="row.invitationCode" class="copyable-code">{{ row.invitationCode }}</span>
                    <span v-else style="color:#999">-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="createdAt" label="注册时间" min-width="150">
                  <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="60" fixed="right" align="center">
                  <template #default="{ row }">
                    <el-dropdown trigger="click" @command="(cmd: string) => { if (cmd === 'edit') openEditUser(row); else if (cmd === 'billing') viewUserBilling(row.username); else if (cmd === 'pwd') openResetPassword(row); else if (cmd === 'delete') handleDeleteUser(row.id); }">
                      <el-button :icon="MoreFilled" link type="primary" />
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item command="edit"><el-icon><EditPen /></el-icon> 编辑</el-dropdown-item>
                          <el-dropdown-item command="billing"><el-icon><DataAnalysis /></el-icon> 账单</el-dropdown-item>
                          <el-dropdown-item command="pwd"><el-icon><Setting /></el-icon> 重置密码</el-dropdown-item>
                          <el-dropdown-item v-if="row.role !== 'admin'" command="delete" divided style="color:#f56c6c"><el-icon><Delete /></el-icon> 删除</el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                  </template>
                </el-table-column>
              </el-table>
              <el-pagination
                v-if="adminUsersTotal > 50"
                v-model:current-page="adminUsersPage"
                :page-size="50"
                :total="adminUsersTotal"
                layout="total, prev, pager, next"
                class="admin-pagination"
                @current-change="loadAdminUsers()"
              />
            </el-tab-pane>

            <!-- Billing Tab -->
            <el-tab-pane label="计费明细" name="billing">
              <div class="admin-toolbar" style="flex-wrap:wrap;gap:8px">
                <el-input v-model="adminBillingFilterUsername" placeholder="用户名" clearable style="width: 180px" @keyup.enter="loadAdminBillingWithDates()" @clear="loadAdminBillingWithDates()" />
                <el-input v-model="adminBillingFilterModel" placeholder="模型" clearable style="width: 140px" @keyup.enter="loadAdminBillingWithDates()" @clear="loadAdminBillingWithDates()" />
                <el-input v-model="adminBillingFilterProvider" placeholder="Provider" clearable style="width: 130px" @keyup.enter="loadAdminBillingWithDates()" @clear="loadAdminBillingWithDates()" />
                <el-date-picker v-model="adminBillingFromDate" type="date" placeholder="开始日期" value-format="YYYY-MM-DD" style="width:150px" clearable @change="loadAdminBillingWithDates()" />
                <el-date-picker v-model="adminBillingToDate" type="date" placeholder="结束日期" value-format="YYYY-MM-DD" style="width:150px" clearable @change="loadAdminBillingWithDates()" />
                <el-button type="primary" plain @click="loadAdminBillingWithDates()">筛选</el-button>
                <el-button type="success" plain @click="handleExportBillingCsv()">导出 CSV</el-button>
              </div>
              <el-table :data="adminBilling" stripe size="small" class="admin-table">
                <el-table-column prop="username" label="用户" min-width="90" />
                <el-table-column prop="model" label="模型" min-width="140" />
                <el-table-column prop="requestType" label="类型" width="70" />
                <el-table-column prop="providerName" label="Provider" width="110">
                  <template #default="{ row }">{{ row.providerName || '-' }}</template>
                </el-table-column>
                <el-table-column prop="providerKeyName" label="出站 Key" min-width="140">
                  <template #default="{ row }">
                    <div style="display:flex;gap:6px;align-items:center;min-width:0">
                      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ row.providerKeyName || '-' }}</span>
                      <el-tag v-if="row.providerKeyPrefix" size="small" type="info">{{ row.providerKeyPrefix }}</el-tag>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="promptTokens" label="输入Tokens" width="100" align="right" />
                <el-table-column prop="completionTokens" label="输出Tokens" width="100" align="right" />
                <el-table-column prop="totalTokens" label="总Tokens" width="100" align="right" />
                <el-table-column prop="cost" label="费用" width="100" align="right">
                  <template #default="{ row }">{{ row.cost.toFixed(6) }}</template>
                </el-table-column>
                <el-table-column prop="createdAt" label="时间" min-width="160">
                  <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
                </el-table-column>
              </el-table>
              <el-pagination
                v-if="adminBillingTotal > 50"
                v-model:current-page="adminBillingPage"
                :page-size="50"
                :total="adminBillingTotal"
                layout="total, prev, pager, next"
                class="admin-pagination"
                @current-change="loadAdminBilling()"
              />
              <div v-if="adminBilling.length > 0" class="admin-billing-summary">
                <span>本页合计：</span>
                <span>总 Token: <strong>{{ adminBilling.reduce((s, r) => s + r.totalTokens, 0).toLocaleString() }}</strong></span>
                <span>总费用: <strong>¥{{ adminBilling.reduce((s, r) => s + r.cost, 0).toFixed(6) }}</strong></span>
                <span style="color:#909399">（共 {{ adminBillingTotal }} 条记录）</span>
              </div>
            </el-tab-pane>


            <!-- Model Stats Tab -->
            <el-tab-pane label="用量统计" name="modelstats">
              <el-table :data="adminModelUsage" stripe size="small" class="admin-table" :default-sort="{ prop: 'requests', order: 'descending' }">
                <el-table-column prop="model" label="模型" min-width="180" sortable />
                <el-table-column prop="providerName" label="服务商" width="120" sortable />
                <el-table-column prop="requests" label="请求数" width="100" align="right" sortable />
                <el-table-column prop="promptTokens" label="输入 Token" width="120" align="right" sortable>
                  <template #default="{ row }">{{ row.promptTokens.toLocaleString() }}</template>
                </el-table-column>
                <el-table-column prop="completionTokens" label="输出 Token" width="120" align="right" sortable>
                  <template #default="{ row }">{{ row.completionTokens.toLocaleString() }}</template>
                </el-table-column>
                <el-table-column prop="totalTokens" label="总 Token" width="120" align="right" sortable>
                  <template #default="{ row }">{{ row.totalTokens.toLocaleString() }}</template>
                </el-table-column>
                <el-table-column prop="totalCost" label="总费用" width="120" align="right" sortable>
                  <template #default="{ row }">¥{{ row.totalCost.toFixed(6) }}</template>
                </el-table-column>
                <el-table-column prop="avgCost" label="平均费用" width="120" align="right" sortable>
                  <template #default="{ row }">¥{{ row.avgCost.toFixed(6) }}</template>
                </el-table-column>
              </el-table>
              <el-empty v-if="adminModelUsage.length === 0" description="暂无模型用量数据" :image-size="48" />
            </el-tab-pane>

            <!-- Provider Config Tab -->
            <el-tab-pane label="服务商" name="providers">
              <div style="margin-bottom: 16px">
                <el-button type="primary" :icon="Plus" @click="openAddConfig()">添加服务商</el-button>
              </div>
              <el-table :data="adminProviderConfigs" stripe size="small" class="admin-table" empty-text="暂无服务商配置">
                <el-table-column prop="displayName" label="名称" min-width="140" />
                <el-table-column prop="providerName" label="标识符" width="120" />
                <el-table-column prop="baseUrl" label="端点" min-width="220">
                  <template #default="{ row }"><span style="font-size:12px;color:#909399">{{ row.baseUrl }}</span></template>
                </el-table-column>
                <el-table-column label="模型数" width="80" align="center">
                  <template #default="{ row }">{{ row.models ? row.models.split(',').filter(Boolean).length : 0 }}</template>
                </el-table-column>
                <el-table-column label="Key 数" width="80" align="center">
                  <template #default="{ row }">
                    <el-tag size="small" :type="adminProviderKeyCounts[row.providerName] > 0 ? 'success' : 'info'">
                      {{ adminProviderKeyCounts[row.providerName] ?? '...' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="状态" width="80" align="center">
                  <template #default="{ row }">
                    <el-switch :model-value="row.enabled" size="small" @click="toggleProvider(row)" />
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="140" fixed="right">
                  <template #default="{ row }">
                    <el-button type="primary" link :icon="EditPen" @click="openEditConfig(row)">编辑</el-button>
                    <el-popconfirm title="确定要删除该服务商及其所有 Key 吗？" @confirm="deleteProviderConfig(row.id)">
                      <template #reference>
                        <el-button type="danger" link :icon="Delete">删除</el-button>
                      </template>
                    </el-popconfirm>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <!-- API Key Management Tab -->
            <el-tab-pane label="API Key" name="apikeys">
              <div style="margin-bottom: 16px;display:flex;gap:12px;align-items:center">
                <el-button type="primary" :icon="Plus" @click="openAddProviderKey()">添加 Key</el-button>
                <el-select v-model="adminApiKeyProviderFilter" placeholder="按 Provider 筛选" clearable style="width:200px" @change="loadAdminProviderKeys()">
                  <el-option v-for="cfg in adminProviderConfigs" :key="cfg.providerName" :label="cfg.displayName" :value="cfg.providerName" />
                </el-select>
                <el-button :icon="Refresh" @click="loadAdminProviderKeys()">刷新指标</el-button>
              </div>
              <div v-if="adminProviderKeyMetrics.length" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:12px">
                <div v-for="metric in adminProviderKeyMetrics" :key="metric.providerName" style="border:1px solid #e5e7eb;border-radius:8px;padding:10px;background:#fff">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                    <strong>{{ metric.providerName }}</strong>
                    <el-tag size="small" type="info">{{ metric.pool.strategy }}</el-tag>
                  </div>
                  <div style="display:flex;gap:10px;font-size:12px;color:#64748b;flex-wrap:wrap">
                    <span>总数 {{ metric.pool.size }}</span>
                    <span>可用 {{ metric.pool.availableCount }}</span>
                    <span>半开 {{ metric.pool.halfOpenCount }}</span>
                    <span>熔断 {{ metric.pool.circuitOpenCount }}</span>
                    <span>禁用 {{ metric.pool.disabledCount }}</span>
                  </div>
                </div>
              </div>
              <el-table :data="adminProviderKeys" stripe size="small" class="admin-table" empty-text="暂无 Provider API Key，请添加或检查 .env 配置">
                <el-table-column prop="providerName" label="Provider" width="130" />
                <el-table-column prop="name" label="名称" min-width="140" />
                <el-table-column label="API Key" min-width="280">
                  <template #default="{ row }">
                    <code style="font-size:12px;word-break:break-all;user-select:all">{{ row.apiKey }}</code>
                  </template>
                </el-table-column>
                <el-table-column label="状态" width="90" align="center">
                  <template #default="{ row }">
                    <el-tag size="small" :type="providerKeyStatusTagType(getAdminProviderKeyMetric(row)?.status)">
                      {{ providerKeyStatusLabel(getAdminProviderKeyMetric(row)?.status) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="调用" width="80" align="right">
                  <template #default="{ row }">{{ getAdminProviderKeyMetric(row)?.usageCount ?? 0 }}</template>
                </el-table-column>
                <el-table-column label="成功率" width="90" align="right">
                  <template #default="{ row }">{{ (((getAdminProviderKeyMetric(row)?.successRate ?? 0) * 100).toFixed(1)) }}%</template>
                </el-table-column>
                <el-table-column label="失败率" width="90" align="right">
                  <template #default="{ row }">{{ (((getAdminProviderKeyMetric(row)?.failureRate ?? 0) * 100).toFixed(1)) }}%</template>
                </el-table-column>
                <el-table-column label="熔断" width="80" align="right">
                  <template #default="{ row }">{{ getAdminProviderKeyMetric(row)?.circuitBreakerCount ?? 0 }}</template>
                </el-table-column>
                <el-table-column label="最近错误" min-width="180">
                  <template #default="{ row }">
                    <span style="font-size:12px;color:#64748b;word-break:break-all">{{ getAdminProviderKeyMetric(row)?.lastError || '-' }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="createdAt" label="创建时间" width="170">
                  <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="100" fixed="right">
                  <template #default="{ row }">
                    <el-popconfirm title="确定要删除该 Key 吗？将立即回退到 .env 中的 Key。" @confirm="deleteProviderKey(row.id)">
                      <template #reference>
                        <el-button type="danger" link :icon="Delete">删除</el-button>
                      </template>
                    </el-popconfirm>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <!-- Model → Tier Mapping Tab -->
            <el-tab-pane label="定价" name="modeltiers">
              <el-alert v-if="Object.keys(adminModelTiers.tiers).length === 0" type="warning" show-icon :closable="false"
                title="还没有定价档位，请先点击「新增定价档位」创建至少一个档位" style="margin-bottom:16px" />

              <!-- Tier pricing table -->
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <span style="font-weight:600;font-size:14px">定价档位</span>
                <el-button size="small" @click="openEditTier()">新增档位</el-button>
              </div>

              <el-table v-if="tierRows.length > 0" :data="tierRows" stripe size="small" class="admin-table" style="margin-bottom:20px">
                <el-table-column label="档位" width="160">
                  <template #default="{ row }">
                    <el-tag :type="tierTagType(row.key)" size="small">{{ row.label }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="输入价格 (元/千token)" width="180" align="center">
                  <template #default="{ row }">{{ row.promptPrice.toFixed(4) }}</template>
                </el-table-column>
                <el-table-column label="输出价格 (元/千token)" width="180" align="center">
                  <template #default="{ row }">{{ row.completionPrice.toFixed(4) }}</template>
                </el-table-column>
                <el-table-column label="模型数" width="80" align="center">
                  <template #default="{ row }">{{ row.models.length }}</template>
                </el-table-column>
                <el-table-column label="控制台模型举例" min-width="240">
                  <template #default="{ row }">
                    <span style="font-size:12px;word-break:break-all">{{ row.sampleModels || '-' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="120">
                  <template #default="{ row }">
                    <el-button size="small" link @click="openEditTier(row.key)">编辑</el-button>
                    <el-popconfirm title="删除此档位？" @confirm="deleteAdminTier(row.key)">
                      <template #reference>
                        <el-button size="small" link type="danger">删除</el-button>
                      </template>
                    </el-popconfirm>
                  </template>
                </el-table-column>
              </el-table>

              <!-- Model → Tier Mapping Table -->
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <div style="display:flex;align-items:center;gap:12px">
                  <span style="font-weight:600;font-size:14px">模型映射</span>
                  <el-input v-model="modelTierSearch" placeholder="搜索模型..." size="small" clearable style="width:200px" :prefix-icon="Search" />
                  <el-button-group size="small">
                    <el-button :type="modelTierTagFilter === '' ? 'primary' : ''" @click="modelTierTagFilter = ''">全部</el-button>
                    <el-button :type="modelTierTagFilter === 'language' ? 'primary' : ''" @click="modelTierTagFilter = 'language'">语言</el-button>
                    <el-button :type="modelTierTagFilter === 'vision' ? 'primary' : ''" @click="modelTierTagFilter = 'vision'">视觉</el-button>
                    <el-button :type="modelTierTagFilter === 'audio' ? 'primary' : ''" @click="modelTierTagFilter = 'audio'">音频</el-button>
                  </el-button-group>
                </div>
                <span style="font-size:12px;color:#9ca3af">
                  未分配使用默认价（入 {{ defaultPricePrompt.toFixed(4) }} / 出 {{ defaultPriceCompletion.toFixed(4) }}）
                </span>
              </div>

              <el-table :data="filteredModelTierRows" stripe size="small" class="admin-table" max-height="480">
                <el-table-column prop="modelId" label="模型" min-width="200" />
                <el-table-column label="标签" width="110">
                  <template #default="{ row }">
                    <el-tag v-if="getModelTags(row.modelId).includes('language')" size="small" type="info" style="margin-right:4px">语言</el-tag>
                    <el-tag v-if="getModelTags(row.modelId).includes('vision')" size="small" type="success" style="margin-right:4px">视觉</el-tag>
                    <el-tag v-if="getModelTags(row.modelId).includes('audio')" size="small" type="success">音频</el-tag>
                    <span v-if="getModelTags(row.modelId).length === 0" style="color:#c0c4cc">-</span>
                  </template>
                </el-table-column>
                <el-table-column label="定价档位" width="180">
                  <template #default="{ row }">
                    <el-select v-model="row.tierKey" size="small" placeholder="未分配" clearable style="width:100%"
                      @change="(val: string) => changeModelTier(row.modelId, val || '')">
                      <el-option v-for="t in tierRows" :key="t.key" :label="t.label" :value="t.key">
                        <span>{{ t.label }}</span>
                        <span style="float:right;color:#9ca3af;font-size:11px">入{{ t.promptPrice.toFixed(3) }} 出{{ t.completionPrice.toFixed(3) }}</span>
                      </el-option>
                    </el-select>
                  </template>
                </el-table-column>
                <el-table-column label="输入价格" width="110" align="center">
                  <template #default="{ row }">{{ row.promptPrice.toFixed(4) }}</template>
                </el-table-column>
                <el-table-column label="输出价格" width="110" align="center">
                  <template #default="{ row }">{{ row.completionPrice.toFixed(4) }}</template>
                </el-table-column>
              </el-table>

              <div style="margin-top:8px;font-size:11px;color:#9ca3af">
                共 {{ models.length }} 个模型，{{ unassignedCount }} 个未分配
              </div>

              <!-- Default prices (for unassigned models) -->
              <el-card shadow="never" style="margin-top:16px;background:var(--el-fill-color-lighter, #f8fafc)">
                <template #header><strong>默认价格</strong><span style="font-size:12px;color:#9ca3af;margin-left:8px">未分配档位的模型使用此价格</span></template>
                <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap">
                  <div>
                    <div style="font-size:12px;color:#909399;margin-bottom:4px">输入价格（元/千token）</div>
                    <el-input-number v-model="adminDefaultPromptPrice" :min="0" :step="0.001" :precision="4" style="width:180px" size="small" />
                  </div>
                  <div>
                    <div style="font-size:12px;color:#909399;margin-bottom:4px">输出价格（元/千token）</div>
                    <el-input-number v-model="adminDefaultCompletionPrice" :min="0" :step="0.001" :precision="4" style="width:180px" size="small" />
                  </div>
                  <el-button type="primary" size="small" @click="saveDefaultPrices()">保存默认价格</el-button>
                </div>
              </el-card>
            </el-tab-pane>

            <!-- Page Settings Tab -->
            <el-tab-pane label="系统配置" name="settings">
              <el-table :data="adminSettings.filter((s: any) => s.key !== 'model_tier_mapping')" stripe size="small" class="admin-table">
                <el-table-column prop="description" label="配置" min-width="250" />
                <el-table-column prop="value" label="值" min-width="300">
                  <template #default="{ row }">
                    <span style="font-size:12px;word-break:break-all">{{ row.value.length > 80 ? row.value.slice(0, 80) + '...' : row.value }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="80" fixed="right">
                  <template #default="{ row }">
                    <el-button type="primary" link :icon="EditPen" @click="openEditSetting(row)">编辑</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <!-- Router Rules Tab -->
            <el-tab-pane label="路由规则" name="router">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <span style="font-size:13px;color:#64748b">配置各任务意图对应的模型列表（逗号分隔），Auto 路由时按意图匹配</span>
                <el-button size="small" type="primary" @click="openAdminRouterEdit()">新增规则</el-button>
              </div>
              <el-table :data="adminRouterRules" size="small" stripe class="admin-table">
                <el-table-column prop="intent" label="意图" width="140">
                  <template #default="{ row }">
                    <el-tag size="small">{{ row.intent }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="models" label="模型列表">
                  <template #default="{ row }">
                    <span style="font-size:12px;word-break:break-all">{{ (row.models || []).join(' → ') }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="140" fixed="right">
                  <template #default="{ row }">
                    <el-button type="primary" link size="small" @click="openAdminRouterEdit(row.intent, row.models)">编辑</el-button>
                    <el-button type="danger" link size="small" @click="deleteAdminRouterRule(row.intent)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
              <el-empty v-if="adminRouterRules.length === 0" description="暂无路由规则，点击「新增规则」添加" :image-size="60" />
            </el-tab-pane>

            <!-- Router Rule Edit Dialog -->
            <el-dialog v-model="adminRouterEditDialog" title="编辑路由规则" width="500px">
              <el-form label-width="80px">
                <el-form-item label="意图标识">
                  <el-input v-model="adminRouterEditIntent" placeholder="如 coding, translation, general" />
                  <div style="font-size:11px;color:#909399;margin-top:2px">支持: coding, translation, creative, reasoning, vision, summary, data, general</div>
                </el-form-item>
                <el-form-item label="模型列表">
                  <el-input v-model="adminRouterEditModels" type="textarea" :rows="3" placeholder="逗号分隔，如: qwen-plus, deepseek-v4-flash" />
                  <div style="font-size:11px;color:#909399;margin-top:2px">按优先级排列，排前面的优先使用</div>
                </el-form-item>
              </el-form>
              <template #footer>
                <el-button @click="adminRouterEditDialog = false">取消</el-button>
                <el-button type="primary" @click="saveAdminRouterRule()">保存</el-button>
              </template>
            </el-dialog>
          </el-tabs>

          <!-- Edit User Dialog -->
          <el-dialog v-model="adminEditUserDialog" title="编辑用户" width="460px">
            <el-form label-position="top">
              <el-form-item label="用户名">
                <el-input :model-value="adminEditUserUsername" disabled />
              </el-form-item>
              <el-form-item label="余额 (元)">
                <el-input-number v-model="adminEditUserCredits" :min="0" :precision="4" :step="1" style="width: 100%" />
              </el-form-item>
              <el-form-item label="角色">
                <el-select v-model="adminEditUserRole" style="width: 100%">
                  <el-option label="普通用户 (user)" value="user" />
                  <el-option label="管理员 (admin)" value="admin" />
                </el-select>
              </el-form-item>
              <el-form-item label="邮箱验证">
                <el-switch v-model="adminEditUserEmailVerified" active-text="已验证" inactive-text="未验证" />
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="adminEditUserDialog = false">取消</el-button>
              <el-button type="primary" @click="saveEditUser()">保存</el-button>
            </template>
          </el-dialog>

          <!-- Create User Dialog -->
          <el-dialog v-model="adminCreateUserDialog" title="创建用户" width="480px">
            <el-form label-position="top">
              <el-form-item label="用户名">
                <el-input v-model="adminCreateUserForm.username" placeholder="请输入用户名" />
              </el-form-item>
              <el-form-item label="邮箱">
                <el-input v-model="adminCreateUserForm.email" placeholder="请输入邮箱" />
              </el-form-item>
              <el-form-item label="密码">
                <el-input v-model="adminCreateUserForm.password" type="password" show-password placeholder="至少 4 位" />
              </el-form-item>
              <el-form-item label="余额 (元)">
                <el-input-number v-model="adminCreateUserForm.credits" :min="0" :precision="4" :step="1" style="width: 100%" />
              </el-form-item>
              <el-form-item label="角色">
                <el-select v-model="adminCreateUserForm.role" style="width: 100%">
                  <el-option label="普通用户 (user)" value="user" />
                  <el-option label="管理员 (admin)" value="admin" />
                </el-select>
              </el-form-item>
              <el-form-item label="邮箱验证">
                <el-switch v-model="adminCreateUserForm.emailVerified" active-text="已验证" inactive-text="未验证" />
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="adminCreateUserDialog = false">取消</el-button>
              <el-button type="primary" :loading="adminCreateUserSaving" @click="saveCreateAdminUser()">创建</el-button>
            </template>
          </el-dialog>

          <!-- Add Provider Key Dialog -->
          <el-dialog v-model="adminAddKeyDialog" title="添加 Provider API Key" width="500px">
            <el-form label-position="top">
              <el-form-item label="Provider">
                <el-select v-model="adminNewKeyProvider" style="width: 100%">
                  <el-option v-for="cfg in adminProviderConfigs" :key="cfg.providerName" :label="cfg.displayName + ' (' + cfg.providerName + ')'" :value="cfg.providerName" />
                </el-select>
              </el-form-item>
              <el-form-item label="名称（可选标签）">
                <el-input v-model="adminNewKeyName" placeholder="如: 生产环境 Key 1" />
              </el-form-item>
              <el-form-item label="API Key">
                <el-input v-model="adminNewKeyValue" type="password" show-password placeholder="sk-xxxxxxxx" />
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="adminAddKeyDialog = false">取消</el-button>
              <el-button type="primary" @click="saveAddProviderKey()" :disabled="!adminNewKeyValue.trim()">添加</el-button>
            </template>
          </el-dialog>

          <!-- Edit Provider Config Dialog -->
          <el-dialog v-model="adminEditConfigDialog" :title="adminIsNewConfig ? '添加服务商' : '编辑服务商'" width="560px">
            <el-form label-position="top">
              <el-row :gutter="16">
                <el-col :span="12">
                  <el-form-item label="标识符 (providerName)">
                    <el-input v-model="adminEditConfigForm.providerName" placeholder="如: openai" :disabled="!adminIsNewConfig" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="显示名称">
                    <el-input v-model="adminEditConfigForm.displayName" placeholder="如: OpenAI" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-form-item label="端点 URL (baseUrl)">
                <el-input v-model="adminEditConfigForm.baseUrl" placeholder="如: https://api.openai.com/v1" />
              </el-form-item>
              <el-form-item label="模型列表 (逗号分隔)">
                <el-input v-model="adminEditConfigForm.models" type="textarea" :rows="2" placeholder="如: gpt-4o-mini,gpt-4o,gpt-4.1" />
              </el-form-item>
              <el-row :gutter="16">
                <el-col :span="8">
                  <el-form-item label="模型前缀 (可选)">
                    <el-input v-model="adminEditConfigForm.modelPrefix" placeholder="如: mimo" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="超时 (ms)">
                    <el-input-number v-model="adminEditConfigForm.timeoutMs" :min="1000" :max="120000" :step="1000" style="width:100%" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="重试次数">
                    <el-input-number v-model="adminEditConfigForm.retryCount" :min="0" :max="10" style="width:100%" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="16">
                <el-col :span="12">
                  <el-form-item label="Auth Header 名称">
                    <el-input v-model="adminEditConfigForm.authHeader" placeholder="Authorization" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="Auth 前缀">
                    <el-input v-model="adminEditConfigForm.authPrefix" placeholder="Bearer" />
                  </el-form-item>
                </el-col>
              </el-row>
            </el-form>
            <template #footer>
              <el-button @click="adminEditConfigDialog = false">取消</el-button>
              <el-button type="primary" @click="saveConfig()">保存</el-button>
            </template>
          </el-dialog>

          <!-- Reset Password Dialog -->
          <el-dialog v-model="adminResetPwdDialog" title="重置用户密码" width="420px">
            <el-form label-position="top">
              <el-form-item label="用户名">
                <el-input :model-value="adminResetPwdUsername" disabled />
              </el-form-item>
              <el-form-item label="新密码">
                <el-input v-model="adminResetPwdValue" type="password" show-password placeholder="输入新密码（至少 4 位）" />
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="adminResetPwdDialog = false">取消</el-button>
              <el-button type="primary" @click="saveResetPassword()" :disabled="adminResetPwdValue.length < 4">确认重置</el-button>
            </template>
          </el-dialog>

          <!-- Edit Setting Dialog -->
          <el-dialog v-model="adminEditSettingDialog" title="编辑配置" :width="adminEditSettingKey === 'model_tags' ? '720px' : '600px'">
            <el-form label-position="top">
              <el-form-item label="配置键">
                <el-input :model-value="adminEditSettingKey" disabled />
              </el-form-item>
              <el-form-item :label="adminEditSettingDesc">
                <!-- Model tags editor -->
                <template v-if="adminEditSettingKey === 'model_tags'">
                  <el-table :data="realModels" stripe size="small" max-height="400" style="width:100%">
                    <el-table-column prop="id" label="模型" min-width="200" />
                    <el-table-column label="语言" width="70" align="center">
                      <template #default="{ row }">
                        <el-checkbox :model-value="(adminEditModelTags[row.id] || []).includes('language')" @change="(v: boolean) => toggleModelTag(row.id, 'language', v)" />
                      </template>
                    </el-table-column>
                    <el-table-column label="视觉" width="70" align="center">
                      <template #default="{ row }">
                        <el-checkbox :model-value="(adminEditModelTags[row.id] || []).includes('vision')" @change="(v: boolean) => toggleModelTag(row.id, 'vision', v)" />
                      </template>
                    </el-table-column>
                    <el-table-column label="音频" width="70" align="center">
                      <template #default="{ row }">
                        <el-checkbox :model-value="(adminEditModelTags[row.id] || []).includes('audio')" @change="(v: boolean) => toggleModelTag(row.id, 'audio', v)" />
                      </template>
                    </el-table-column>
                  </el-table>
                </template>
                <!-- Page models multi-select / text mode -->
                <template v-else-if="adminEditSettingKey.startsWith('page_models_')">
                  <div style="margin-bottom:8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:space-between">
                    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                      <template v-if="!adminEditSettingTextMode">
                        <el-tag :type="adminEditSettingModels.length === 0 ? 'success' : 'info'" size="small" style="cursor:pointer" @click="adminEditSettingModels = []">
                          {{ adminEditSettingModels.length === 0 ? '全部模型（已选中）' : '点击切换为全部模型' }}
                        </el-tag>
                        <span style="color:#909399;font-size:12px">按标签筛选：</span>
                        <el-tag v-for="tag in ['language','vision','audio']" :key="tag"
                          :effect="adminEditSettingTagFilter === tag ? 'dark' : 'plain'"
                          size="small" style="cursor:pointer"
                          @click="adminEditSettingTagFilter = adminEditSettingTagFilter === tag ? '' : tag">
                          {{ tag === 'language' ? '语言' : tag === 'vision' ? '视觉' : '音频' }}
                        </el-tag>
                      </template>
                    </div>
                    <el-button size="small" text type="primary" @click="toggleSettingTextMode()">
                      {{ adminEditSettingTextMode ? '多选模式' : '文本模式' }}
                    </el-button>
                  </div>
                  <el-select v-if="!adminEditSettingTextMode" v-model="adminEditSettingModels" multiple filterable collapse-tags collapse-tags-tooltip placeholder="选择可用模型（留空表示全部）" style="width:100%" :key="adminEditSettingTagFilter">
                    <el-option v-for="m in filteredModelsForSetting" :key="m.id" :label="m.id" :value="m.id">
                      <span>{{ m.id }}</span>
                      <el-tag v-for="t in getModelTags(m.id)" :key="t" size="small" :type="t === 'vision' ? 'warning' : t === 'audio' ? 'success' : 'info'" style="margin-left:4px">
                        {{ t === 'language' ? '语言' : t === 'vision' ? '视觉' : '音频' }}
                      </el-tag>
                    </el-option>
                  </el-select>
                  <el-input v-else v-model="adminEditSettingValue" type="textarea" :rows="6" placeholder="输入模型 ID，逗号分隔（* 表示全部）" />
                </template>
                <!-- Default textarea -->
                <el-input v-else v-model="adminEditSettingValue" type="textarea" :rows="4" />
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="adminEditSettingDialog = false">取消</el-button>
              <el-button type="primary" @click="saveEditSetting()">保存</el-button>
            </template>
          </el-dialog>

          <!-- Model Tier Edit Dialog -->
          <el-dialog v-model="adminTierEditDialog" :title="adminTierEditIsNew ? '新增档位' : '编辑档位'" width="480px">
            <el-form label-width="100px">
              <el-form-item label="档位标识">
                <el-input v-model="adminTierEditKey" placeholder="tier_xxx" :disabled="!adminTierEditIsNew" />
              </el-form-item>
              <el-form-item label="显示名称">
                <el-input v-model="adminTierEditLabel" placeholder="如 入门、主流、旗舰、超旗舰" />
              </el-form-item>
              <el-form-item label="输入价格">
                <el-input-number v-model="adminTierEditPromptPrice" :min="0" :step="0.001" :precision="4" style="width:100%" />
                <span style="font-size:11px;color:#9ca3af;margin-left:8px">元/千token</span>
              </el-form-item>
              <el-form-item label="输出价格">
                <el-input-number v-model="adminTierEditCompletionPrice" :min="0" :step="0.001" :precision="4" style="width:100%" />
                <span style="font-size:11px;color:#9ca3af;margin-left:8px">元/千token</span>
              </el-form-item>
              <el-form-item label="模型举例">
                <el-input
                  v-model="adminTierEditExamples"
                  type="textarea"
                  :rows="3"
                  resize="vertical"
                  placeholder="控制台计费规则展示用，例如 qwen-plus, deepseek-v4-flash"
                />
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="adminTierEditDialog = false">取消</el-button>
              <el-button type="primary" @click="saveTierEdit()">保存</el-button>
            </template>
          </el-dialog>

        </div>
</template>
