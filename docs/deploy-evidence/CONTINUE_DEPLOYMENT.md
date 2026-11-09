# 继续 csk 发布的交接

更新：2026-11-09。用户仅使用手机；不要再要求用户运行 Windows 脚本。不要要求在聊天中发送密码、Token 或验证码。

## 已授权范围

用户已审核第一阶段验收报告，要求不增加功能，继续现有 `feature/iphone-pwa`，发布到其自己的 GitHub `csk`，配置 Actions / Pages 并验证真实 HTTPS 资源。不要修改上游 `main`，不要推送到上游 `origin`。真实 iPhone 验收由用户亲自完成。

## 当前证据

- 本地 checkout：`C:\Users\Administrator\Documents\Codex\2026-11-03\iphone-https-github-com-renhuai123-ziwei\app-source`。
- 当前分支 `feature/iphone-pwa`；实现及部署准备在现有提交中，交接前最新提交为 `c0c376b`。
- 用户截图显示手机 GitHub 已登录 `skc649339-gif`，但必须通过连接 API 再核实身份，不能直接将截图身份当作当前 API 身份。
- 用户报告已连接 GitHub；插件目录查询确认 GitHub 插件 `installed: true`。当前对话工具目录尚无 GitHub 操作工具。新对话先发现工具并实际验证账号、仓库及写权限；如果只有只读能力，不可声称可以发布。
- CLI `gh auth status --hostname github.com` 仍显示未登录。2026-11-09 请求官方设备码被执行环境网络访问限制阻止；未生成新码。旧码失效，不能继续使用。
- 便携 CLI 在 checkout 的父目录 `.tools/gh/2.103.3/bin/gh.exe`；认证配置约定是父目录 `.local/github-cli`。它们均不在待发布 checkout 内。不要上传认证配置。
- 未创建自己的远端仓库，未推送，未配置真实 Pages，尚无已验证 HTTPS 地址。先重新检查外部状态，防止用户或其他会话已创建仓库。

## 接下来执行

1. 发现并使用已连接 GitHub 工具，核实实际账号以及建库/写入权限。不要重复要求连接，除非工具实际报告连接失效或缺少必要权限。
2. 检查用户自己的 `csk` 是否存在；若非空或包含其他项目，先检查内容，不得覆盖或强推。保留原上游远端。
3. 检查 `docs/deploy-evidence/privacy-audit.md` 以及本次待推送文件；禁止上传私人命盘、导出备份、凭据等。
4. 创建/使用用户自己的 `csk`；推送 `feature/iphone-pwa`，启用 Pages 的 GitHub Actions 来源，确认环境规则允许该分支。
5. `.github/workflows/deploy-pages.yml` 已配置分支 push 自动部署，按仓库名生成 `/csk`；报告与部署证据的单独修改不触发重复构建。无需重写工作流或增加 App 功能。
6. 等待真实 Actions 成功，下载这次运行的 Pages artifact 到 checkout 外的目录并解包。旧本地 `out/` 的构建 ID 与云端不同，不能用于线上精确哈希比较。
7. 运行 `node scripts/verify-deployment.mjs https://实际账号.github.io/csk/ 实际Actions产物目录`；检查真实页面、Manifest、SW、图标、JS/CSS、预缓存清单等，并作浏览器访问检查。
8. 更新并提交 `DEPLOY_REPORT.md`，填写真实站点和 Actions URL、实际结果与未完成项。iPhone 实机清单保持待用户验收；不能将模拟或 HTTP 成功写成实机成功。

## 如果新的连接仍不能发布

明确报告实际缺少的能力（例如只有读取权限、缺少仓库创建接口、CLI 网络仍受阻），不要把安装插件等同于 CLI 登录，不要让用户重复走无效授权流程，也不要虚构线上地址。需要更换托管平台时先让用户选择，不要自行改变已选 GitHub Pages 方案。
