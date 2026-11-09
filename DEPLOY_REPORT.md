# csk 线上部署报告

日期：2026-11-09（Asia/Shanghai）。发布分支：`feature/iphone-pwa`。

## 发布结果

**DEPLOYED_VERIFIED：GitHub Pages 已成功部署，真实 HTTPS 资源核验通过。**

- 站点：[紫微斗数](https://skc649339-gif.github.io/csk/)。
- 仓库：[skc649339-gif/csk](https://github.com/skc649339-gif/csk)。
- 成功运行：[Actions #42583469729](https://github.com/skc649339-gif/csk/actions/runs/42583469729)，2026-11-09 08:05:34–08:07:04 UTC。
- 实际构建提交：`4085979420cd212362097f370179b9a1efbc74cd`。
- Pages：`build_type=workflow`、HTTPS 强制开启；默认分支和 `github-pages` 允许部署分支均为 `feature/iphone-pwa`。
- 实机验收：**NOT_TESTED，待用户在 iPhone Safari 和主屏幕 App 中亲自完成**。

## 身份与权限

GitHub 连接 API 和官方 CLI API 均确认登录账号为 `skc649339-gif`（ID `347169544`）。用户核对其 Google 登录邮箱后确认了该账号。没有在项目或证据中保存该邮箱、一次性授权码、Token 或密码。

初始连接能读取身份，但仓库列表和 App installations 为空，也不提供创建仓库或配置 Pages 的接口。因此使用官方 GitHub CLI 设备授权；用户仅在手机 GitHub 网页完成授权。后台 CLI 明确返回 `Authentication complete` 和登录用户名后，再通过 `gh api user` 验证身份。

本人账号下的目标查询最初返回 404。随后创建了空的公开 `csk` 仓库；CLI API 返回 `admin=true`、`maintain=true`、`push=true`、`pull=true`、`triage=true`，才执行推送。详见 [连接与权限证据](docs/deploy-evidence/github-connection-check.json)。

## 源码与发布范围

继续既有 `feature/iphone-pwa`，原始接续提交为 `e7bea65c1442845f7bf7c1aa62a7a00bcea72fbd`。在当前可写工作区克隆该分支和可达历史，原 checkout 未修改。保留上游 `origin=https://github.com/Renhuai123/ziwei-doushu.git`；所有推送只发往新增的 `csk` 远端，没有向上游推送或修改上游 `main`。

工作流配置会过滤仅报告与证据的变更。首次推送和随后初始化空提交后，GitHub 工作流列表仍为空；在仅给现有工作流添加一行发布说明后，GitHub 登记工作流 `411829214` 并启动本次成功运行。应用源码、排盘引擎、依赖和功能没有改变。本次最终报告及部署证据单独提交，不触发重复构建。

原隐私审计见 [privacy-audit.md](docs/deploy-evidence/privacy-audit.md)：该历史快照覆盖 69 个提交、346 个历史文件版本和 1137 个当时产物文件。当前发布前复查了审计基线后的变更；175 个源跟踪文件未发现敏感文件路径。本次认证配置、后台日志和下载产物位于仓库外的 `.local/`，未上传。构建只读取源码，不读取手机浏览器的 localStorage。

## 云端检查

| 检查 | 实际结果 |
| --- | --- |
| 锁定依赖安装 | PASS |
| 类型检查 | PASS |
| 上游回归 | 17/17 suites PASS |
| 本地功能回归 | 3/3 suites PASS |
| 排盘引擎保留 | 15/15 文件与上游基线 `a600484a49255039d0725f1ba9e11ca81a948f97` 一致 |
| 静态生产构建 | PASS |
| PWA 单元及构建检查 | 14 PASS |
| Pages 上传与部署 | build / deploy 两个 job 均 success |

## 真实站点与云端产物核对

实际下载本次成功运行的 `github-pages` 产物 `13657763755`，在仓库外解包。该产物有 1134 个文件，核心预缓存 55 项，版本 `260b7801028e3f22e730`。未使用旧的本地产物代替云端构建。

对实际 HTTPS 地址运行既有 `scripts/verify-deployment.mjs`，于 **2026-11-09 08:09:35 UTC** 完成：**73 项资源检查通过、0 失败；55 个核心资源 SHA256 全部匹配**。

覆盖首页、排盘、资料库、搜索、知识、合命、隐私与条款页面；Manifest 的名称、standalone、id/start_url/scope `/csk/`；应用图标尺寸及 180×180 Apple 图标；SW 与本次产物及模板一致；预缓存清单、全部核心 JS/CSS/静态资源，以及许可证文件。

证据：[live-resources.json](docs/deploy-evidence/live-resources.json)、[actions-artifact.json](docs/deploy-evidence/actions-artifact.json)、[actions-run.json](docs/deploy-evidence/actions-run.json)。

## 浏览器与实机限制

- **桌面浏览器：NOT_TESTED。** 已尝试使用 Computer Use 做真实页面访问检查。工具因无法可靠确定 Windows 当前浏览器 URL 而停止操作；未绕过该保护，也未将这次尝试记录为浏览器通过。
- **iPhone Safari / 主屏幕 App：NOT_TESTED。** HTTP、资源哈希和云端测试不替代用户亲自进行的设备验收。

## iPhone 安装

1. 在 iPhone **Safari** 打开 [https://skc649339-gif.github.io/csk/](https://skc649339-gif.github.io/csk/)。
2. 点 **分享 → 添加到主屏幕 → 添加**，名称为「紫微斗数」。如显示「作为网页 App 打开」，请开启。
3. 从主屏幕图标打开，保持联网，等页面显示「核心已缓存」。

## 用户亲自完成的实机清单

以下全部待实机验收。请自行记录 iPhone 型号、iOS 版本、日期及各项结果；真实出生资料无需发到聊天或 GitHub。

- [ ] Safari 打开真实 HTTPS 页面，无空白、404 或资源错误。
- [ ] 添加到主屏幕，图标和名称正确。
- [ ] 从主屏幕图标进入独立窗口，没有 Safari 地址栏。
- [ ] 核对公历/农历输入、出生地、时分与性别，起盘结果符合预期。
- [ ] 十二宫及主星详情、大限和流年切换正常。
- [ ] 保存至少两份命盘，记录数量正确。
- [ ] 从多任务界面关闭 App 再打开，记录仍可读。
- [ ] 浅/深色主题在关闭重开后保持。
- [ ] 核心缓存完成后开启飞行模式，关闭重开，已存盘可读。
- [ ] 飞行模式下新排盘并保存，重开后仍在。
- [ ] 删除其中一份命盘，重开后其他记录保持。
- [ ] 导出 JSON 备份到「文件」，再导入并核对追加行为。
- [ ] 横竖屏、软键盘、宫位滑动与触控正常。
