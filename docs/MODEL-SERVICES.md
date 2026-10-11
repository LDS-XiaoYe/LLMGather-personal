# BGE-M3 模型服务管理：部署、架构与验收

## 1. 仓库分析与边界

项目已使用 NestJS 模块、全局 MySQL DatabaseService、自研 JWT + AdminGuard、Vue 3 / Element Plus 单页面后台及 Redis。原生 RAG 已有 QdrantService、EmbeddingService、索引租约和 RRF；RAGFlow 是独立的外部检索 Provider。工作流已使用 LangGraph，与本次模型部署队列不是同一执行器。

本次复用管理员鉴权、加密 codec、MySQL 迁移和 Qdrant 索引，不另建向量库、不修改聊天 Provider 池、不把部署任务塞入用户工作流。Redis 继续承担既有安全/缓存用途；模型队列以 MySQL 为权威，避免 Redis 丢失造成部署任务丢失。实时通知使用带 JWT 的 fetch SSE。

```text
Admin Vue → NestJS ModelServices → MySQL durable tasks / leases / audit / SSE
                                  ↓ authenticated HMAC + HTTPS
                         independent Deployment Agent
                           ↓ verified canonical cache
                 Docker CPU / NVIDIA CUDA / native MLX + launchd
                                  ↓ loopback inference
Knowledge → frozen embedding descriptor → signed Agent proxy → BGE-M3
         → existing QdrantService → per-fingerprint collection + tenant filtering
```

### 文件组织

- `deployment-agent/registry.json`：唯一模型/运行时清单；后端与 Agent 共用，数据库同步定义快照。
- `deployment-agent/download.cjs`：HuggingFaceDownloadProvider、ModelScopeDownloadProvider、ModelDownloadService。
- `deployment-agent/runtime.cjs`：统一 ModelRuntimeAdapter 及三种具体适配器；Apple 不继承 Docker 接口。
- `deployment-agent/server.cjs`：受限控制 API、原子 Agent 状态、任务去重/恢复、desired/actual 协调。
- `backend/src/model-services/`：节点认证客户端、DB 队列、SSE、审计、管理控制器、受管 Embedding。
- `backend/src/database/migrations/model-services.ts`：可重复执行的增量迁移。
- `frontend/src/components/ModelServiceManagement.vue`：类型化管理页面与六步向导。
- `frontend/src/components/KnowledgeEmbeddingSelector.vue`：新知识库模型选择、现有 KB 显式绑定/重新索引。
- `backend/scripts/model-services-integration.cjs`、`deployment-agent/scripts/acceptance.cjs`：真实服务验收。

## 2. 注册表与兼容性矩阵

BGE-M3：约 568M 参数、1024 维、原始上下文上限 8192 tokens，协议 OpenAI-compatible embeddings。原始权重 HF revision：`5617a9f61b028005a4858fdac845db406aefb181`。模型文件包括 PyTorch `.bin`、tokenizer、config 等；TEI Candle 实测可加载，不依赖未提供的 safetensors。

| 计算模式 | 精度 / 有效输入上限 | 固定 TEI 版本 | 验证情况 |
|---|---|---|---|
| Linux amd64 Docker CPU | float32 / 1024 tokens，明确自动截断 | cpu-1.8 | 本机 Docker Linux daemon：真实 BGE-M3 2×1024 + stop/start/restart |
| NVIDIA CC8.6（典型 RTX30） | float16 / 8192 | 86-1.9 | 官方矩阵与选型单测，未做 RTX30 真机推理 |
| NVIDIA CC8.9（典型 RTX40） | float16 / 8192 | 89-1.9 | 官方矩阵与选型单测，未做 RTX40 真机推理 |
| NVIDIA CC12.0（RTX50 / Blackwell） | float16 / 8192 | 120-1.9，实验 | RTX5070 / driver610.88 / 12GB：实际 FlashBert on CUDA、真实 2×1024 + 生命周期通过 |
| macOS arm64 Apple M 系列 | MLX FP16 / 8192 | mlx0.32.3 + mlx-embeddings0.1.0 | 适配器/输入契约测试，Metal / 加载 / launchd / 真正推理仍待 Mac 验收 |

