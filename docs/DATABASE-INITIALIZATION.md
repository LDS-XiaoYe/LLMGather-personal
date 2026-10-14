# MySQL 自动初始化与系统设置 Seed

## 首次部署

先按根 README 初始化本地 `.env`，配置 MySQL 连接、认证与 Checkpoint 加密密钥。数据库账号需要首次建库、建表和现有增量迁移所需权限。随后执行：

```sh
# 开发部署；不需要导入 SQL
docker compose --env-file .env up -d
# 生产部署
docker compose --env-file .env -f docker-compose.prod.yml up -d --build
```

两种 Compose 均等待 MySQL 和 Redis 健康，后端通过现有 `DatabaseService` 完成初始化；没有新增数据库、初始化 Job 或调度框架。MySQL、Redis、Qdrant、LangGraph Checkpoint 与原有数据卷保持原架构。

```text
MySQL healthy
  → 有限重试连接 / 自动创建不存在的数据库
  → 获取数据库级初始化锁
  → 复用 createTables / 现有增量迁移
  → system_settings 缺失项 Seed / 必需键校验
  → 原有内置工具、技能、Provider、路由初始化
  → 释放初始化锁
  → 配置缓存加载 / 依赖模块初始化
  → NestJS HTTP Ready / 后端健康检查通过
  → 前端启动
```

`depends_on: service_healthy` 只解决数据库进程就绪，Schema 与 Seed 就绪由后端异步 DI Provider 保证。配置缓存不再吞掉早期查询错误；`main.ts` 读取配置前缓存已经加载，初始化异常不启动 HTTP。

## 默认值来源

`backend/src/database/seeds/system-settings.defaults.ts` 是公开、可审查的默认值目录。首版为 `2026-10-12.1`，来自 2026-10-12 正在运行的开发后端实际连接目标上的只读事务：

```sql
START TRANSACTION READ ONLY;
SHOW CREATE TABLE system_settings;
SELECT * FROM system_settings;
ROLLBACK;
```

实际表结构为 `key VARCHAR(128)` 主键、`value TEXT NOT NULL`、可空 `description TEXT`、`updated_at DATETIME(3)`。实际发现 **23 项**，人工核对后 **23 项入 Seed，0 项脱敏或环境适配，0 项敏感性待确认**。这不是个人数据库备份，不包含用户、凭据或其他业务表数据。

- TEXT 值逐字保留：例如 `max_json_body_size` 的单位字符串与限流的 `次数/毫秒` 字符串不转换成数字；JSON 不重新序列化。
- 描述保留 SQL NULL 与空字符串的区别；不复制开发实例更新时间，新增记录使用本安装的数据库时间。
- `api_key_cooldown_ms` 是冷却时长，不是 API Key；本次没有发现真实凭据、私有服务地址或本地路径。
- `tier_labels` 中的现有自定义标签也原样保留，不借初始化机会清理或重写配置。
- 文件记录规范化键、值、描述列表的 SHA-256；每个条目记录 `seedVersion`，可追踪公开默认值的来源版本。它不宣称已有数据库记录由哪个版本插入，不引入额外历史表或设置 Schema 迁移。

## 幂等性与多实例

Seed 使用主键作为唯一配置标识：

```sql
INSERT INTO system_settings (`key`, value, description)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE `key` = system_settings.`key`;
```

重复键执行原值赋给原值，**不更新 value、description 或 updated_at**。没有 `INSERT IGNORE` 掩盖其他数据库错误，没有删除、清空或无条件重置。空表插入全部默认项，部分缺失只补缺项，管理员已有值（包括空值或自定义模型列表）保留。

校验确认本版本全部必需键存在且为 TEXT，不将已有值与默认值作相等比较。现有系统设置 API、管理员写入与缓存刷新接口保持原行为。

MySQL `GET_LOCK` / `RELEASE_LOCK` 在现有 Adapter 的专用连接上持有数据库级初始化锁，串行保护整个已有建表、迁移及内置数据初始化链；设置插入本身仍通过唯一主键原子防重。没有依赖现有 Adapter 的手动事务接口实现跨连接事务。锁超时使本次启动失败，实例可在数据库健康后重新启动。连接断开会由 MySQL 释放锁。

