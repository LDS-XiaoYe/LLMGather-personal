# RAG 关键词与混合检索设计审计与修复

审计：2026-10-12；修复验收：2026-10-13。

## 当前状态：基础缺陷已修复

检索架构保持 **BGE-M3 Dense + Qdrant + MySQL lexical + RRF**，没有新增搜索服务，也没有把 Dense 服务描述为已经支持 Sparse/ColBERT。

| 模式 | 当前行为 |
| --- | --- |
| 关键词 | 中文词项切分、停用词过滤；MySQL ngram FULLTEXT 召回正文和标题；技术标识补充边界匹配；不调用 embedding。 |
| 向量 | 按模型指纹分组，验证索引就绪；Dense 检索后回 MySQL 校验归属及有效资料；保留原始余弦分数。 |
| 混合 | 两路候选通过加权 RRF 融合；正文证据优先于仅标题命中；保留原始分数、排名与来源；同一文档最多 3 个片段。 |

### 本次修复

- 查询最多保留 48 个词项，技术实体及短 Latin 标识优先；超长实体列表兼顾首尾。C++、C#、版本号、错误码不再直接丢弃，104 不匹配 1040；实体之间采用 OR，支持比较问题。关键词模式仍是词面检索，不等于自然语言理解或布尔查询编辑器。
- FULLTEXT 用作候选召回，应用层按实体/普通词的加权覆盖度重排：正文权重 4、标题 0.4，全文分数仅做小幅补充。该评分不是 BM25，也不是置信度。
- 原生 Dense/lexical 融合初始权重 1 / 0.7，RRF 常数 60；只有一个非空列表时保留原始分数，不再无意义重复融合。跨 provider 仍需合并排名；不同模型空间的公平性继续列为评测项。
- 实验台默认严格报错；生产 Agent 显式启用分路降级，保留就绪知识库/可用检索路，轨迹记录 requestedMode、effectiveMode、degraded 和失败路。鉴权/知识库归属/非法参数错误仍传播。所有路径均失败时仍报错。
- 实验台新增可选的原始余弦门槛（默认关闭，数值 0.2 只是可编辑的试验初值，不是标定结论），同时传入 Qdrant 并在回读前验证。生产 Agent 未启用统一门槛。重排模型与无答案质量校准仍待评测。
- RAGFlow 三种模式映射其官方 API 的两类相似度权重；保留外部原始分数，外部 HTTP 错误状态用于区分降级与鉴权失败。外部相似度门槛仍由外部引擎管理。
- 实验台保存查询快照；查询条件、登录用户、API 地址或模型绑定变化时清空旧结果；失败不保留旧答案；请求代次阻止晚到响应覆盖新结果。检索期间禁用相关控件。
- 页面分别显示向量/词面/融合分数和排名，融合保留 6 位小数；控件与分数标签可以换行，避免窄列横向裁切。

### 部署与数据

数据库启动流程自动将正文全文索引替换为 ngram，并添加标题 ngram 索引；再次启动跳过已正确配置的索引。MySQL 8 同名索引在一个 ALTER 中 DROP/ADD 时可能保留旧 parser，因此使用分步 DDL，并支持中断后重试恢复。首次升级会重建全文索引，耗时取决于资料量。

当前 Docker 开发环境已重启前后端，实际 SHOW CREATE TABLE 验证两个索引均使用 ngram，后端健康接口返回 200。此次没有修改文档正文、知识库绑定或 Qdrant 向量，也不需要管理员修改 .env、重新下载模型或重新生成 embedding。

### 验收与边界

- 后端定向回归：4 套件、18 测试通过；前端查询快照/失败/晚到响应：3 测试通过。
- 前后端 TypeScript 检查均通过。
- 实际 MySQL 8.0.46 独立合成数据库：7 类检索通过，覆盖中文整句、标题/正文排序、C++、C++/C# 比较、数字边界、长查询末尾实体及 AI/GPU 短标识；验证删除资料与其他用户隔离、迁移幂等和正文 FULLTEXT 执行计划。测试数据库已清理，业务资料未写入。
- 实际 Vue 组件浏览器验证使用合成响应：模式切换清空结果、报错不留旧结果，各分数标签正确；1280 / 375 像素下实验台无横向溢出。它不是线上登录账户或真实 BGE-M3 的端到端质量测量。
- 尚未做大资料量压测、真实 BGE-M3 标注问答评测或连接运行中的 RAGFlow；不能据此承诺召回率或延迟。需按资料校准权重、阈值与候选深度，再决定 Sparse、BM25 或 reranker。

回归入口：backend/src/knowledge/retrieval/retrieval.spec.ts、backend/src/database/migrations/knowledge-lexical.spec.ts、backend/src/knowledge/knowledge.service.spec.ts、frontend/test/rag-lab-session.test.cjs。