所有 TEI 镜像 **同时锁定 tag 和 manifest SHA256**，完整 digest 见注册表。CC 选择是精确匹配；未登记架构、无 Toolkit、显存不足、旧驱动均明确报错。Blackwell 需管理员勾选实验确认；Agent 健康验证还检查 DeviceRequests 与 CUDA 日志，识别 TEI 的 CPU fallback，不以“容器在运行”冒充 GPU 推理。

CPU 启动时 8192-token Candle 预热在本次资源约束下失败。固定 1024 + auto-truncate 已真实验证；这是明确的资源/上下文取舍，登记在向量指纹中，不声称 CPU 8K 已通过。CPU / GPU 的精度与运行时指纹不同，禁止混写。

Apple 使用 `mlx-community/bge-m3-mlx-fp16` revision `a37eddded9a6a1273a87fb8b0da0d1cdbd98aeec`，**不是直接加载原版 PyTorch 权重**，只登记 Hugging Face 来源。该社区转换模型的向量等价性未验证；独立 variant / pooling / precision / runtime 指纹保证不复用原版索引。暂未提供 8-bit / 4-bit 选项。

扩展模型时在清单声明 immutable revisions、完整文件摘要、资源要求与运行时矩阵；实现相应协议/适配器。当前自动注册仅针对本阶段 Embedding 服务，不把未来 Rerank 当成 Embedding。

## 3. 节点一次性安装

计算节点管理员一次性安装 Node.js >=22 和相应宿主依赖、固定仓库路径并运行：

```sh
npm ci
node deployment-agent/scripts/install.cjs
```

脚本生成固定设备 UUID 和随机 48-byte 凭证，保存于 `~/.llmgather/agent/agent.env.json`（Unix 0600，Windows 去除继承并限定当前用户 ACL）。只输出设备 ID 与凭证文件路径，不输出密钥。首次注册在后台输入文件中的设备 ID / Token；后端 AES-GCM 加密保存。安装脚本不替代 Docker / GPU 驱动等宿主权限安装。

- Linux：创建 `~/.config/systemd/user/llmgather-agent.service`，启用 user service。需要 Docker 访问权限；无人值守重启可由宿主管理员配置 user lingering。
- macOS：先安装 Python3（支持 venv）、Node22，使用 arm64 原生进程。生成 `~/Library/LaunchAgents/io.llmgather.deployment-agent.plist` 并 bootstrap 当前用户 launchd。登录时自动运行 Agent；Agent 30 秒协调会恢复 desired=RUNNING 的模型 launchd 作业。macOS 登录前运行/system LaunchDaemon 与安装脚本真机验收尚待完成。
- Windows：创建用户登录时执行的 Scheduled Task，运行 Node launcher；Windows 上 CPU/NVIDIA 使用 Docker Desktop 的 Linux daemon。登录任务安装尚未实际执行，以免修改当前用户系统启动项；本机直接启动 Agent 的 CPU/CUDA 实测已通过。

模型操作通过后台完成：Apple 首次部署自动创建 `mlx-venv`、安装固定 requirements，校验 Metal，下载专属 FP16 变体，生成受管 launchd plist，加载模型并做实际 Embedding 探针。macOS 模型内存参数约束 MLX allocator/cache，非硬性的全进程 RSS/cgroup 上限。Metal 不可用或 MLX 加载失败会标记失败，不返回伪向量。

### 远程节点

Agent 默认绑定 `127.0.0.1:19090`。远程节点在受控网络中配置 `AGENT_HOST`、`AGENT_TLS_CERT`、`AGENT_TLS_KEY`，后端设置 `MODEL_AGENT_ALLOWED_HOSTS=host1.example,mac-mini.example,...`，使用受后端信任的 HTTPS 证书。自签名证书通过 `NODE_EXTRA_CA_CERTS` 登记，不关闭 TLS 校验。HMAC 签名覆盖 method/path/timestamp/nonce/body hash；30 秒时窗 + nonce 防重放，双方时间需同步。后端 DNS 一次解析并固定连接地址、不跟随 Agent 重定向。

