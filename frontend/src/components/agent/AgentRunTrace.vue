<script setup lang="ts">
import { formatTraceDisplayValue } from '../../utils/agent-trace';
import { computed, isRef, unref, onUnmounted, watch } from 'vue';
const props = defineProps<{ app: Record<string, any> }>();
const app = props.app;
const value = (key: string) => unref(app[key]);
const call = (key: string, ...args: any[]) => unref(app[key])?.(...args);
const model = (key: string) => computed({ get: () => value(key), set: v => { if (isRef(app[key])) app[key].value = v; else app[key] = v; } });
const tab = model('agentInvokePanelTab');
const comparisonId = model('agentComparisonRunId');
const historyFilter = model('agentRunHistoryFilter');
const historySort = model('agentRunHistorySort');
const run = computed(() => value('activeAgentRun'));
const step = computed(() => value('activeAgentTraceStep'));
const flow = computed(() => value('agentExecutionTraceFlow'));
const playing = computed(() => value('agentTraceReplayPlaying'));
const index = computed(() => value('agentTraceReplayIndex'));
const max = computed(() => value('agentTraceReplayMax'));
const snapshot = computed(() => value('agentTraceSnapshot'));
const comparison = computed(() => value('agentComparativeReplay'));
const sources = computed(() => value('agentContextSourceSummary'));
const failures = computed(() => value('agentFailedTraceSteps'));
const metrics = computed(() => value('agentHarnessMetrics'));
const history = computed(() => value('filteredAgentRuns'));
const comparisonOptions = computed(() => (value('agentRuns') ?? []).filter((item: any) => item.id !== run.value?.id && item.agentId === run.value?.agentId));
const live = computed(() => value('executingAgentRun')?.agentId === value('activeAgentId') && value('agentRunning'));
const display = (v: any) => v == null ? '未记录' : formatTraceDisplayValue(v);
watch(tab, next => { if (next !== 'trace') call('pauseAgentTraceReplay'); });
onUnmounted(() => call('pauseAgentTraceReplay'));
</script>