---

## 历史审计记录（修复前状态）

以下位置、结论和历史复现结果记录的是修复前代码；旧复现断言不适用于当前实现。临时复现与验收文件已按要求清理，正式检索回归测试仍保留在源码目录。

## 方法与证据

- 阅读前端查询处理、搜索 DTO/Controller、KnowledgeService、NativeRetrievalService、Qdrant、索引就绪检查、RRF、RAGFlow 适配器与 Agent 知识上下文消费链路。
- 加载仓库实际 TypeScript 函数；数据库、模型依赖使用受控替身。没有初始化应用数据库、调用真实 embedding、创建知识库或执行写入。
- 关键词复现使用实际函数产生的词项/SQL 评分表达式，在当前 MySQL 上对 SELECT/UNION ALL 构造的合成行执行。使用实际字段的 `utf8mb4_unicode_ci` 排序规则，不是只用 JavaScript 猜测 SQL 行为。
- 只读检查实际数据库索引与 EXPLAIN。当前 MySQL `8.0.46`，运行后端 `NATIVE_RAG_BACKEND=qdrant`；数据库总共 3 个片段、3 个有效文档。这不是规模压测，也不代表真实问答质量基准。
- 定向运行已有 RRF、KnowledgeService 测试：2 个测试套件、4 个测试通过。新增私有审计程序记录了 9 类检索/展示行为及 1 项 RRF 正确性检查；其中模型空间分组属于需评测项，并非直接判定为缺陷。
- 模型分数、索引失败和 RAGFlow 响应是受控输入，证明当前代码对这些输入的处理，不是对 BGE-M3 实际语义质量的测量。

当时的临时复现输出包含被加载源码的 SHA-256；临时程序与输出现已清理，本报告保留历史审计结果。

## 实际调用链

```text
RAG Lab：query / mode / limit
  → POST knowledge/bases/:id/search
  → KnowledgeService：校验知识库归属；候选深度 = min(200, 4 × topK)
  → NativeRetrievalService
      keyword：MySQL LOCATE，按命中词项数排序
      vector：按 embedding fingerprint 分组，查询向量 → Qdrant Cosine
      hybrid：上述两路列表进行 RRF
  → KnowledgeService：再次按 provider 列表执行 RRF
  → 前端：只展示片段及 score.toFixed(3)
```

NativeRetrievalService 又扩张一次候选深度。实验台 topK=5 时，外层请求 20，内层关键词/向量各请求最多 80，内层返回 20，外层返回 5。候选深度偏大或偏小是否合适需要评测；两次扩张本身不是结果错误。

## 已确认问题

### 1. P1：中文问句和技术标识的词项处理不合格

位置：`backend/src/knowledge/retrieval/native-retrieval.service.ts:67–71`。

当前正则提取连续中文串，以及长度至少 2 的 ASCII 字母/数字/下划线串；没有中文分词、停用词或技术实体保留策略，再直接截取前 16 个词项。

| 输入 | 实际词项/行为 | 复现结果 |
| --- | --- | --- |
| `如何申请退款` | 整句只有一个词项 | 文档标题为“退款流程”、正文包含退款步骤，仍返回空 |
| `退款 订单号` | 两个词项 | 同一批合成文档可以命中正确步骤 |
| `C++ 内存泄漏` | 只剩“内存泄漏” | `C++` 被丢弃，语言限定条件失效 |
| `C# 连接 MySQL` | 只剩“连接”“mysql” | `C#` 被丢弃，命中一般 MySQL 说明 |
| `104` | 任意子串匹配 | 只含 `1040` 的文档也命中 |
| `how do I apply for a refund` | 保留 how/do/apply/for/refund | 与退款无关的“How to install a model service”命中 |
| 17 个前置词后跟 `E104` | 截取前 16 项 | 后面的错误码被完全舍弃 |

单独输入 `C++` 时，正则无匹配会回退到完整查询，可能命中；因此问题是**混合输入时关键标识会丢失**，不是任何 C++ 查询都失效。

建议：中文采用可控分词/候选 ngram；保留错误码、版本号、C++/C# 等实体与必要精确匹配；设置停用词和词项预算优先级。所有策略必须覆盖中文、英文、混合标识测试。

### 2. P1：命中计数和标题传播导致伪相关片段占位，并损害混合排序

位置：`native-retrieval.service.ts:71–79`；`retrieval/rrf.ts:15–20`。

评分表达式只判断每个词项“有没有出现”，标题和正文拼接后等权；不考虑词项稀有度、词频、文本长度、短语/实体完整度。所有片段共享文档标题，标题命中会让该文档的无关片段也进入候选列表。同分时按片段 ID 排序，而非内容相关度；仅按 chunk ID 去重，也没有文档级多样性控制。

