# Agent 工作台全功能逻辑审计

日期：2026-10-13

## 结论

确认 **26 组问题（P1 13 组；P2 12 组；P3 1 组）**，不是“所有功能正常”。一个组可包含同一根因的多个分支。P1 优先影响配置一致性、执行控制或授权；P2 为确定性功能错误；P3 为帮助展示问题。每组对应隔离复现 A01–A26。

本次是审计，业务代码、数据库和已有配置保持原样。复现使用当前真实方法和隔离依赖，没有调用收费模型、运行用户工具代码、发布版本或写入现有数据。复现通过表示错误被证明存在，不表示错误已修好。

## 覆盖矩阵

| 工作台功能 | 检查内容 | 发现 |
|---|---|---|
| 从零搭建/基础/提示词 | 草稿、模板、AI 生成、保存/切换、刷新 | A01–A03、A22 |
| 总览 | 子资源加载、运行统计、版本和评测入口 | A01、A17、A19 |
| 能力 | Tool/Skill/Knowledge/Memory 绑定、编辑和查询 | A01、A07、A13、A16、A21–A22 |
| 工具 | 创建、编辑、启停、删除、搜索、绑定、预览、测试 | A13–A15、A21 |
| 工作流 | 画布、保存/绑定、节点、分支、执行状态、权限 | A03–A06、A23–A24、A26 |
| 协作 | 子 Agent 绑定、Team 策略、成员执行/异常 | A01、A19、A23 |
| 集成 | Notion 配置、脱敏、测试、实际工具检索路径 | A12 |
| 发布与版本 | 公开/API、归档、快照、灰度、稳定、比较、恢复、回滚 | A07–A11、A17、A20、A22 |
| 市场 | 安装内置/自定义模板、发布模板、技能复制与绑定 | A02、A16、A18 |
| 调用/回放 | 输入与会话、工具授权、SSE、步骤、历史、比较、快照、输出 | A01、A06、A11、A23、A25；既有 25 项回放回归通过 |
| 评测/导出 | 当前 Run 评测、Judge 回退、优化建议、包内容 | A01、A15、A19 |
| API 侧扩展 | 异步任务、测试集、Workflow pending/恢复/取消 | A06、A19；测试集不是当前 UI 已有完整编辑器 |

真实页面已遍历 11 个开发 Tab 和调用页，检查现有数据和入口。工具搜索在真实页面复核。会改变配置、调用外部服务或产生费用的分支以隔离方法执行核实，不把只打开页面等同于端到端业务通过。

## 确认问题

### A01 · P1 · 切换 Agent 后，记忆、评测、版本可能串数据

- 触发：A 的请求较慢，切到 B 后 B 先返回、A 后返回。
- 结果：这些加载方法缺少 Run 回放已有的请求代次、Agent、账户、后端校验，迟到的 A 响应覆盖 B 列表；加载失败也保留旧列表。
- 修复方向：为所有子资源使用统一作用域和代次，切换时清空，迟到响应和错误都丢弃。
- 代码：[useAppController.ts:1617](D:/repo/LLMGather-personal/frontend/src/app/useAppController.ts)，[useAppController.ts:1629](D:/repo/LLMGather-personal/frontend/src/app/useAppController.ts)，[useAppController.ts:1650](D:/repo/LLMGather-personal/frontend/src/app/useAppController.ts)。

### A02 · P1 · 保存完成会跳回旧 Agent，覆盖保存期间的新编辑

- 触发：保存 A 尚未完成，用户选择 B 或继续改 A 草稿。
- 结果：persistAgent 无请求/草稿版本校验，直接设置 activeAgentId 并 fillAgentForm(saved)。结果可能跳回 A，或用旧响应覆盖新编辑；发布、生成等写操作也存在同类缺口。
- 修复方向：保存时捕获对象、作用域和草稿版本；只更新正确的缓存，不强行切换当前选择，不覆盖新草稿。
- 代码：[useAppController.ts:2083](D:/repo/LLMGather-personal/frontend/src/app/useAppController.ts)，[useAppController.ts:2134](D:/repo/LLMGather-personal/frontend/src/app/useAppController.ts)，[useAppController.ts:1904](D:/repo/LLMGather-personal/frontend/src/app/useAppController.ts)。

### A03 · P2 · 刷新 Agent 会无提示丢弃未保存配置和画布

