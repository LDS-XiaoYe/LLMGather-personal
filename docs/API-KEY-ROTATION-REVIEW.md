# API Key 轮转检查

检查时间：2026-10-12T10:29:07.133Z。

## 结论

轮转已接入真实 Provider 请求链路，多个 Key 时部分错误能切换；但当前部署每个已接入服务商仅 1 个去重后的 Key，当前配置不具备跨 Key 故障切换条件。实现也存在缺口，因此不应描述为完整可靠的轮转。

## 当前部署

| 服务商 | 有效且去重的 Key 数 | 最大重试次数 | 状态 |
| --- | ---: | ---: | --- |
| deepseek | 1 | 2 | 已接入 |
| qwen | 1 | 2 | 已接入 |
| glm | 1 | 2 | 已接入 |
| xiaomi-mimo | 1 | 2 | 已接入 |
| gui | 1 | 2 | 已接入 |
| kimi | 1 | 2 | 已接入 |
| gemini | 0 | 2 | 未接入：缺少 Key |

Key 数包含数据库与容器环境变量合并、去重后的结果。6 个池均为 1 个 DB Key、0 个额外环境变量 Key；运行中的后端最近启动日志也一致。最近 7 天的账单记录包含 3 次 qwen 请求、仅 1 个不同的数据库 Key ID，不作为跨 Key 切换证明。已配置冷却时间 30000ms；池的默认策略为 round_robin，单请求配置允许初次请求加最多 2 次重试。

## 已验证的能力

- ProviderRegistryService 从 ProviderApiKeyStore 获取池并注入 Provider；ChatService 通过该 Provider 执行，不是单纯存在未调用的代码。
- 模拟 429、402 中文余额不足、401 响应时，双 Key 的 OpenAI 兼容 Provider 执行 A → B 并成功；流式请求在流建立前的 429、Gemini 初始 429 也执行 A → B。
- 管理后台增删 Key 后 reloadPool + reloadProvider，当前进程可以热更新。
- 池具有冷却、熔断、半开探测和统计；已存在 50 个相关测试通过。

## 确认的问题

1. **聊天的轮询/加权轮询被绕过。** OpenAI 兼容 Provider、Gemini 都直接调用 getRandomKey()，它强制 getKey('random')。配置 round_robin 的双 Key 池，固定随机值后连续真实 Provider 请求得到 A → A → A；池策略本身测试通过不代表调用方遵守策略。
2. **百炼欠费错误漏判。** 官方 400 Arrearage / “Access denied, please make sure your account is in good standing.” 不匹配当前余额不足关键字，双 Key 时请求只执行 A 并失败，备用 B 没有调用。官方说明：[百炼错误码](https://help.aliyun.com/zh/model-studio/error-code)。
3. **5xx、网络错误的重试不保证换 Key。** 首轮失败阈值尚未触发熔断时，随机选取可能再次选中失败 Key，已经复现 A → A；因此轮转提示有时只是重试提示。
4. **最终失败的状态记录不完整。** 429、5xx、网络失败的部分状态更新受“还有剩余重试次数”条件控制。双 Key、retry=1、连续 429 时 A 熔断但最后失败的 B 仍然 available，failureCount=0；Gemini 同样复现。半开探测也存在未释放的路径，应统一记录每次尝试结果。
5. **自动路由遗漏轮转提示。** RouterController 的普通模型分支仍使用会轮转的 ChatService，但没有透传 x-provider-key-rotation；非流式展开 completion 又会丢弃不可枚举的 _providerKeyRotation。自动路由前端不一定能显示真实轮转。
6. **TTS 没有故障切换。** TtsController 只调用一次 pool.getKey() 并发送一次上游请求，没有失败后换 Key 或成功/失败指标反馈。不要将普通聊天的轮转能力泛化到 TTS。
7. **进程内状态。** 熔断、半开状态和使用指标在内存中，重启或重建池会重置；多个后端实例之间不共享熔断状态。

## 受控故障复现

| 场景 | 选取顺序（惰性测试 Key） | 结果 |
| --- | --- | --- |
| 429 rotates | A → B | 成功 |
| 402 insufficient balance rotates | A → B | 成功 |
| 401 rotates | A → B | 成功 |
| 500 may reuse same key | A → A | 成功 |
| network may reuse same key | A → A | 成功 |
| Aliyun 400 Arrearage missing | A | 失败 |
| final 429 does not mark key | A → B | 失败 |
| stream initial 429 rotates | A → B | 成功 |
| Gemini initial 429 rotates | A → B | 成功 |
| Gemini final 429 does not mark key | A → B | 失败 |
| round-robin config bypassed | A | 成功 |
| three successful requests ignore round-robin | A → A → A | 连续成功请求 |

使用的是审计时运行容器的编译后 Provider 和真实 Key 池实现，所有上游响应都由本地测试替身返回。A/B 是测试凭证标识，不对应用户的密钥。没有发送真实模型请求，也没有新增、删除 Key 或改动系统配置。数据库检查仅 SELECT；报告不包含密钥、密钥前后缀、用户信息或对话内容。本报告保留历史审计结论；临时检查脚本与输出已按要求清理。

## 百炼的边界

百炼限流按主账号维度合并计算 RAM 子账号、业务空间和 API Key 的调用量，因此同一主账号的多个 Key 不会天然增加 RPM/TPM 额度；同一欠费账号的其他 Key 也不能解决账号欠费。参考 [百炼限流文档](https://help.aliyun.com/zh/model-studio/rate-limit)。

## 后续修复重点

先统一聊天/Gemini 的策略选择与错误分类，补齐 Arrearage、最终失败熔断和半开探测释放，再补路由提示和 TTS 接入。管理后台给同一服务商添加至少 2 个不同且有权限的 Key 才具备跨 Key 切换条件；是否能抵御账号级限流还取决于 Key 所属账号。

本次仅检查，业务代码保持原样。