合成 SQL 复现：两个片段标题都是“退款流程”，片段 a 的正文是团建安排，片段 b 的正文是真正退款步骤。查询“退款”时两者都是 1 分，a 排在 b 前。

使用实际 NativeRetrievalService/RRF，再输入受控向量排序：

```text
关键词：a → b
向量：  b(0.93) → a(0.08)
混合：  a → b；两者都是 1/61 + 1/62 = 0.03252247488101534
```

RRF 不读取余弦值大小，最终按 ID 打破平局。该复现不是说 RRF 算错，也不是说真实 BGE-M3 必然产生这些分数；它证明弱词面排序能够取消语义路的正确排序。

建议：先改善 lexical 的相关度排序，再融合；单独处理标题命中与正文命中；限制同文档片段占位，合并重叠片段。Dense、lexical 和融合排名/原始分数应保留到调试结果中。

### 3. P1（多知识库生产调用）：一个未就绪知识库会使整次混合检索失败

位置：`native-retrieval.service.ts:36–43,46`；`knowledge-index.service.ts:217–226`；`agents.service.ts:1454–1488`。

关键词先完成，但 `describe`、索引校验、embedding 或 Qdrant 任一路失败，函数直接抛错，不返回已完成的关键词/其他知识库结果。复现中关键词有 1 条结果，一个就绪分组已完成向量召回，随后另一知识库索引失败，整个搜索仍拒绝。

Agent 上层记录检索失败后继续执行，已完成的知识库检索结果不进入上下文。

**实验台严格报错具有合理性**，不能静默把混合测试伪装成关键词测试。生产 Agent 则应有显式可配置的降级策略：按知识库/召回路隔离失败，返回 `requestedMode`、`effectiveMode`、`degraded`、失败原因，并在轨迹和 UI 中显示。鉴权失败、数据归属不合法不得转换成成功降级。

### 4. P2：没有语义相关度门槛或重排拒绝机制

位置：`qdrant.service.ts:150–177`；`native-retrieval.service.ts:46–64`。

Qdrant 请求没有 `score_threshold`，返回片段只做有效性与归属校验，没有语义相关性过滤；也没有检索后的相关度重排。受控输入中原始余弦值仅 `0.0001` 的片段仍进入混合结果，并取得 RRF `0.01639344262295082`。

这证明机制上会接受弱相关候选，不证明现有资料一定大量误召回。不能硬编码一个未经标定的统一余弦阈值；应按模型/数据集评测门槛，必要时增加重排与“没有足够相关资料”的处理。RRF 分数不能冒充语义相似度或置信度。

### 5. P2：外层 RRF 销毁分数含义，实验台无法用当前 score 比较模式效果

位置：`knowledge.service.ts:623`；`RagModule.vue:410`。

即使只有一个原生知识库、一个 provider 列表，也再次执行 RRF。单列表时排序不变，但原始余弦分数、关键词命中数或内层融合分数都被改写成排名分数。

复现：原始分数 `0.91` 与 `0.002`，最终分别变成 `0.01639344262295082` 与 `0.016129032258064516`；前端都显示 `0.016`。

建议：单列表不要无意义地再融合；跨 provider 融合时保留各层分数与来源。返回 `denseScore`、`lexicalScore`、各路 rank、`fusionScore` 和 `scoreType`，页面明确显示分数类型，融合分数至少保留足够精度。效果评估以相关片段命中与排序指标为准，不比较不同量纲 raw score。

### 6. P2：实验台模式改变/检索失败时旧结果没有归属标识

位置：`useAppController.ts:3283–3300`；`RagModule.vue:389–410`。

切换模式只修改当前控件状态；结果没有关联上次执行时的知识库、问题和模式。搜索失败时 catch 只更新 status，未清理或标记旧结果。使用实际 handler 复现：新模式为 keyword，请求报错后，结果数组仍是 `previous-vector-hit`。

这会让用户把旧查询/旧模式结果当成新模式结果。请求执行期间控件也未全部禁用；响应返回时缺少请求快照核对。

建议：每次执行保存查询快照/请求 ID；变更条件后标为“待重新检索”；失败清空结果或明确显示“上次成功结果”；模式标签取执行快照，而不是当前控件值。过期响应不得冒充当前查询结果。

### 7. P2：RAGFlow 的三个选项没有实际区别

位置：`ragflow-retrieval.provider.ts:16–22`；`knowledge.service.ts:829–839`。

适配器的 `_mode` 参数没有使用，外部请求只传 question、dataset_ids、page、page_size。受控 callback 在 keyword/vector/hybrid 下收到相同参数并返回相同结果。

此问题影响 RAGFlow 知识库，不影响原生 BGE-M3 的模式切换。应根据外部引擎实际能力映射参数；若不提供这些模式，前端应显示“由外部引擎决定”而不是提供无效选择。