- 触发：编辑提示词/基础配置或 DAG 后点击刷新，或返回工作台触发 loadAgents。
- 结果：loadAgents 直接 fillAgentForm；loadAgentResources 又从保存的工作流重新同步画布。没有 dirty 状态或丢弃确认。refreshAgentStudio 同时调用两个加载器，而 loadAgents 内又加载资源，增加覆盖/重复请求。
- 修复方向：区分读取缓存与重置编辑器，保留 dirty 草稿，明确确认丢弃；资源只加载一次。
- 代码：[useAppController.ts:1662](D:/repo/LLMGather-personal/frontend/src/app/useAppController.ts)，[useAppController.ts:1545](D:/repo/LLMGather-personal/frontend/src/app/useAppController.ts)，[useAppController.ts:1552](D:/repo/LLMGather-personal/frontend/src/app/useAppController.ts)。

### A04 · P1 · 保存 A 的 DAG 时切换到 B，会把 DAG 绑定给 B

- 触发：创建工作流请求未返回时切换 Agent。
- 结果：保存完成后才读取 agentForm.id，绑定当前 B 而非发起保存的 A；fillAgentForm 还会重置其未保存字段。每次保存都 POST 新建工作流，旧工作流积累。
- 修复方向：保存前捕获 Agent/工作流/草稿快照；新增与更新分离；绑定步骤和草稿更新受作用域保护。
- 代码：[useAppController.ts:4802](D:/repo/LLMGather-personal/frontend/src/app/useAppController.ts)。

### A05 · P1 · 工作台 DAG 仍保存 v1，条件分支不是互斥执行

- 触发：在可视化编辑器保存 if/else 或多分支图后执行。
- 结果：saveWorkflowCanvas 不传 schemaVersion，后端默认 1。两个引擎均对 v1 做兼容线性化，分支目标不能按 v2 的选路语义跳过；隔离执行证明 yes/no 都被执行。后端 v2 分支本身已有测试，问题是编辑器未正确接入。
- 修复方向：新编辑器输出完整 v2 定义及分支目标；保留历史 v1 兼容，不仅改一个版本号；加入保存→运行的接口契约测试。
- 代码：[useAppController.ts:4802](D:/repo/LLMGather-personal/frontend/src/app/useAppController.ts)，[workflows.service.ts:105](D:/repo/LLMGather-personal/backend/src/workflows/workflows.service.ts)，[workflow-engine.ts:107](D:/repo/LLMGather-personal/backend/src/workflows/runtime/workflow-engine.ts)。

### A06 · P1 · 未结束/中断的工作流被记为成功的 Agent Run

- 触发：工作流并发额度满返回 pending，或超时/取消返回 interrupted/cancelled。
- 结果：Agent 包装层仅判断 status===failed，其余全部写 succeeded，且可能提取记忆。前端 WorkflowRun 类型还漏掉 pending/interrupted/cancelled，运行页把非 succeeded 全标失败且不跟踪后续状态。
- 修复方向：明确终态集合；等待或持续跟踪非终态，映射取消/中断，不提前做成功收尾和记忆抽取。
- 代码：[agents.service.ts:731](D:/repo/LLMGather-personal/backend/src/agents/agents.service.ts)，[workflow-runtime.service.ts:86](D:/repo/LLMGather-personal/backend/src/workflows/runtime/workflow-runtime.service.ts)，[api.ts:1284](D:/repo/LLMGather-personal/frontend/src/api.ts)。

### A07 · P1 · 普通保存会重置工具的 confirm/disabled 权限

- 触发：既有绑定通过受控接口设置 confirm/disabled，再在工作台保存普通配置。
- 结果：前端每次传 toolIds，却没有 toolPermissions；后端删除并重建绑定，空 permissions 默认 auto。高风险工具仍有 risk 检查，但 disabled 等原有策略已经丢失。
- 修复方向：未修改权限时保留原绑定权限；显式权限更新与普通字段保存分离，版本快照也记录权限。
- 代码：[useAppController.ts:2083](D:/repo/LLMGather-personal/frontend/src/app/useAppController.ts)，[tools.service.ts:194](D:/repo/LLMGather-personal/backend/src/tools/tools.service.ts)，[agents.service.ts:461](D:/repo/LLMGather-personal/backend/src/agents/agents.service.ts)。

### A08 · P1 · 发布版本没有真正冻结 Tool/Skill 绑定

