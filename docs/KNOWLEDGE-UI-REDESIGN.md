# 知识库工作区重构

## 审计依据

- 入口：`frontend/src/components/app/pages/RagModule.vue`。原页面把上传、文档列表、知识库列表、用户文件库、检索及 Agent 配置堆叠在一个页面，知识库卡片位于文档下方。
- 路由：`frontend/src/app/useAppController.ts` 的 hash 导航；项目虽然安装 vue-router，但实际没有挂载 Router。此次沿用 hash 约定，不引入第二套导航系统。
- API：`frontend/src/api.ts`、`backend/src/knowledge/knowledge.controller.ts`，Agent 关联使用既有 `PATCH /agents/:id` 的 `knowledgeBaseIds` 字段。
- 处理与索引：`knowledge.service.ts`、`retrieval/knowledge-index.service.ts`、`managed-embedding.service.ts`。原文与片段在 MySQL，托管模型绑定沿用自动索引接口。文档状态和 KB 索引状态均来自实际接口。
- 样式：既有 `styles.css`、Element Plus 主题变量及全局图标注册。没有新增 UI 框架、图像素材或依赖。
- 原实现中创建弹窗不等待结果即关闭；文档写入还修改未保存的 Agent 草稿，并请求整套 Agent 资源。新工作区只调用相关知识库接口；失败保留输入和弹窗。

## 信息架构

| 页面 | 地址 | 职责 |
| --- | --- | --- |
| 知识库列表 | `#/knowledge`；兼容 `#/rag` | 新建、搜索、卡片入口、空状态 |
| 文档 | `#/knowledge/:id/documents` | 上传与文本录入、搜索、真实处理状态、详情、重解析、确认删除 |
| 检索测试 | `#/knowledge/:id/retrieval` | 问题与策略、折叠高级参数、召回片段和真实分数 |
| 关联应用 | `#/knowledge/:id/applications` | 添加、解除、显式保存 Agent 关联 |
| 设置 | `#/knowledge/:id/settings` | 基础信息、托管 Embedding 绑定、固定分块策略、引擎配置 |
| 用户文件库 | `#/knowledge/library` | 原有上传、预览、下载、重命名、筛选、删除、加入知识库 |

新建后直接进入文档页；文档页提供检索入口，检索结果提供关联入口。不使用强制教程。详情 Tab 按需挂载，切换 Tab 保留已打开面板的输入。浏览器刷新、前进与后退由 hash 路由恢复所在知识库及 Tab。

## 组件与状态

- `RagModule.vue`：只负责登录壳、工作区组合、创建弹窗与共享资源适配。
- `useKnowledgeWorkspace.ts`：知识库列表、当前路由、文档与索引请求，携带响应代次防止跨知识库串数据；5 秒自动更新，隐藏窗口暂停，卸载清理。
- `knowledge/KnowledgeBaseList.vue`：列表卡片；可键盘聚焦的真实链接。
- `knowledge/KnowledgeDocuments.vue` / `KnowledgeDocumentUpload.vue`：列表、详情 Drawer、上传 Dialog；文件读取进度来自 FileReader，服务端处理仅显示阶段，不伪造百分比。
- `knowledge/KnowledgeRetrievalTest.vue`：复用 `createRagLabSession`，条件变化与卸载使旧结果失效；不会把召回与 LLM 回答混合。
- `knowledge/KnowledgeAgentBinding.vue`：独立于 Agent 编辑草稿，保存前读取服务器最新关联；只 PATCH `knowledgeBaseIds`，保留其他知识库。部分成功时保留已保存状态，可重试剩余项。
- `knowledge/KnowledgeBaseSettings.vue`：复用已有 `KnowledgeEmbeddingSelector`；不恢复手动索引、刷新状态、索引已就绪标签。
- `knowledge/KnowledgeLibrary.vue`：文件库的独立状态与错误反馈，使用原有接口，不触发整套 Agent 资源刷新。
- `knowledge-navigation.ts` / `knowledge.css`：模块内路由、状态/文件校验与隔离样式；桌面最大内容宽度 1280–1360px，窄屏单列和横向导航，而不是无边界铺满。

## API 兼容与真实边界

数据库、接口协议和后端业务代码没有为此次 UI 重构改动。