以前启动时的 `ensure*SystemSettings` 会自动替换模型名或重写 JSON；它们不再参与初始化，避免覆盖管理员设置。与设置无关的 Provider / 路由初始化保留。

## 维护与升级

1. 对可信维护实例执行只读查询，审查新增键的值、JSON 内嵌字段和描述。
2. 凭据、Token、密码、私人地址或开发路径使用空配置或环境适配；不将真实值提交。敏感性不明确时先记录待确认，不自动发布。
3. 在默认目录追加经过核对的条目，并给新增项标注新的 `seedVersion`；更新总版本及来源说明、摘要。旧条目的来源版本保留。
4. 更新必要键校验与测试、条目数量断言，运行隔离集成测试。
5. 发布并重新启动后端。只新增缺失配置，不改变用户已有值。旧默认值的升级不是覆盖操作；由管理员通过现有管理接口明确修改。

不要把本次只读提取脚本当作长期自动发布工具；公开默认值需要人工脱敏审查。不提供对开发数据库的自动清空或恢复默认命令。

## 启动参数与排查

以下参数在三个 `.env.example` 中提供；现有 `.env` 不填写时使用相同默认值。

| 参数 | 默认值 | 范围 / 用途 |
| :--- | :--- | :--- |
| `MYSQL_BOOTSTRAP_RETRIES` | `10` | 1–30，连接尝试总次数 |
| `MYSQL_BOOTSTRAP_RETRY_DELAY_MS` | `2000` | 0–30000，连接尝试之间的间隔 |
| `MYSQL_CONNECT_TIMEOUT_MS` | `5000` | 100–30000，单次建立连接超时 |
| `MYSQL_BOOTSTRAP_LOCK_TIMEOUT_SECONDS` | `60` | 1–300，等待其他实例初始化的最长秒数 |

只对短暂网络 / 服务不可用错误重试；认证、权限等错误立即失败。日志只记录阶段、错误代码和数量，不输出设置值、SQL、密码或连接私有信息。Schema、Seed、校验或缓存加载失败均阻止 Ready。

```sh
docker compose --env-file .env logs -f backend
docker compose --env-file .env ps
```

成功日志包含 `system_settings seed 2026-10-12.1 validated (23 required keys; existing values preserved)`、`Tables & seed data ready.` 和 `[SystemSettings] loaded 23 keys`；已有额外配置时缓存数量可能更多。生产环境使用相同命令并加 `-f docker-compose.prod.yml`。

连接失败检查 `.env` 密码与已有数据卷的实际凭据，不要靠更改 `MYSQL_ROOT_PASSWORD` 重置旧卷密码；建表失败检查权限，Seed 失败检查唯一主键与表字段，锁超时检查其他实例初始化日志。Compose 内部固定连接 `db:3306`；宿主机开发进程使用实际映射端口。不要执行 `down -v` 删除现有数据。

## 自动化验证

```sh
npm --prefix backend test -- --runInBand
npm --prefix backend run test:database:integration
npm --prefix backend run typecheck
npm run build:backend
```

隔离集成测试自动创建随机命名的临时 MySQL / Redis 容器，使用随机凭据、动态环回端口和 MySQL tmpfs；不读取 `.env`，不使用开发实例或现有 Volume。需要 Docker 和可用的 `mysql:8.0`、`redis:7-alpine` 镜像。测试完成移除仅本次创建的临时容器。

覆盖全新数据库及完整业务表、空表、重复启动、管理员覆盖、部分缺失、SQL NULL 描述、并发 Seed、两个独立进程并发完整初始化、锁超时、连接 / Schema / Seed 失败及完整 AppModule 空库 HTTP 启动。普通单元测试默认跳过真实数据库测试。

## 边界

Seed 保证配置来源与缺失项初始化，不保证模型 Provider 已配置密钥，也不改变现有各业务读取器对单位字符串或限流表达式的解释。读取器的历史回退行为保持原状。新增条目时需要维护当前基于 23 项来源的测试断言；不自动导出未来开发实例的新配置。