- 触发：发布旧快照后修改当前 Agent 的工具或技能，再调用已发布版本。
- 结果：agentFromVersionSnapshot 恢复旧 toolIds/skillIds，但 resolveRunnableTools/resolveAgentSkills 对普通 Agent 又从当前数据库绑定读取。旧版本会使用新绑定，灰度/回滚无法可靠隔离能力变化；绑定资源内容也未版本化。
- 修复方向：运行使用已发布的能力快照与权限；明确资源内容版本策略，并覆盖版本发布后修改草稿的回归。
- 代码：[agents.service.ts:1575](D:/repo/LLMGather-personal/backend/src/agents/agents.service.ts)，[agents.service.ts:1568](D:/repo/LLMGather-personal/backend/src/agents/agents.service.ts)，[agents.service.ts:3885](D:/repo/LLMGather-personal/backend/src/agents/agents.service.ts)。

### A09 · P1 · 无效版本或发布标识冲突会造成半发布状态

- 触发：稳定发布的 versionId 已失效，或最终校验 publicSlug 冲突。
- 结果：旧版本先变 superseded，之后才读取目标版本/校验标识，失败前多次 UPDATE 已生效；没有事务。接口报错并不代表原稳定版本仍保持。
- 修复方向：先校验所有输入、目标版本与标识，再用同一数据库事务切换版本和发布字段。
- 代码：[agents.service.ts:3171](D:/repo/LLMGather-personal/backend/src/agents/agents.service.ts)。

### A10 · P1 · 首次灰度发布会实际接管全部流量

- 触发：没有 released 版本，只创建一个 10% canary。
- 结果：stable 兜底取 rows[0]，这也是 canary；99% 分桶同样返回 canary。界面却说明只接管指定比例。
- 修复方向：没有稳定基线时拒绝灰度，或明确另一份稳定快照作为兜底；验证全部 100 个分桶。
- 代码：[agents.service.ts:3869](D:/repo/LLMGather-personal/backend/src/agents/agents.service.ts)，[AgentModule.vue:1843](D:/repo/LLMGather-personal/frontend/src/components/app/pages/AgentModule.vue)。

### A11 · P1 · 匿名公开调用与所有者会话/工具授权没有隔离

- 触发：公开 Agent 的请求包含 continueFromLast 或 approvedToolIds。
- 结果：匿名路由原样接收 RunAgentDto，并用 Agent 所有者身份执行。continueFromLast 会读取该所有者最近的私有运行；请求方还能提交所有者工具批准列表。结果包含完整 Run/步骤，不能当作隔离的访客会话。
- 修复方向：公开入口独立访客会话和输出投影；不信任访客的 owner 会话/批准字段；公开可执行能力由所有者预先明确授权。
- 代码：[agents.service.ts:690](D:/repo/LLMGather-personal/backend/src/agents/agents.service.ts)，[agents.service.ts:859](D:/repo/LLMGather-personal/backend/src/agents/agents.service.ts)，[agent-access.controller.ts:24](D:/repo/LLMGather-personal/backend/src/agents/agent-access.controller.ts)。

### A12 · P2 · MCP 连接测试使用脱敏后的 Token

- 触发：添加有效 Notion Token 后点击测试。
- 结果：test 调用 get，get 默认 mapServer(mask=true)，searchNotion 收到的是前 8 位加 ...，不是完整 Token，因此连接测试错误失败；正常工具检索走另一条未脱敏路径，不能据此推断真实 Token 无效。
- 修复方向：后端测试读取内部完整凭据，响应仍脱敏；不通过前端回传凭据。
- 代码：[mcp.service.ts:95](D:/repo/LLMGather-personal/backend/src/mcp/mcp.service.ts)，[mcp.service.ts:70](D:/repo/LLMGather-personal/backend/src/mcp/mcp.service.ts)，[mcp.service.ts:184](D:/repo/LLMGather-personal/backend/src/mcp/mcp.service.ts)。

### A13 · P2 · 工具页绑定/搜索是空操作，自定义工具没有绑定入口

- 触发：点击内置工具“绑定”，输入搜索词，或创建自定义工具后想绑定。
- 结果：绑定按钮没有事件，搜索没有 v-model/过滤。能力页选择框仅遍历 availableTools，而加载时已把自定义工具移到 customTools；自定义卡片也无绑定操作。真实页面输入无匹配词后仍保留 12 张卡片。
- 修复方向：连接真实绑定方法和搜索状态；统一可绑定工具集合，覆盖内置/自定义和启用状态。
- 代码：[AgentModule.vue:1928](D:/repo/LLMGather-personal/frontend/src/components/app/pages/AgentModule.vue)，[AgentModule.vue:1908](D:/repo/LLMGather-personal/frontend/src/components/app/pages/AgentModule.vue)，[useAppController.ts:1584](D:/repo/LLMGather-personal/frontend/src/app/useAppController.ts)。