### 8. P2（扩展性）：已有 FULLTEXT 索引没有参与当前关键词查询

位置：`database.service.ts:574–586`；`native-retrieval.service.ts:71–79`。

当前库确实存在 `ft_kb_chunks_content` FULLTEXT 索引，但查询使用 `LOCATE(LOWER(CONCAT(...)))` 而非全文检索。实际 EXPLAIN 使用知识库范围 BTREE、主键连接，伴随 temporary/filesort，未使用 FULLTEXT。LIMIT 限制返回数量，不免除候选范围内正文扫描与评分。

因此不是“完全没有任何索引、扫描全库”，而是**范围索引先筛出知识库片段，范围内仍做文本表达式匹配**。当前只有 3 个片段，尚未证明延迟超标；片段和并发增长后的成本是明确扩展性风险。

建议：近期在不新增服务的前提下验证 MySQL ngram FULLTEXT 方案，并检查现有索引解析器、重建索引、停用词、短词、精确标识及跨标题/正文权重。MySQL FULLTEXT 不能未经验证就称为 BM25，也不能仅把 SQL 改成 MATCH 就宣称中文检索已修复。

## 需评测而非直接判定为错误的设计

- RRF 常数 60、等权融合是可行初始方案，不是天然 bug。应对中文问句、精确标识、无答案问题、长查询分别评测候选深度、权重和融合常数。
- 多个 embedding fingerprint 产生多个 Dense 列表，每个列表单独获得一次排名贡献；这能避开跨模型 raw score 不可比的问题，但会改变不同知识库的曝光。需明确分组公平策略与多知识库评测，不宜把不同模型余弦值直接合并排序。
- 加 reranker 可以改善排序，但不能找回已被词项处理/候选截断丢掉的片段；不应先加复杂模型掩盖基础召回问题。

## 保留的合理设计

- keyword 分支不依赖 embedding/Qdrant，确实能独立运行。
- 关键词对全部有效范围内片段评分后才截断，没有固定只查“最新 300 条”的遗漏。
- 模型指纹分组、索引就绪与向量维度检查避免新旧模型空间混用。
- 关键词 SQL 使用绑定参数；入口校验知识库归属，检索过滤有效文档与有效知识库；向量命中回 MySQL 读取授权且未删除的正文，不信任 Qdrant payload 中的正文。
- RRF 能融合不同量纲列表，当前去重和固定同分排序可复现；已有测试验证这些基本性质。

## 建议落地顺序

1. 修复实验台结果快照、失败/过期结果标识、分数来源，让测试工具先能可信对比。
2. 完善词项处理、精确实体、中文 lexical 排序及标题/文档多样性；优先验证 MySQL ngram 方案，不必立即增加搜索服务。
3. 统一融合层与结果元数据；为生产 Agent 增加显式分路降级，实验台默认严格模式。
4. 用标注问题集比较 Dense、lexical、hybrid 的 Recall@K、MRR/nDCG、无答案误召回率与延迟，再决定是否引入 BGE-M3 Sparse、BM25 索引或 reranker。

验收数据应至少覆盖中文完整问句、技术标识、英文停用词、标题相同正文不同、同文档多片段、无答案、多个知识库/模型空间、索引未就绪、Qdrant/embedding 超时及外部知识库。评测集和门槛需在执行前约定；此次没有生成虚构性能或命中率。

## 复现命令及结果

以下为清理前的历史复现结果。临时只读数据库复现脚本已删除，不再提供该脚本的执行命令。

输出包含 9 组 SQL 查询、10 项行为记录及索引/执行计划；断言全部通过，退出状态 0。这里“通过”表示已按预期复现记录中的行为，并不表示缺陷已修复。

```powershell
node node_modules/jest/bin/jest.js --config backend/jest.config.js --runInBand --runTestsByPath backend/src/knowledge/retrieval/rrf.spec.ts backend/src/knowledge/knowledge.service.spec.ts
```

结果：`Test Suites: 2 passed, 2 total`；`Tests: 4 passed, 4 total`；退出状态 0。原生关键词/混合的中文与排序质量缺少专门回归用例，已有测试通过不能证明检索质量合格。

## 官方资料核对

- [Qdrant Hybrid Queries](https://qdrant.tech/documentation/search/hybrid-queries/)：RRF 基于排名融合，不应解释为原始语义相似度。
- [MySQL 8.0 ngram Full-Text Parser](https://dev.mysql.com/doc/refman/8.0/en/fulltext-search-ngram.html)：CJK ngram 解析器及词项、停用词行为。
- [BAAI BGE-M3 模型说明](https://huggingface.co/BAAI/bge-m3)：Dense、Sparse、多向量是不同输出；部署 Dense 服务不意味着所有检索能力均已接入。
