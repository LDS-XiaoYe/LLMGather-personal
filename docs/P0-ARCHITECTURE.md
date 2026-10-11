# P0：Workflow 执行、Checkpoint 与语义 RAG

## 仓库现状与边界

- NestJS 使用全局 DatabaseModule，MySQL 为业务主存储；Redis 用于现有缓存等能力。
- Workflow 原格式为 `{nodes:[{id,type,config}]}`，边在 `config.nextIds` 中；Vue 编辑器保存这种格式。旧执行器把节点拓扑排序后串行执行，条件节点只生成文本。
- Agent/Team、工具、模型 Provider、权限、业务运行轨迹、Replay/Evals 保留。Agent 自身的 function-calling harness 不在本次 Workflow 引擎重构中改写。
- 旧 native RAG 把哈希向量写入 MySQL TEXT；RAG Lab 的 keyword/vector/hybrid 参数不变。RAGFlow 仍调用原 `/api/v1/retrieval`。
- 原 MySQL adapter 的事务方法与普通 pool 查询不共用连接。因此新增持久化不依赖那套事务包装：使用单条原子 SQL、CAS 租约、幂等 upsert 与可恢复状态。

## 新旧架构

| 边界 | 原实现 | 新实现 |
|---|---|---|
| Workflow 引擎 | 排序后的线性图 | 可切换 Legacy/LangGraph；v2 每个业务节点对应真实图节点 |
| 状态 | 运行记录和步骤 | 定义快照、运行状态、图状态、节点账本、checkpoint、业务轨迹分别保存 |
| 恢复 | 重新运行 | 同一 thread，`invoke(null)`，读取 MySQL checkpoint 与 pending writes |
| 并发 | 串行 | DAG 就绪前沿 fan-out，map/集合 reducer，父节点已完成或跳过后汇合 |
| 向量 | 64 维哈希，最新 300 条应用层排序 | 配置的真实 Embedding → Qdrant Top-K → MySQL 权限/存活复核 |
| 混合排序 | 不同量纲分数相加 | 应用层 RRF，跨 RAGFlow/native 同样排名融合 |

执行顺序为引擎边界 → 持久化/恢复 → 向量基础设施 → 检索/迁移 → 集成测试与部署。恢复与编译共用固定定义快照，因此两部分一起接入，避免用可变定义恢复旧运行。

## Workflow 定义与兼容扩展

新增可选 `schemaVersion: 1 | 2`，不传为 1。版本 1 保留旧拓扑线性化、文本条件和 end 后仍可有节点的历史语义，但也可通过 LangGraph 执行、保存 checkpoint。旧 API 的 `succeeded` 保留，表示 Completed，避免破坏现有客户端。

版本 2 显式启用真实 DAG：

```json
{
  "name": "branch-and-join",
  "schemaVersion": 2,
  "nodes": [
    {"id":"condition","type":"if_else","config":{"expression":"yes","nextIds":["yes","no"],"trueNextIds":["yes"],"falseNextIds":["no"]}},
    {"id":"yes","type":"template_transform","config":{"template":"YES: {{input}}","nextIds":["join"]}},
    {"id":"no","type":"template_transform","config":{"template":"NO: {{input}}","nextIds":["join"]}},
    {"id":"join","type":"end","config":{"template":"{{input}}","nextIds":[]}}
  ]
}
```

- 无入边的节点作为根。普通节点所有 `nextIds` 并行激活；`if_else` 只激活 true/falseNextIds。分类节点使用 `branches[].nextIds` 和 `defaultNextIds`，所有目标必须同时声明在 nextIds。
- 汇合等待所有父节点完成或跳过，至少一条被选中入边才激活。多父输入是按节点 ID 映射的 JSON；`config.inputFrom` 可选择已执行的直接前驱。
- `end`/`dagType:output` 终止该路径，不再激活后继；多个独立终点返回 ID→输出 JSON。
- 复用现有节点类型和 adapters：工具、Agent、知识、记忆、Skill、HTTP、代码、模板等。v2 LLM 必须配置 model 或 runtimeAgentId，不把模板渲染伪装成模型执行。
- v2 拒绝环、重复/非法 ID 和未知目标；未引入未经定义的隐式循环。最大 superstep、50 节点、工作流/节点超时、每 Worker 并发、节点输出字节和直接 LLM token 上限构成资源预算。
- Vue 编辑器不自动升级旧图。调用方明确选择 schemaVersion=2，并为条件边填写版本 2 扩展后才能采用分支语义。
- `WORKFLOW_ENGINE=legacy` 只接受新的 v1 运行；失败不会自动切换引擎重跑外部副作用。

## Checkpoint、运行生命周期与副作用

`MysqlCheckpointer` 是项目自有适配器，符合官方 `BaseCheckpointSaver`，不是虚构的官方 MySQL 包。实现 getTuple/list/put/putWrites/deleteThread，使用官方 serializer。每个任务的全部 pending writes 用**单条 SQL 原子写入**；特殊 channel 索引遵循官方 WRITES_IDX_MAP。真实 SIGKILL 测试用于验证这个边界。