### A14 · P2 · 成功的自定义工具测试被显示成失败/耗时缺失

- 触发：工具接口正常返回 status=succeeded、latencyMs。
- 结果：页面读取不存在的 success/duration，成功显示失败，耗时显示 undefinedms；异常合成结果和正常响应字段也不一致。
- 修复方向：统一 ToolInvocationResult 契约，按 status/error/latencyMs 展示，覆盖真实成功和失败响应。
- 代码：[AgentModule.vue:2110](D:/repo/LLMGather-personal/frontend/src/components/app/pages/AgentModule.vue)，[api.ts:1106](D:/repo/LLMGather-personal/frontend/src/api.ts)，[useAppController.ts:4055](D:/repo/LLMGather-personal/frontend/src/app/useAppController.ts)。

### A15 · P2 · 导出 Agent JSON 包会漏掉已绑定的自定义工具

- 触发：Agent 含有通过 API 绑定的自定义工具后导出迁移包。
- 结果：boundTools 只筛选 availableTools，customTools 没有进入这一集合，因此后续 customToolByName 的可移植代码逻辑不会补回缺失工具。结果 silently 丢失能力。
- 修复方向：按 ID 统一解析所有已绑定工具；缺失资源应列出并阻止误导性完整导出，不按名字串接不同工具。
- 代码：[useAppController.ts:3549](D:/repo/LLMGather-personal/frontend/src/app/useAppController.ts)。

### A16 · P2 · 技能绑定保存失败仍报告绑定成功

- 触发：绑定技能时保存接口返回失败/网络错误。
- 结果：saveAgent/persistAgent 失败返回 null，bindSkillToCurrentAgent 不检查结果，覆盖错误状态为“已绑定 Skill”。UI 草稿与服务器实际配置分叉。
- 修复方向：返回并检查保存结果，失败保留错误且不宣称已绑定；只在服务端确认后更新成功状态。
- 代码：[useAppController.ts:3833](D:/repo/LLMGather-personal/frontend/src/app/useAppController.ts)，[useAppController.ts:2321](D:/repo/LLMGather-personal/frontend/src/app/useAppController.ts)。

### A17 · P2 · 版本恢复缓存与回滚返回字段不一致

- 触发：恢复版本后重新选择同一 Agent，或回滚原先 API 未开启的 Agent。
- 结果：前端 restoreVersion 只 fillAgentForm，不更新 agents 缓存，重新选择会回填旧配置。后端 rollbackToVersion 更新 published/api_enabled 后却返回此前 restored 对象，返回/界面可能显示关闭但服务端已经开启。
- 修复方向：所有变更统一 upsert 缓存；事务提交后重新读取发布状态；回滚与重新开启公开接入应有明确语义。
- 代码：[useAppController.ts:4538](D:/repo/LLMGather-personal/frontend/src/app/useAppController.ts)，[agents.service.ts:3240](D:/repo/LLMGather-personal/backend/src/agents/agents.service.ts)。

### A18 · P2 · 市场模板复制缺少工作流和子 Agent 能力

- 触发：将包含 workflowIds/subAgentIds 的 Agent 发布并安装为自定义模板。
- 结果：模板序列化及安装 payload 只处理 Tool/Skill/Knowledge，忽略 Workflow/子 Agent；模板名称和提示词虽然复制，执行能力不同。
- 修复方向：保留可迁移的绑定或显式列出未复制能力，定义资源归属/映射，不静默降级。
- 代码：[agents.service.ts:581](D:/repo/LLMGather-personal/backend/src/agents/agents.service.ts)，[agents.service.ts:625](D:/repo/LLMGather-personal/backend/src/agents/agents.service.ts)。

### A19 · P2 · 协作团队/测试集异常后运行记录永久 running

- 触发：团队成员或测试目标保存后被归档/删除，执行前校验抛错。
- 结果：两条上层运行路径先 INSERT running，随后没有 catch/finally 将异常转成终态；成员返回 failed 能处理，但成员直接抛异常不能处理。
- 修复方向：上层统一捕获执行异常，落盘失败/中断终态及原因；不要只处理正常返回的 failed。
- 代码：[agent-teams.service.ts:124](D:/repo/LLMGather-personal/backend/src/agent-teams/agent-teams.service.ts)，[agents.service.ts:3320](D:/repo/LLMGather-personal/backend/src/agents/agents.service.ts)。