<template>
  <section class="agent-run-trace" aria-label="运行过程与历史">
    <div class="agent-trace-heading">
      <strong>运行记录</strong>
      <el-tag v-if="run" size="small" :type="call('agentRunTagType', run.status)">{{ call('agentRunStatusLabel', run.status) }}</el-tag>
      <span v-if="live && run?.id !== value('executingAgentRun')?.id" class="agent-trace-note">另有任务正在执行</span>
    </div>
    <el-tabs v-model="tab" stretch>
      <el-tab-pane label="过程" name="trace">
        <template v-if="run">
          <el-alert v-if="run.error" :title="run.error" type="error" :closable="false" show-icon />
          <p class="agent-trace-task" :title="run.input">任务：{{ run.input }}</p>
          <div class="agent-trace-summary">
            <div><span>所选运行耗时</span><strong>{{ metrics.latency }} ms</strong></div>
            <div><span>所选运行 Token</span><strong>{{ metrics.tokens }}</strong></div>
            <div><span>异常步骤</span><strong :class="{ 'agent-trace-error': failures.length }">{{ failures.length }}</strong></div>
          </div>
          <p class="agent-trace-note">召回来源：知识 {{ sources.knowledge ?? '未记录' }} · 记忆 {{ sources.memory ?? '未记录' }} · 技能 {{ sources.skill ?? '未记录' }}</p>
          <div class="agent-trace-controlbar agent-replay-toolbar">
            <el-button size="small" :disabled="!run.steps.length || index === 0" @click="call('stepIntoAgentTrace')">上一步</el-button>
            <el-button size="small" :disabled="!run.steps.length" @click="call(playing ? 'pauseAgentTraceReplay' : 'resumeAgentTraceReplay')">{{ playing ? '暂停' : '自动浏览' }}</el-button>
            <el-button size="small" :disabled="!run.steps.length || index >= max" @click="call('stepOverAgentTrace')">下一步</el-button>
            <el-button v-if="live" size="small" :type="value('agentTraceFollowLive') ? 'primary' : 'default'" plain @click="call('followAgentLiveTrace')">跟随实时</el-button>
            <span role="status" aria-live="polite" aria-atomic="true">{{ run.steps.length ? index + 1 : 0 }} / {{ run.steps.length }}</span>
          </div>
          <p class="agent-trace-note">按记录顺序浏览，不重新执行模型或工具。</p>
          <ol class="agent-trace-timeline" aria-label="执行步骤">
            <li v-for="(node, position) in flow" :key="node.id">
              <button type="button" :class="['agent-trace-row', { active: node.current }]" :aria-current="node.current ? 'step' : undefined" @click="call('selectAgentTraceStep', node.step.id)">
                <span class="agent-trace-number">{{ position + 1 }}</span>
                <span class="agent-trace-row-title"><strong>{{ node.title }}</strong><small>{{ call('agentStepTypeLabel', node.step.stepType) }}</small></span>
                <span class="agent-trace-row-state"><span :class="{ 'agent-trace-error': node.status === 'failed' }">{{ call('agentRunStatusLabel', node.status) }}</span><small>{{ node.latencyMs }} ms</small></span>
              </button>
            </li>
          </ol>
          <section v-if="step" class="agent-trace-detail" aria-label="所选步骤详情">
            <div class="agent-trace-heading"><strong>{{ step.name }}</strong><span>{{ call('formatAgentDate', step.startedAt) }}</span></div>
            <el-alert v-if="step.error" :title="step.error" type="error" :closable="false" show-icon />
            <details><summary>输入</summary><pre>{{ display(step.input) || '无' }}</pre></details>
            <details open><summary>输出</summary><pre>{{ display(step.output || step.error) || '无' }}</pre></details>
            <details v-if="step.metadata"><summary>步骤元数据</summary><pre>{{ call('formatStepMetadata', step.metadata) }}</pre></details>
            <el-button size="small" text :disabled="value('agentRunning') || !step.input" @click="call('restartAgentFromTraceNode')">填入步骤输入</el-button>
          </section>
          <details class="agent-trace-advanced">
            <summary>已记录配置与上下文</summary>
            <p class="agent-trace-note">仅展示该步骤及之前的记录；未记录项不使用当前配置补齐。敏感文本已脱敏。</p>
            <p v-if="snapshot.note" class="agent-trace-note">{{ snapshot.note }}</p>
            <div class="agent-trace-field"><strong>模型</strong><span>{{ snapshot.model || '未记录' }}</span></div>
            <details><summary>系统提示词</summary><pre>{{ snapshot.prompt }}</pre></details>
            <details><summary>参数</summary><pre>{{ display(snapshot.parameters) }}</pre></details>
            <details><summary>该步骤模型请求消息</summary><pre>{{ display(snapshot.messages) }}</pre></details>
            <details><summary>此前工具输入 / 输出</summary><pre>{{ display(snapshot.toolInput) || '无记录' }}</pre><pre>{{ display(snapshot.toolOutput) || '无记录' }}</pre></details>
            <details><summary>此前记忆步骤</summary><pre>{{ snapshot.memoryState.length ? display(snapshot.memoryState) : '尚无记忆步骤记录' }}</pre></details>
          </details>
          <details class="agent-trace-advanced">
            <summary>比较运行记录</summary>
            <el-select v-model="comparisonId" clearable placeholder="选择另一条运行记录" aria-label="比较的运行记录">
              <el-option v-for="item in comparisonOptions" :key="item.id" :value="item.id" :label="`${call('formatAgentDate', item.createdAt)} · ${item.input.slice(0, 60)}`" />
            </el-select>
            <template v-if="comparison.baseline">
              <p class="agent-trace-note">before 为选定记录，after 为当前记录；未记录项不推测。</p>
              <div class="agent-run-comparison-grid">
                <details v-for="field in [{ key: 'inputDiff', name: '任务输入' }, { key: 'modelDiff', name: '模型' }, { key: 'promptDiff', name: '系统提示词' }, { key: 'skillDiff', name: '技能 ID' }, { key: 'workflowDiff', name: '关联工作流 ID' }, { key: 'stepDiff', name: '步骤与状态' }]" :key="field.key"><summary>{{ field.name }}</summary><pre>{{ display(comparison[field.key]) }}</pre></details>
              </div>
            </template>
            <p v-else class="agent-trace-note">{{ comparisonOptions.length ? '请选择要比较的记录。' : '当前没有其他记录可比较。' }}</p>
          </details>
          <details class="agent-trace-advanced">
            <summary>当前 Agent 最近运行统计</summary>
            <p class="agent-trace-note">已加载的 {{ metrics.sampleCount }} 条已结束记录，不代表全部历史；不混入账户账单。</p>
            <div class="agent-trace-field"><span>成功率</span><strong>{{ metrics.successRate == null ? '暂无样本' : metrics.successRate + '%' }}</strong></div>
            <div class="agent-trace-field"><span>平均 Token</span><strong>{{ metrics.averageTokens ?? '暂无样本' }}</strong></div>
          </details>
          <details v-if="value('agentImprovementSuggestions')" class="agent-trace-advanced">
            <summary>优化建议</summary><p>{{ value('agentImprovementSuggestions').summary }}</p>
            <div v-for="section in [{ key: 'promptSuggestions', label: '提示词' }, { key: 'capabilitySuggestions', label: '能力' }, { key: 'testSuggestions', label: '测试' }]" :key="section.key"><strong>{{ section.label }}</strong><ul><li v-for="item in value('agentImprovementSuggestions')[section.key]" :key="item">{{ item }}</li></ul></div>
          </details>
        </template>
        <el-empty v-else description="运行 Agent 后，在这里查看过程；已有记录可从历史打开。" :image-size="72" />
      </el-tab-pane>
      <el-tab-pane label="历史" name="history">
        <div class="agent-history-toolbar">
          <el-segmented v-model="historyFilter" :options="[{ label: '全部', value: 'all' }, { label: '成功', value: 'succeeded' }, { label: '失败', value: 'failed' }]" />
          <el-select v-model="historySort" size="small" aria-label="运行排序"><el-option label="按时间" value="created" /><el-option label="按耗时" value="latency" /><el-option label="按 Token" value="tokens" /></el-select>
        </div>
        <div class="agent-run-history">
          <button v-for="item in history" :key="item.id" type="button" :class="['agent-history-item', item.status, { active: run?.id === item.id }]" :aria-pressed="run?.id === item.id" @click="call('selectAgentRun', item); tab = 'trace'">
            <span>{{ item.input || '空输入' }}</span><small>{{ call('agentRunStatusLabel', item.status) }} · {{ item.totalTokens }} Token · {{ call('formatAgentDate', item.createdAt) }}</small>
          </button>
          <el-empty v-if="!history.length" description="暂无匹配的运行记录" :image-size="72" />
        </div>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>
