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
