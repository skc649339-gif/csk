# 第一阶段验收报告

日期：2026-11-03。目标仓库：用户指定新建 `csk`。开发分支：`feature/iphone-pwa`。原 `main` 与远端源仓库未改动。

## 总体状态

**本地代码与生产交付已具备，最终iPhone验收尚未通过。**

已完成的工作能自动完成的代码、测试与文档均在本地交付。本版不需要Mac、Xcode或Apple Developer，不依赖付费API。发布后由GitHub Pages托管，无需电脑持续开机；但在真正发布前，这只是经过本地验证的静态部署能力，不能称已有线上App。

当前尚未获得GitHub账号及创建/推送目标仓库的授权，未创建线上 `csk`，未发布，也没有真实HTTPS地址。没有真实iPhone测试环境，不能宣布用户拿起手机即可从主屏幕使用。

## 七项安装运行目标

| 目标 | 状态 | 说明 |
| --- | --- | --- |
| iPhone Safari访问HTTPS | 待部署、待实机 | 本地地址不能替代；工作流与 `/csk/` 生产包已准备。 |
| 添加到主屏幕 | 配置完成，待实机 | Manifest、PNG图标、apple-web-app、中文名称。 |
| 主屏幕直接启动 | 待实机 | start_url与scope均含仓库前缀。 |
| 独立窗口正常使用 | 待实机 | display=standalone，不将桌面浏览器当作实机。 |
| 关闭再打开记录仍在 | Chromium通过，iPhone待验 | 真实关闭标签再新开窗口，2条快照与主题保留。 |
| 不依赖电脑持续开机 | 静态架构完成，待远端发布 | 所有219页面可静态导出，无排盘后端。 |
| 首次缓存后离线使用 | 自动化/Chromium通过，iPhone待验 | 服务器停止后新窗口启动、读盘、新排盘和保存成功；非实机飞行模式。 |

## 功能与质量交付

中文公农历输入、十二宫全星曜、四化、大限与流年切换、本地宫位说明、星曜说明、格局、三方四正、多命盘快照、查看/删除、导入导出、浅深主题、触控与响应式已实现。完整保留原引擎与古籍、双盘本地对照及未接UI的工具源码。

原仓库未提供的AI后端与商业断语库没有伪造；知识库的182地址改为现有简介和古籍索引/缺失说明，不声称有182篇未开源完整断语。没有下载56.6GB解读集。海外时区/均时差完整输入UI、未接UI的全部流派/流月流日等仍列在 [FEATURES.md](FEATURES.md)。

测试：TypeScript通过；17/17原回归；3/3新增功能测试；14/14 PWA检查；15/15核心文件与原提交一致；Windows一键生产构建通过。详细证据与准确性边界见 [TEST_REPORT.md](TEST_REPORT.md)。

## 交付位置

- 完整项目：当前目录（含独立Git分支及原main）。
- 一键生产启动：[START_WINDOWS.cmd](START_WINDOWS.cmd)；只构建：[BUILD_WINDOWS.cmd](BUILD_WINDOWS.cmd)；开发模式：[DEV_WINDOWS.cmd](DEV_WINDOWS.cmd)。
- 可部署生产文件：`out/`，本次按 `/csk/` 构建。不同仓库名或自定义域名须重新构建。
- 打包交付：工作区上层 `deliverables/` 中的完整源码ZIP、`csk`生产ZIP与SHA256清单。源码ZIP不含node_modules或个人命盘。
- 安装教程：[IPHONE_INSTALL.md](IPHONE_INSTALL.md)。
- GitHub授权与发布：[DEPLOY_GITHUB_PAGES.md](DEPLOY_GITHUB_PAGES.md)。
- 功能清单：[FEATURES.md](FEATURES.md)。
- 上游全部复用功能/缺陷：[docs/UPSTREAM_AUDIT.md](docs/UPSTREAM_AUDIT.md)。
- 实施计划：[docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)。
- 许可证：[docs/LICENSE_AUDIT.md](docs/LICENSE_AUDIT.md)；生产包含完整MIT与第三方许可汇总。
- 本地存储/旧记录边界：[docs/LOCAL_DATA.md](docs/LOCAL_DATA.md)。

## 剩余步骤

1. 用户安装并授权GitHub集成，确认创建自己账号下的 `csk`；之后才可推送代码和运行Pages工作流。授权前未假设账号权限。
2. 取得真实Pages URL，联网核查首页、Manifest、SW与图标均正确，再交给iPhone Safari安装。
3. 按安装教程完成主屏幕启动、独立窗口、两条记录持久化、离线排盘与删除实机清单。

只有第2、3步实测成功，才能将第一阶段最终状态改为通过。