首次“检测并注册”真实读取设备身份和硬件；离线节点禁用部署，运行中断线显示 OFFLINE，不显示成功。浏览器设备从来不是隐式部署目标。换凭证先修改节点 `agent.env.json` 并重启 Agent，再使用同一设备 ID 在后台重新注册。

## 4. CPU / NVIDIA / Apple 环境要求

- CPU：Linux amd64 Docker daemon；至少 2 CPU、6144MiB 模型内存预算，缓存至少 6144MiB。实测采用 4CPU/8192MiB。ARM Docker CPU 镜像未支持，明确拒绝。
- NVIDIA：安装适配 GPU 的驱动及 NVIDIA Container Toolkit。普通架构版本门槛 535，Blackwell 门槛 570；具体镜像/驱动组合以真实健康探针为准。当前实测驱动610.88。节点原生 Agent 用 nvidia-smi 获取 UUID、CC、显存，再通过 Docker `--gpus device=UUID` 精确分配。
- Apple：macOS14+、arm64、Apple M 系列、至少6GiB统一内存预算、可用 Python venv/网络、Metal。模型运行于宿主，不使用 Docker Desktop Linux容器模拟 Metal。

NVIDIA 宿主安装参考官方 Toolkit 文档（见末尾），完成后在节点检测中确认 docker.nvidiaRuntime=true 与实际 GPU 列表。这里不向业务后端授予 Docker权限。

## 5. 双源下载与缓存

- 自动：ModelScope 优先，失败后才尝试相同 canonical manifest 的 Hugging Face。
- Hugging Face：所有文件 URL 固定 HF commit。
- ModelScope：每个文件 URL 使用该文件的 immutable Revision；其实际字节须与 HF 清单的 SHA256 / Git blob SHA1 一致。权重 SHA256：`b5e0ce3470abf5ef3831aa1bd5553b486803e83251590ab7ff35a117cf6aad38`。
- Apple MLX：HF-only；源选项真实禁用 ModelScope，不伪造双源。

缓存路径：`AGENT_DATA_DIR/cache/<manifest-hash>`。临时下载在同级 `<hash>.partial`；磁盘空间预检、Range断点续传、失败重试与实际字节计数。每个文件验证后继续，所有摘要匹配才写 COMPLETE.json 并原子 rename。缓存复用也重新检查摘要；不完整/损坏缓存不挂载给推理服务。取消保留临时文件供后续新任务恢复。

首次两源全量下载均已实际完成，canonical bytes一致（约2.29GB含tokenizer）。自动回退、Range、缓存复用、损坏拒绝另有确定性单测。可配置 HF_TOKEN / MODELSCOPE_TOKEN；公开 BGE-M3 实测未使用 Token。下载代理读取 HTTP_PROXY / HTTPS_PROXY / NO_PROXY。

停止不删权重；卸载只删服务；“删除缓存”仅在没有任何已安装实例引用该 cacheKey 时执行。多个实例共享相同缓存，但其向量空间仍由运行时/精度等决定。

### 可选 Linux CPU Agent Docker Compose

```sh
cp deployment-agent/.env.example deployment-agent/.env
# 填写随机 AGENT_ID / AGENT_TOKEN（示例仅占位）
docker compose --env-file deployment-agent/.env -f docker-compose.model-agent.yml up -d --build
```

只该独立 Agent 挂 Docker Socket；业务 Compose 不增加 Socket挂载。模型缓存 volume 固定为 `llmgather_model_cache`，子容器只读挂载；状态在独立 model_agent_state volume。host networking 使 Agent 能访问子容器回环推理端口。这个可选镜像用于 LinuxCPU节点；GPU发现和macOS优先用宿主原生Agent。具体基础镜像 tag+digest 已核验，镜像构建结果见验收记录；非 Linux host networking 行为不作跨平台保证。

## 6. 后台与知识库操作