### A20 · P2 · 已归档 Agent 在工作台禁止运行，但 API 仍能运行

- 触发：status=archived 且 apiEnabled=true 的 Agent 被 API 调用。
- 结果：run/runStream 检查 active，runApi 只检查 apiEnabled。相同归档状态在不同入口语义不一致。
- 修复方向：统一执行入口的 active 和发布/版本状态校验，所有入口采用同一运行前置条件。
- 代码：[agents.service.ts:683](D:/repo/LLMGather-personal/backend/src/agents/agents.service.ts)，[agents.service.ts:704](D:/repo/LLMGather-personal/backend/src/agents/agents.service.ts)。

### A21 · P2 · 编辑禁用资源后会意外重新启用

- 触发：修改已禁用的自定义工具或 Skill 的名称/内容。
- 结果：前端 saveTool 固定 enabled=true；SkillsService.update 的 dto.enabled 未传时也写 1。普通编辑改变启用状态。
- 修复方向：部分更新保留 current.enabled；仅显式状态操作启停；编辑表单与保存 payload 保持当前状态。
- 代码：[useAppController.ts:3990](D:/repo/LLMGather-personal/frontend/src/app/useAppController.ts)，[skills.service.ts:164](D:/repo/LLMGather-personal/backend/src/skills/skills.service.ts)。

### A22 · P1 · Agent 创建/保存及绑定替换不具备原子性

- 触发：某个工具/技能/知识库/工作流绑定不存在，或中途写库失败。
- 结果：Agent 先 INSERT/UPDATE，随后各绑定逐个写入，没有事务；Tool/Skill 替换甚至先删原绑定，再逐个验证。失败会留下孤立 Agent、部分新配置或丢失原绑定，不是一次失败即可恢复的保存。
- 修复方向：先完整校验，再在同一事务内写 Agent 和所有绑定；用故障注入证明失败时原数据未改变。
- 代码：[agents.service.ts:356](D:/repo/LLMGather-personal/backend/src/agents/agents.service.ts)，[agents.service.ts:430](D:/repo/LLMGather-personal/backend/src/agents/agents.service.ts)，[tools.service.ts:194](D:/repo/LLMGather-personal/backend/src/tools/tools.service.ts)，[skills.service.ts:139](D:/repo/LLMGather-personal/backend/src/skills/skills.service.ts)。

### A23 · P1 · 绑定工作流绕开 Agent 的工具权限/确认路径

- 触发：Agent 通过绑定工作流执行 Tool/Code 节点，包含需确认或已禁止的工具。
- 结果：executeAgentRun 先走 runBoundWorkflowIfNeeded，未到 resolveRunnableTools。工作流 runNode 直接 ToolsService.invoke，不带 Agent 的批准/禁止策略。普通 Agent 调用的 guard 不约束这条路径。
- 修复方向：把有效授权策略作为运行上下文传入所有工作流节点，统一共享鉴权/批准检查；公开入口不能间接绕过。
- 代码：[agents.service.ts:780](D:/repo/LLMGather-personal/backend/src/agents/agents.service.ts)，[workflows.service.ts:234](D:/repo/LLMGather-personal/backend/src/workflows/workflows.service.ts)，[workflows.service.ts:183](D:/repo/LLMGather-personal/backend/src/workflows/workflows.service.ts)。

### A24 · P3 · 工作流帮助中的 {{input}} 被 Vue 当成不存在变量

- 触发：打开工作流节点配置的帮助文本。
- 结果：部分普通文本中的双花括号没有 v-pre，编译生成 _ctx.input，而 setup 没有该变量。提示占位符丢失并产生 Vue warning；placeholder 字符串本身不是同一问题。
- 修复方向：技术占位符按字面渲染，统一扫描文档/帮助模板的表达式。
- 代码：[AgentModule.vue:1511](D:/repo/LLMGather-personal/frontend/src/components/app/pages/AgentModule.vue)。

### A25 · P2 · 规划/反思分支未接入当前执行路径，模式/重试参数不控制实际 Harness

- 触发：接口提交 reflective/fast 或 retryPolicy，预期改变规划/反思/重试行为。
- 结果：当前图 START→context→guardTools→final，plan/tool/reflect 分支不可达。final 中的 Tool-use Harness 没有读取 dto.mode/retryPolicy。LangGraph 的确在运行，v2 Workflow 分支也确实实现，不能把这一缺口解释为“完全没用 LangGraph”。
- 修复方向：统一执行策略契约：接入真正可达的策略节点或在 Harness 实现参数含义，并去掉过时的承诺；做请求级行为对比。
- 代码：[agents.service.ts:1191](D:/repo/LLMGather-personal/backend/src/agents/agents.service.ts)，[agents.service.ts:2061](D:/repo/LLMGather-personal/backend/src/agents/agents.service.ts)。