新增表：workflow_checkpoints、workflow_checkpoint_writes、workflow_node_executions；workflow_runs 增加引擎、AES-GCM 加密快照、owner/lease、取消标记和 attempt。checkpoint、快照、节点结果加密。保持 CHECKPOINT_ENCRYPTION_KEY 稳定，并备份此密钥及 MySQL；更换密钥不会自动迁移旧密文。

运行状态：pending → running → succeeded/failed/interrupted/cancelled；failed/interrupted 经显式恢复与 CAS 领取后进入 running。终态重复恢复不会重复完成，cancelled 不恢复。未启动的 pending 和租约失效的 running 由启动扫描及每 30 秒扫描自动恢复；失败和不确定副作用不自动恢复。

thread=`userId:runId`；运行快照包含原定义、schemaVersion、原调用选项。修改工作流不改变在途运行。60 秒数据库租约、10 秒续租；节点结果和 checkpoint 发布经过 owner fencing。多个 Worker 抢占同一 run 只有一个获得租约。

节点 ledger 保存 running/succeeded 和加密结果；恢复时已成功节点直接使用结果，不再次调用工具。纯模板/条件/检索可重试；任意工具、代码、HTTP、Agent、模型等执行到 running 后崩溃，外部效果可能已发生，因此默认阻止不确定结果重放。HTTP 发送稳定的 `Idempotency-Key: runId:nodeId`，但不能假设接收端一定支持。

自动重试、checkpoint 恢复、新建运行是三个不同操作。业务 Replay 继续使用 workflow_run_steps/Agent 原轨迹，不替换为 LangGraph history。记录节点开始、完成/失败、耗时、输入输出，常见密钥/认证字段脱敏并限长；ledger→checkpoint 间隙恢复会补齐缺失的完成轨迹。

新增认证接口（均继承现有用户权限；下表路径加现有 `/v1` 全局前缀）：

| 接口 | 用途 |
|---|---|
| GET /workflows/runs/:runId | 原业务运行与 steps |
| POST /workflows/runs/:runId/resume | 从已有 checkpoint 恢复 |
| POST /workflows/runs/:runId/cancel | 持久化取消标记 |
| GET /workflows/health/runtime | 数据库 schema/加密配置健康检查 |

## Qdrant 与 Embedding

官方客户端 `@qdrant/js-client-rest`；正式 Compose 固定 Qdrant v1.15.5 和验证过的镜像 digest，持久化 volume、健康检查、API key、无宿主端口映射。后端容器使用 http://qdrant:6333；跨主机部署应使用 TLS/私有网络。

EmbeddingProvider 接口由 OpenAI-compatible adapter 实现，可接外部 API 或本地 TEI/vLLM。优先复用现有 Provider 配置、密钥池、认证头；原 Provider 密钥存储在此仓库中实际是明文，并非已有加密体系，本次没有声称它已加密。也可单独配置端点/key。不要求本地安装模型。

必须配置模型和真实输出维度；批量、限流、超时、有限重试和结果索引/维度/有限数值校验。指纹包含 provider 名、端点、model、dimensions、revision，不包含 key。同一模型别名更新时应提升 EMBEDDING_REVISION。

Collection=`llmgather_<fingerprint前32位>`，Chunk UUID 直接作为 point ID；payload 包含 user_id/kb_id/document_id/fingerprint。知识库索引记录完整指纹、模型配置、维度、collection 和进度；不同空间不混用。Qdrant 查询预过滤用户与已授权 KB，MySQL 再复核用户、KB、文档未删除后返回正文，不信任 Qdrant payload 的正文或权限。

keyword 模式在 MySQL 全部有效 Chunk 上进行词面匹配和排序（候选结果才截断），没有“最新 300”限制；vector 模式是真实语义检索；hybrid 用 RRF。原生与 RAGFlow 的 raw score 不直接相加。RAG Lab 原参数保持。

## 跨存储一致性与迁移

knowledge_indexes 是持久化迁移/补偿任务状态。每个 KB 的写入和迁移共用数据库租约；文档修改先使索引失效，业务数据保存在 MySQL，随后生成向量/upsert。出错保留业务数据、错误状态与 batch cursor，可重试，不伪装成功。

迁移每批按稳定 UUID 顺序读取原 Chunk → 真实 Embedding → Qdrant wait=true 幂等 upsert → 保存 cursor/count。故障批次可重试；每批维度检查，最终复核 MySQL/Qdrant 数量和实际查询，再标 ready 并切换 retrieval_backend。原 embedding_json 不删除，64 维哈希不导入 Qdrant。新写入默认不生成哈希；仅显式 RAG_LEGACY_WRITE_VECTORS=true 保留旧格式备用。

新增接口（同样加 `/v1` 前缀）：POST /knowledge/bases/:id/reindex、GET /knowledge/bases/:id/index-status、GET /knowledge/retrieval-health。后者执行小型真实 embedding 探测，可能产生 API 费用。

默认 reindex 从失败批次继续；`{"reset":true}` 显式重建该 KB 的向量索引，仍保留 MySQL 数据。reset 适用于人工清理后的数量不一致、损坏 cursor 等情况。