1. 管理员进入系统配置 → 模型服务管理，检测并注册节点。
2. 六步向导：模型 → 在线节点 → 硬件后端/ GPU → 下载源 → CPU/RAM资源与实验确认 → revision/config确认。
3. 进度来自 Agent/数据库真实阶段与字节；SSE以 JWT header鉴权，重连按事件ID续读，不把Token放URL，不用前端假计时进度。
4. 实际推理探针通过后进入 REGISTERING_PROVIDER，注册成功才 COMPLETED。
5. 实例支持 start/stop/restart、日志、实时 Docker stats / GPU硬件与MLX指标、更新（新实例）、卸载、删除缓存。stop/remove需要确认并列出受影响KB。
6. 健康实例可设为默认，只作用于**未来新KB**。旧KB的 embedding_instance_id / embedding_spec_json 不变。
7. 新知识库可以选择管理实例；原生 RAG实验台可显式切换模型、重新索引。RAGFlow仍用其外部模型，不通过本控件修改。

索引冻结 descriptor = model / dimensions / revision / endpoint(内部managed://ID) / fingerprint。fingerprint覆盖原始revision、格式变体、精度、pooling、固定runtime、有效上下文等。CPU/GPU/MLX不混写；查询按不同指纹分组Embedding/Qdrant查询再RRF合并。服务停止或节点离线返回明确错误，不静默回退到另一个模型。切换绑定取得KB索引租约、置legacy/pending，再手动索引；现有Qdrant旧集合保留。

## 7. 持久化、恢复和并发

新增表：model_definitions、model_nodes、model_instances、model_tasks、model_downloads、model_events、model_audit、model_settings。knowledge_bases新增 embedding_instance_id、embedding_spec_json。迁移为增量可重复执行，已有P0表/数据不删。

- model_instances 分离 desired_state / actual_state / provider_registered，operation_id以CAS排他。
- model_tasks 使用客户端UUID幂等键与payload hash、90秒DB时钟租约、owner fencing；多个业务worker只允许租约持有者完成任务状态。实例锁残留和终态任务锁由协调器恢复。
- Agent JSON fsync+rename原子状态，进程lock排除双实例；重启把RUNNING任务放回PENDING，download.partial恢复，已创建受管容器按labels接管。
- 后端2秒轮询签名Agent状态并持久化事件/下载记录；网络中断保留可重试任务及相同ID，不生成成功状态。Agent30秒按desired协调停止/异常退出的服务。
- 下载/部署取消终止下载signal，失败部署停止受管服务并标记FAILED，不加载残缺模型。已有实例配置immutable，更新部署新实例而非偷偷替换旧向量空间。

失败任务恢复：相同任务UUID仅返回原任务（不重复部署）；想再次尝试时提交**新taskId、原instanceId与相同config**，保留缓存/断点。页面“更新”创建新实例；同实例重试可调用固定tasks API（见下例）。模型定义升级需要审核revision/hashes/runtime manifest并版本提交，不运行任意“最新模型”。

```json
{"taskId":"NEW_UUID","instanceId":"FAILED_INSTANCE_UUID","nodeId":"REGISTERED_NODE_UUID","action":"deploy","config":{"modelId":"bge-m3","backend":"cpu","source":"auto","cpu":4,"memoryMiB":8192}}
```

## 8. 环境变量与安全

业务后端新增 MODEL_AGENT_ALLOWED_HOSTS；复用稳定的 CHECKPOINT_ENCRYPTION_KEY。默认模型保存在 model_settings，不修改全局EMBEDDING_*，未绑定受管模型的旧KB继续用原环境Provider。

Agent：AGENT_ID、AGENT_TOKEN、AGENT_DATA_DIR、AGENT_HOST、AGENT_PORT、AGENT_TLS_CERT/KEY、AGENT_PYTHON、HF_TOKEN、MODELSCOPE_TOKEN、代理变量；可选DockerCPU Agent使用AGENT_CACHE_VOLUME固定命名volume。密钥通过节点本地配置传递，不从部署UI接受文件路径/镜像/命令。

只允许登记实例的deploy/start/stop/restart/remove/cache-delete/inference/logs/metrics。固定模型清单和资源字段白名单；无shell、privileged、任意挂载、任意容器API。子容器cap-drop、read-only、no-new-privileges、CPU/RAM/pids限制和loopback publish，日志限量。移除前校验managed/agent labels。认证/输入不写日志，错误和输出做边界控制。宿主Agent有Docker控制能力，须作为独立可信控制平面保护，不能开放给普通用户。

## 9. 测试命令与当前验收

```sh
npm --prefix deployment-agent test
python -m unittest discover -s deployment-agent/native -p 'test_*.py'
npm --prefix backend run lint
npm --prefix backend run typecheck
npm --prefix backend test -- --runInBand
npm --prefix backend run build
npm --prefix frontend run build
# 单独真实硬件测试（缓存保留，临时受管服务卸载）
node deployment-agent/scripts/acceptance.cjs cpu nvidia
node deployment-agent/scripts/download-acceptance.cjs
# macOS 真机：node deployment-agent/scripts/acceptance.cjs apple
# 设置隔离 p0_test MySQL / Redis / Qdrant 环境后执行：
node backend/scripts/model-services-integration.cjs
```

硬件脚本保存 agent-state/acceptance.json、CPU/CUDA运行日志；HTTP集成脚本断言管理员/普通用户/Agent鉴权、幂等部署、Provider注册、真实向量与Qdrant召回、KB所有权、停止依赖、SSE、worker重建及离线状态。单测不代替真机结果。

本次可用硬件：Windows i9-13900KF、Docker Linux amd64、RTX5070(CC12.0/driver610.88/12GB)。CPU实测约2.99GiB RSS，GPU容器RSS约1.46GiB（不是显存占用；GPU指标通过nvidia-smi查询）。两种模式真实2×1024与stop/start/restart通过；Agent与后端Docker镜像实际构建通过，Agent Docker CLI28.5.1能连接Server29.5.2。Apple M1/M2/M3/M4、RTX30、RTX40、远程TLS/重新启动整台计算节点、开机安装器及UI浏览器点选均需进一步相应环境验收，未声称通过。

## 10. 常见问题 / 后续验证

- Agent离线：检查user service/端口/HTTPS信任/主机allowlist/两端时钟；节点重新在线后协调器恢复任务。
- download失败：检查代理与源域名，Token是否有效、disk.space、revision文件摘要；改源也不得绕过checksum。损坏正式缓存需管理员卸载引用实例并删除缓存再部署。
- CPU不断退出：检查容器memory、warmup日志；使用已验证1024-token策略，不直接打开8K并声称资源足够。
- GPU无法分配：检查Toolkit/runtime、UUID、CC、驱动；Blackwell实验确认与独立120镜像；健康检查拒绝CPU回退。
- Apple prepare失败：检查Pythonvenv、固定包、macOS14+/arm64/Metal，结合native stderr；MLX权重加载及pooling需真实Mac验证。
- KB需要reindex：模型指纹变更或新绑定后必须重建；维度相同也不等价。旧索引不会迁入新模型空间。
- 事件/审计表目前无自动保留期限清理；大规模节点调度、长时间压力与任务租约故障注入需追加。默认顺序处理节点，离线请求10秒超时，未声明百节点高吞吐。
- 原生macOS内存为MLX allocator预算，非进程RSS硬限制；macOS登录前后台常驻需LaunchDaemon部署方案。

## 官方依据

- [BGE-M3 模型与输出](https://huggingface.co/BAAI/bge-m3)
- [TEI 支持硬件与 Blackwell 实验镜像](https://huggingface.co/docs/text-embeddings-inference/en/supported_models)
- [ModelScope 官方 Hub API](https://github.com/modelscope/modelscope/blob/master/modelscope/hub/api.py)
- [ModelScope 文件下载实现](https://github.com/modelscope/modelscope/blob/master/modelscope/hub/file_download.py)
- [NVIDIA Container Toolkit 安装](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)
- [MLX Embeddings 作者实现](https://github.com/Blaizzy/mlx-embeddings)
- [MLX FP16 BGE-M3 变体](https://huggingface.co/mlx-community/bge-m3-mlx-fp16)
- [MLX 0.32.3 内存控制](https://ml-explore.github.io/mlx/build/html/python/_autosummary/mlx.core.set_memory_limit.html)