- 所有三种检索模式、返回片段数、原始余弦阈值、分路分数与降级信息沿用现有 API。
- 名称、描述、引擎修改及整个知识库删除：现有后端未实现，因此设置显示真实信息与明确限制，不放置假保存/删除按钮。
- 本地分块固定为 1200 字符、160 字符重叠，按后端实现展示；RAGFlow 的分块由外部数据集管理。
- 接口没有服务端检索耗时或细粒度处理百分比；界面没有伪造耗时、进度或性能数据。
- 知识库列表 API 没有聚合处理状态，卡片显示文档/片段数、内容是否已添加、更新时间；处理进度在详情根据真实文档与索引状态展示。
- 上传限制为 1 MB，以适配默认 2 MB JSON 请求体中的 base64 开销；解析后的文本限制为接口实际的 200,000 字符。文件库仍支持原有类型与来源。
- 文件写入可能在索引失败前已保存原文；失败会刷新实际文档列表并保留草稿，提示检查已有文档，避免把失败冒充成功或重复入库。
- Agent 多项关联保存不是后端批量事务；界面显式反馈部分成功，不声称整个批次自动撤销。

## 登录记忆

登录对话框仍默认勾选“30 天内保持登录”。成功登录由服务器设置 HttpOnly Cookie，30 天有效期；初始化通过 `/auth/me` 恢复。新登录不保存明文密码，也不把 JWT 写入浏览器持久存储。此次未更改该机制。另见 `LOGIN-MEMORY.md`。

## 验证记录

前端新增工作区交互测试覆盖旧入口/深链接、状态映射、文件校验、创建失败保留输入、迟到响应隔离、自动刷新清理、关联保留其他知识库、部分保存失败、删除取消、上传失败及所有组件模板编译。

测试夹具只用于自动测试，产品页面始终调用真实 API。

### 自动检查

| 命令 | 结果 |
| --- | --- |
| `node --test frontend/test/*.test.cjs` | 60 项通过，其中知识库新增 13 项 |
| `npm --prefix frontend run build` | vue-tsc 与 Vite 构建通过 |
| `node node_modules/jest/bin/jest.js --config backend/jest.config.js --runInBand --runTestsByPath backend/src/auth/login-memory.spec.ts` | 5 项通过；包含匹配的 30 天 JWT/Cookie、会话 Cookie、退出撤销、密码/到期失效、服务重建恢复 |

前端没有独立 lint 脚本。Vite 仍提示现有整站包体大于 500 KB，此次没有修改全站打包架构。

### 本地浏览器真实验收（2026-10-13）

- 登录现有账户，勾选 30 天登录记忆。刷新页面、重启开发前端后刷新，以及同一浏览器的新标签页均自动恢复登录。没有再次输入密码，也未更改认证机制。
- 原有知识库的 3 份文档详情、文本片段、文档状态、三种检索以及 BGE-M3 绑定均正常显示。
- 创建独立的“知识库 UI 验收 20261013”，通过真实下拉选择现有 `bge-m3 · 默认部署节点（Docker）`。
- 真实上传 Markdown、调用服务端解析 Word，再直接录入一份文本；三份资料均完成自动索引。搜索文件名后只显示匹配文档，重新解析返回成功。
- 关键词、向量、混合模式均返回真实片段。混合问题“玄杉项目的售后支持时间是什么？”召回 3 片段，首条 Markdown 的原始余弦分数 0.7947，词面分数 12.129，融合分数 0.027869；这些是本次请求结果，不是性能指标。
- 给现有 Personal Assistant 添加临时知识库关联并保存；数据库验证其原有知识库关联仍在。刷新详情深链接后关联恢复，随后解除临时关联并保存，原绑定保留。
- 按用户确认，通过界面二次确认删除三份临时文档。数据库验证临时知识库的活动文档、关联与已索引片段数量均为 0，再限定 ID、名称、空文档和空关联条件软删除临时知识库。原有知识库仍为 3 份文档，原有 Agent 关联未丢失。
- 检查文件库真实原有文件的列表与筛选入口，并验证图片预览和实际文件下载；重命名、删除和加入知识库沿用既有 API，删除增加确认。下载改为 Blob URL，并拒绝把可执行 URL 当文件链接。
- 实测 390px、1280px、1920px 视口，页面无横向溢出。1920px 时主区域 1650px，内容保持 1360px 最大宽度。390px 导航横向滚动、卡片单列、文档操作换行。临时视口已恢复。
- 最终浏览器错误级控制台记录为空。真实页面没有使用 Mock 数据。

### 尚未扩展 / 未做外部实测

- 知识库整体删除、名称/描述修改、可编辑分块策略仍没有后端 API，界面明确只读，不虚构支持。
- RAGFlow 外部服务没有在此次本地验收中实际连接；创建字段和文档/检索协议保持原有兼容。
- 失败/迟到响应、部分关联保存失败、文件校验和上传失败等分支由自动交互逻辑测试覆盖；没有人为关闭现有服务来制造故障。
