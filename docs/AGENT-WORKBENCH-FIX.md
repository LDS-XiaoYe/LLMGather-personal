# Agent 工作台修复记录

日期：2026-10-13

## 结果

已针对 [26 组审计问题](D:/repo/LLMGather-personal/docs/AGENT-WORKBENCH-LOGIC-AUDIT.md) 修改真实前后端实现，并新增 60 项定向回归（前端 19 项、后端 41 项）。保留现有 API 功能、历史 Run 与已保存 Agent；本轮没有发布版本、保存现有 Agent、调用收费模型或执行用户自定义代码。

## 修复对照

| 审计项 | 已落实的行为 | 回归位置 |
|---|---|---|
| A01 | 子资源按 Agent、账户、后端、编辑代次及请求代次隔离；失败/切换不保留其他 Agent 的列表 | 前端 A01 |
| A02 | 保存、发布、AI 生成与安装捕获编辑作用域；旧响应更新对应缓存，不切回旧对象或覆盖新草稿；重复保存被阻止 | 前端 A02；源码中的写操作保护 |
| A03 | 刷新保留未保存表单和画布；资源刷新去重；切换/新建确认丢弃 | 前端 A03；浏览器刷新验收 |
| A04 | DAG 保存前捕获归属；已有 Workflow 使用 PATCH；只绑定发起保存的 Agent；独立配置与新节点编辑保留 | 前端 A04 |
| A05 | 编辑器保存完整 v2 分支；增加命中、未命中、分类、默认目标选择；保留未分配的边，避免变成并行根节点；删除节点清理分支引用 | 前端 A05；真实 LangGraph 分支/并行测试 |
| A06 | pending/running 自动跟踪；只有 succeeded 才成功收尾与抽取记忆；取消/中断/失败不再记成功；排队观察超时向 Runtime 请求取消 | 后端 A06；前端真实状态类型与轮询 |
| A07 | 普通保存保留 confirm/disabled；显式权限修改仍生效；前端授权确认读取绑定权限 | 后端 A07 |
| A08 | 新版本冻结 Tool/Skill 定义、代码、权限；运行使用快照而非当前草稿绑定；Workflow 子调用传递快照；实时删除/禁用 Tool 仍可撤销执行 | 后端 A08/A23 |
| A09 | 版本、Slug 先校验，发布变更同事务完成；创建版本锁定 Agent，序号串行分配 | 后端 A09 |
| A10 | 没有独立稳定版本时拒绝灰度；稳定/灰度分桶正确 | 后端 A10，覆盖全部 100 个桶 |
| A11 | 公开调用使用独立新会话，不接收拥有者续聊/访客授权；关闭私有记忆与账户私有集成；响应只返回 status/output/latencyMs | 后端 A11；Workflow 公共调用策略 |
| A12 | Notion 测试使用未脱敏凭据，普通配置读取继续脱敏 | 后端 A12 |
| A13 | 工具搜索实际过滤；内置/自定义工具均可绑定；能力选择含自定义工具 | 前端 A13；浏览器搜索验收 |
| A14 | 测试展示按实际 status、latencyMs 字段判断结果与耗时 | 前端 A14 |
| A15 | 导出包含绑定的自定义代码，按 Tool ID 匹配而非同名匹配 | 前端 A15 |
| A16 | Skill/Tool 绑定依据保存结果反馈，保存失败不再显示绑定成功 | 前端 A13/A16 |
| A17 | 恢复/回滚更新对应缓存，保留新编辑；回滚返回最终发布状态 | 前后端 A17 |
| A18 | 当前账户的市场模板保存/安装 Workflow 与子 Agent 引用 | 后端 A18 |
| A19 | Team/Test Suite 异常进入 failed 终态；成员错误作为失败观察返回，保留其他成员结果 | 后端 A19 |
| A20 | 已归档 Agent 的 API 调用也在执行前拒绝 | 后端 A20 |
| A21 | 编辑禁用 Tool/Skill 保持禁用；禁用的自定义工具仍可管理，不因刷新消失；执行器仍拒绝禁用资源 | 前后端 A21 |
| A22 | Agent 配置及资源绑定共享请求级 MySQL 事务；Tool/Skill 全量验证后再替换；更新先锁定行；平台工具复用同一服务而非另写 SQL | 后端 A22；并发/嵌套事务、平台入口测试 |
| A23 | Workflow Tool/Code 通过统一 Agent 权限边界，传递本次授权、版本快照和公开调用策略 | 后端 A23；Workflow adapter 回归 |
| A24 | 模板帮助中的字面量 input 占位符不再被 Vue 当作不存在的变量 | Vue 模板编译回归 |
| A25 | standard/reflective 实际经过 plan/act/observe/reflect；fast 使用 Function Calling harness；规划重试与失败重规划有预算；最终总结不再重复开启一轮工具执行 | 真实 LangGraph 图执行与重试预算测试 |
| A26 | HTTP 节点复用 URL/IP 检查；连接固定到已验证 DNS 地址；禁止自动重定向；响应读取限制 64 KiB，带超时/取消 | HTTP 目标、DNS、重定向、响应上限测试 |