### A26 · P1 · HTTP 工作流节点缺少已有工具层的安全 URL 校验

- 触发：HTTP 节点配置回环/内网地址，或公开 Agent 通过绑定工作流调用该节点。
- 结果：runHttpNode 仅检查 http(s) 前缀并直接 fetch，默认跟随重定向；没有 ToolsService.assertSafeFetchUrl 已有的私网/DNS/重定向防护。隔离复现证明回环 URL 到达 fetch 分支，实际网络可达性取决于部署。
- 修复方向：复用统一安全 HTTP 客户端；校验解析地址、重定向目标和网络范围，限制响应体，按部署显式定义允许的内网连接。
- 代码：[workflows.service.ts:290](D:/repo/LLMGather-personal/backend/src/workflows/workflows.service.ts)，[tools.service.ts:1459](D:/repo/LLMGather-personal/backend/src/tools/tools.service.ts)。

## 已核对的有效行为与能力边界

- Agent/Run/版本等常规查询含用户归属条件；当前普通调用的工具过滤确实检查 disabled、高风险批准，子 Agent 解析也检查归属与深度。A11/A23 是替代入口未统一约束，不是声称所有鉴权均失效。
- 回放既有修复的 25 项回归通过：Run/Agent 流事件隔离、游标、历史重跑回填、记录快照、未知值、聚合工具失败和真实步骤顺序。不能用这些回放测试替代其他工作台功能测试。
- Workflow v2 的实际 LangGraph 条件分支、并行/汇合等已有运行测试；编辑器仍输出 v1 是集成问题。旧的 v1 兼容模式不能直接删除。
- Skill 测试是 dry-run/模板预览，不调用模型和实际工具；返回 Token 为估算，knowledgeAccessed 表示权限声明。它不证明真实知识检索或 Skill 任务效果；界面已经把 RAG 标签写成“声明访问”，不要误报为检索结果丢失。
- 长期记忆编辑的范围控件在编辑时禁用，不能把范围不可修改误报为未生效；列表的异步作用域问题仍在 A01。
- LLM Judge 失败已有规则回退；A19 的例子是归档/删除成员等执行前异常，不是断言所有 Judge 失败均让测试集挂起。

## 历史验证记录

本节记录修复前的审计结果，不表示问题仍存在于当前实现。对应修复与正式回归入口见 [Agent 工作台修复记录](D:/repo/LLMGather-personal/docs/AGENT-WORKBENCH-FIX.md)。

1. 修改前的临时隔离复现脚本曾通过 26 个断言，退出 0，证明 A01–A26 在审计时存在；该临时脚本现已清理。
2. `node --test frontend/test/agent-replay.test.cjs`：25 项既有回放回归通过，退出 0。
3. `node node_modules/jest/bin/jest.js --config backend/jest.config.js --runInBand --runTestsByPath backend/src/agents/agents.service.spec.ts backend/src/agents/builtin-agents.spec.ts backend/src/workflows/runtime/workflow-engine.spec.ts backend/src/workflows/workflows.service.spec.ts`：4 个测试文件、26 项通过，退出 0。这些测试没有覆盖上述所有缺口。
4. 初次指定了不存在的 Team 测试文件，命令报 ENOENT；已核对真实测试文件并纠正，最终结果见上一条。不能把缺失测试当作功能失败。

临时复现脚本、文字输出、源码快照和截图已按要求清理；正式回归测试和修复记录仍保留在项目源码目录。

## 建议修复顺序

1. 公共调用/Workflow 授权与访客会话隔离（A07、A11、A23、A26）。
2. 保存原子性、异步作用域和绑定对象捕获（A01–A04、A22）。
3. 发布事务、快照能力一致性与灰度兜底（A08–A10、A17、A20）。
4. 工作流编辑器 v2 契约和非终态收尾（A05–A06、A19）。
5. 工具/MCP/Skill/市场/导出闭环，再整理帮助和执行参数（A12–A16、A18、A21、A24–A25）。

每组修复后应把“错误可复现”断言改成正确行为回归；不要以本报告的 26 个复现通过作为发布验收。
