# csk 发布完成后的接续

更新：2026-11-09。用户仅使用手机；不要求用户运行 Windows 脚本，不索取密码、Token 或验证码。

## 已确认结果

- 账号：`skc649339-gif`。连接 API、CLI API 与用户确认一致，Google 登录邮箱与 GitHub 用户名的疑问已解决。
- 仓库：https://github.com/skc649339-gif/csk 。官方 CLI 核实本人拥有 admin / push 等权限后创建空的公开仓库并推送。
- 继续使用现有 `feature/iphone-pwa`，其同时是 csk 默认分支和 Pages 允许部署分支。
- 真实站点：https://skc649339-gif.github.io/csk/ 。Pages 为 GitHub Actions 来源，HTTPS 强制开启。
- 成功 Actions：https://github.com/skc649339-gif/csk/actions/runs/42583469729 。
- 实际构建提交：`4085979420cd212362097f370179b9a1efbc74cd`；产物 ID `13657763755`；预缓存版本 `260b7801028e3f22e730`。
- 云端类型检查、17/17 上游回归、3/3 本地回归、15/15 引擎保留、14 项 PWA 检查、构建与部署全部通过。
- 用这次 Actions 的真实产物完成线上比较：73 项通过、0 失败，55 个核心资源 SHA256 全部匹配。
- 桌面浏览器检查 **NOT_TESTED**：Computer Use 无法可靠确定 Windows 浏览器 URL，工具已停止，未绕过。
- iPhone Safari 与主屏幕 App **NOT_TESTED**：由用户亲自验收，清单见 `DEPLOY_REPORT.md`。

## 工作区和边界

- 当前可写发布副本：`C:\Users\Administrator\Documents\Codex\2026-11-09\csk-app-source-docs-deploy-evidence\app-source`。
- 原 checkout：`C:\Users\Administrator\Documents\Codex\2026-11-03\iphone-https-github-com-renhuai123-ziwei\app-source`，未修改。
- 保留上游 `origin=https://github.com/Renhuai123/ziwei-doushu.git`；自己的发布远端为 `csk=https://github.com/skc649339-gif/csk.git`。不要向上游 origin 推送，不修改上游 main。
- 不增加 App 功能。应用源码与原始接续提交 `e7bea65` 保持一致；部署初始化仅增加空提交和现有工作流的一行说明，最终仅更新报告及证据。
- 仅改 `DEPLOY_REPORT.md` 和 `docs/deploy-evidence/**` 不触发重复部署。

## 认证和实际产物

- 手机官方 GitHub device flow 已真正完成，后台 CLI 返回成功后又通过 API 核验；不要继续使用或重发旧授权码。
- CLI：原 checkout 父目录的 `.tools/gh/2.103.3/bin/gh.exe`。
- 当前 `GH_CONFIG_DIR`：当前工作区根目录的 `.local/github-cli`，在 app-source 仓库外。不得上传、打印或复制认证配置。
- 旧的前台等待进程曾在授权回执保存前结束；成功使用隐藏后台进程完成认证。以后先实际检查授权，不能把“用户已授权”直接写成 CLI 成功。
- 本次实际产物在工作区根目录 `.local/actions-artifacts/42583469729/site`。不得拿旧的本地 out/ 与云端资源做精确哈希比较。
- 完整结果见 `DEPLOY_REPORT.md` 以及当前目录的 JSON 证据。后续重部署必须核对新的 run、commit、artifact 与线上版本。

## 接下来

发布及自动化资源验收已经完成。用户可在 iPhone Safari 打开上方真实地址并添加到主屏幕，按报告逐项检查。不得把 HTTP 成功、桌面浏览器或模拟器结果写成 iPhone 实机通过。