批量迁移 CLI（先编译，设置与后端相同的数据库/Embedding/Qdrant 环境）：

```sh
cd backend
node scripts/reindex-knowledge.cjs USER_ID KB_ID
# 省略 KB_ID 时迁移该用户全部 native 知识库；重复执行可恢复进度。
```

## 依赖、环境与部署

新增固定依赖：@langchain/langgraph-checkpoint 1.1.0、@qdrant/js-client-rest 1.15.1；保留现有 LangGraph 1.3.6。开发依赖 typescript-eslint 8.71.1，补齐原先缺失的 ESLint 9 flat config；新模块使用 recommended 规则，旧代码不强制无关风格重写。Jest 对 uuid ESM 转译，以运行真实 LangGraph，而非 mock 图。

配置模板见 backend/.env.example、.env.docker.example、根 .env.example。重点配置：WORKFLOW_ENGINE、CHECKPOINT_ENCRYPTION_KEY、WORKFLOW_AUTO_RECOVER、WORKFLOW_*CONCURRENCY/TIMEOUT_MS/MAX_STEPS/MAX_NODE_BYTES、NATIVE_RAG_BACKEND、QDRANT_URL/API_KEY、EMBEDDING_PROVIDER_NAME/BASE_URL/API_KEY/MODEL/DIMENSIONS/REVISION/BATCH_SIZE/CONCURRENCY/TIMEOUT_MS/RETRIES。

```sh
# 填入实际密钥和 embedding 配置，不使用模板占位值上线。
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up -d
# 生产
docker compose --env-file .env.docker -f docker-compose.prod.yml up -d --build
```

启动 DatabaseService 在现有迁移之后执行新增 additive migration；只有 duplicate-column 错误被忽略，其他迁移失败会终止启动。新表使用 InnoDB，不依赖 Redis 缓存持久化。部署前备份 MySQL，保留 Qdrant volume，并核验 MySQL 的日志刷盘/备份策略。

回退配置：WORKFLOW_ENGINE=legacy（仅新 v1 运行），NATIVE_RAG_BACKEND=legacy（明确词面检索，仍不读最新 300 条）。历史 workflow 和 hash 数据保留；回退不 DROP 新表，也不宣称新写入具有旧哈希语义。

## 验证与当前边界

```sh
npm ci
npm --prefix backend run lint
npm --prefix backend run typecheck
npm --prefix backend test -- --runInBand
npm run build:backend
npm run build:frontend
docker compose -p llmgather-p0-test -f docker-compose.p0-test.yml --profile embedding up -d --wait
```

设置 MYSQL_HOST=127.0.0.1、MYSQL_PORT=13308、MYSQL_PASSWORD=p0-integration-only、MYSQL_DATABASE=p0_test_compose、QDRANT_URL=http://127.0.0.1:16334、QDRANT_API_KEY=p0-integration-only、EMBEDDING_BASE_URL=http://127.0.0.1:18081/v1、EMBEDDING_MODEL=BAAI/bge-small-en-v1.5、EMBEDDING_DIMENSIONS=384，然后运行 `npm --prefix backend run test:p0:integration`。这个英文小模型仅用于可复现测试，不是中文业务默认选型。首次需下载模型。

集成脚本仅接受 p0_test 开头数据库。覆盖独立进程恢复、SIGKILL、并发/重复恢复、外部副作用账本、取消、Qdrant 隔离/维度、真实模型、302 Chunk 迁移、失败批次恢复、旧数据保留、旧于最新 300 条的语义命中与三种检索模式。模型未配置时明确 SKIP 对应 E2E，不伪称通过。

边界与后续：

1. 此版本不支持循环 DAG；采用创建时拒绝，而不是无限执行。跨 Worker 的总吞吐/费用配额可进一步加入分布式调度。
2. 超时/取消会及时停止等待和发布；第三方已发出的副作用不能保证撤销，已有 Provider/工具未必支持 AbortSignal。保持不确定副作用阻断策略，需业务级幂等/对账后处理。
3. 当前文档修改会串行重建该 KB 索引，正确性优先；大量持续写入应升级为持久化 outbox、增量索引和 blue-green 发布。恢复失败迁移当前由显式 API/CLI 驱动，不是后台队列。
4. keyword 是数据库词面匹配，不是完整 BM25；大规模中文资料可另行增加 ngram/fulltext 或 sparse 索引与 reranker。
5. 外部 RAGFlow 的在线端到端测试、真实付费模型/支付工具测试需要独立环境；合同级测试不等同实际部署验证。
6. 没有增加新的工作流可视化边编辑 UI；v2 分支字段通过版本化 JSON/API 提供，旧 Vue 编辑器不静默升级。

官方接口参考：[Checkpointer](https://reference.langchain.com/javascript/langchain-langgraph-checkpoint)、[LangGraph 持久化](https://docs.langchain.com/oss/javascript/langgraph/persistence)、[Qdrant 安全](https://qdrant.tech/documentation/operations/security/)。
