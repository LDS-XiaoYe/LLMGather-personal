# 登录记忆

登录对话框默认勾选 **30 天内保持登录**。成功登录后，同一浏览器再次打开页面会通过 `/v1/auth/me` 自动恢复用户状态，无需再次输入密码。

- 勾选：JWT 和 HttpOnly Cookie 均从登录成功时起固定有效 30 天，访问不会无限续期。
- 取消勾选（以及注册后自动登录）：使用浏览器会话 Cookie；JWT 使用现有 `JWT_EXPIRES_SECONDS`，默认 7 天，上限 30 天。浏览器自身的“恢复上次会话”可能保留会话 Cookie，公共设备使用后应主动退出。
- 退出登录：服务端删除当前登录会话并清除 Cookie，当前凭证再次提交会被拒绝；其他设备上的独立登录不受影响。
- 修改/重置密码：现有 `auth_version` 校验使旧凭证失效。删除账户同样会拒绝旧凭证。
- 网络错误不会主动删除登录记忆；过期或被撤销后需要重新登录。

新网页登录不把 JWT 或密码写入 `localStorage` / `sessionStorage`。旧版本的 localStorage Token 迁移至临时 sessionStorage，并在下一次成功登录或退出后清除。已过期的旧 Token 不会遮蔽有效的登录 Cookie。

后端启动自动创建 InnoDB 表 `auth_login_sessions`，仅保存会话 ID、用户 ID、Token SHA-256 和到期时间，不保存原始 JWT 或密码。新登录使用独立随机会话 ID，普通 API 与模型网关统一检查该记录及账号版本。后端重启后记录仍保留；每次登录清理最多 1000 条过期记录。

不需要增加或手动修改 `.env`。沿用已有 `JWT_SECRET`；保持密钥和数据库数据稳定才能保留登录。生产环境沿用 Secure + SameSite=Strict Cookie，部署应通过 HTTPS、同站点代理访问 `/v1`。开发环境使用 SameSite=Lax。Cookie 机制参考 [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)。

兼容旧 JWT 的原有效期，但旧凭证没有会话 ID，仅保留原有账号版本校验；新登录会创建可单独撤销的会话。