## 关键文件

- [Agent 前端状态与操作](D:/repo/LLMGather-personal/frontend/src/app/useAppController.ts)
- [Agent 工作台页面](D:/repo/LLMGather-personal/frontend/src/components/app/pages/AgentModule.vue)
- [Agent 执行与发布](D:/repo/LLMGather-personal/backend/src/agents/agents.service.ts)
- [工具与统一 HTTP 访问](D:/repo/LLMGather-personal/backend/src/tools/tools.service.ts)
- [Workflow 服务](D:/repo/LLMGather-personal/backend/src/workflows/workflows.service.ts)
- [请求级数据库事务](D:/repo/LLMGather-personal/backend/src/database/database.service.ts)
- [前端定向测试](D:/repo/LLMGather-personal/frontend/test/agent-workbench.test.cjs)
- [后端定向测试](D:/repo/LLMGather-personal/backend/src/agents/agent-workbench.spec.ts)

另调整 Skills/MCP/Team、Workflow DTO/Controller/Runtime、前端 API/AgentForm 类型以及两个现有测试的依赖替身。版本定义增加实际资源内容，snapshot_json 从 TEXT 升级到 LONGTEXT，启动迁移可重复执行，不删除旧数据。已有工作区改动保持原样。

## API 与历史数据

- 新增 PATCH /workflows/:id，沿用创建定义的校验与所有者检查。
- Workflow 运行请求可额外传 approvedToolIds；只有服务内部能设置版本快照与公开调用策略。
- 原有 Workflow GET/POST、Agent Run、绑定与版本入口继续使用；前端 WorkflowRun 类型补齐真实状态。
- 公开匿名 Agent 响应收敛为 `{ data: { status, output, latencyMs } }`，不返回拥有者 Run/步骤/会话详情。认证拥有者接口保留完整轨迹。
- 历史 v1 Workflow 执行仍兼容原行为；在新版编辑器保存时使用 v2，旧条件图需要配置具体分支目标后保存。
- 历史发布快照只有资源 ID，不能补造历史代码。旧快照按记录 ID 解析并采用保守授权；重新发布版本后才能获得完整定义快照。
- 内置工具的执行实现属于应用版本；自定义 Tool 代码与 Skill 内容属于 Agent 版本快照。市场模板当前仅面向当前账户，不承诺跨账户复制私有资源。

## 验收结果

- 前端全量：122 passed，0 failed。
- 后端全量：32 suites passed，253 tests passed，19 tests skipped（2 个依赖外部环境的集成套件），0 failed。
- 前后端 TypeScript 检查与生产构建通过。
- Vite 保留既有的大包提示；本次没有引入 UI 框架或新运行依赖。
- 数据库启动用例此前遗漏知识索引迁移替身，本轮补齐测试隔离；迁移本身仍有独立测试。
- 浏览器：真实账户下验证工具搜索、刷新保留提示词草稿、切换时提示未保存更改、条件分支目标选择及 390px 窄屏。清理了未保存的临时文本/画布；没有写入现有配置。
- 服务已重新加载，后端 health 返回 HTTP 200。浏览器验收中未记录业务 JS 错误。

## 验收边界

上述自动回归使用真实方法/组件和真实 LangGraph 引擎，外部模型、Notion 和工具执行用隔离依赖；不是收费模型全链路或生产故障注入验收。19 项环境集成测试仍未运行。历史 v1、历史资源快照的兼容规则见上节，未伪造历史版本内容。

## 临时文件清理

2026-10-14：已按要求清理临时截图、测试输出、源码副本与旧模型验收缓存。本报告保留修复与历史验收结论，不再链接已删除的图片。

正式回归测试仍保留在源码目录，可在仓库根目录执行：

```powershell
node --test frontend/test/agent-workbench.test.cjs
node node_modules/jest/bin/jest.js --config backend/jest.config.js --runInBand --runTestsByPath backend/src/agents/agent-workbench.spec.ts
```
