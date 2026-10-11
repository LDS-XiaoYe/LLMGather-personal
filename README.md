# LLM Gather — 大模型智能体聚合平台
使用前首先安装 Docker。
## Docker 一键启动

到根目录里把 .env.docker.example 复制为 .env.docker，并填写实际密钥与 Embedding 配置

在终端输入下面的指令
```cmd
docker compose --env-file .env.docker up -d
```
访问 http://localhost:5174 打开前端。



## P0 核心架构

Workflow 引擎、MySQL Checkpoint/恢复、Qdrant/Embedding、迁移及部署参见 [P0 架构与运行手册](docs/P0-ARCHITECTURE.md)。

执行验证：`npm --prefix backend run lint`、`npm --prefix backend run typecheck`、`npm --prefix backend test -- --runInBand`；真实服务脚本：`npm --prefix backend run test:p0:integration`。

## 本地 BGE-M3 模型服务管理

管理员入口：**系统配置 → 模型服务管理**。独立受限 Agent、CPU / NVIDIA CUDA / macOS MLX、双源下载、持久化任务、SSE 进度及知识库模型绑定见 [模型服务部署与验收手册](docs/MODEL-SERVICES.md)。

一次性安装计算节点 Agent：`npm ci && node deployment-agent/scripts/install.cjs`。此后模型下载与部署、启动/停止/卸载由后台完成。CPU 和 RTX 5070 已做真实 BGE-M3 1024 维推理验收；Apple MLX 仍需 Mac 真机验收。
