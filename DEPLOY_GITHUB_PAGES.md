# 发布到 GitHub Pages

你已选择 GitHub Pages，并指定新建 `csk` 仓库。交付生产包使用 `/csk/` 路径。当前代码和静态生产包可以离开这台 Windows 电脑运行；**尚未取得你的目标仓库授权，因此没有发布，也没有可交付的线上 URL**。

## 账号和费用

- 需要你自己的 GitHub 账号及目标仓库写入权限；不需要 Apple 账号、Mac 或 Xcode。
- GitHub Free 的 Pages 通常使用公开仓库。代码和静态站点将公开可访问；你的本地命盘不会随代码上传。请勿把备份 JSON、出生资料或密钥提交到仓库。
- 私有仓库的 Pages 适用范围取决于 GitHub 套餐。第一阶段使用公开源码、手机本地资料的模式，不假设已有付费套餐。
- 托管仍可能记录普通访问请求的 IP 等网络日志，本应用不添加统计、不上传出生资料。

依据：[GitHub Pages 官方说明](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)。

## 推荐：自己的 Fork + 手动工作流

1. 登录自己的 GitHub 账号，将原项目 Fork 到自己名下（或准备自己的新仓库，保留上游许可证）。不要向原作者的仓库直接推送。
2. 将本地 `feature/iphone-pwa` 分支推送到**你已确认的自己的仓库**，或将交付源码导入新仓库。保留 `.github`、`public`、脚本和锁文件；不要上传 `node_modules`、`.next`、`out` 或个人备份。
3. GitHub 手动运行入口要求工作流文件位于仓库默认分支。Fork 情况可将**自己仓库**的默认分支设为 `feature/iphone-pwa`，或审阅后合并到自己仓库的默认分支；上游仓库和本地原始 `main` 不需要改。全新仓库则确保导入代码所在分支就是默认分支。
4. 仓库 → **Settings → Pages → Build and deployment → Source → GitHub Actions**。
5. 仓库 → **Actions → Deploy iPhone PWA to GitHub Pages → Run workflow**，选择包含本版代码的分支，手动运行。
6. 工作流自动安装锁定依赖，运行类型检查、原回归与新增测试、生产构建及 PWA 测试；通过后上传 `out/` 并部署。
7. 打开工作流部署结果中的真实 `page_url`。应为 HTTPS。首次部署请等 Actions 显示成功，再用 Safari 打开。

本项目仅提供 `workflow_dispatch` 手动发布，普通本地开发不会自动部署。`contents: read`、`pages: write`、`id-token: write` 为 GitHub 官方 Pages 工作流使用的最小相关权限，不需要把个人令牌写进源码。

官方步骤：[使用自定义 Pages 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 子路径规则

- 你的目标仓库名为 `csk`，构建环境为 `NEXT_PUBLIC_BASE_PATH=/csk`，地址为 `https://用户名.github.io/csk/`。
- 用户主页仓库 `用户名.github.io` 使用空 base path。
- 工作流会自动从实际仓库名计算。自定义域名指向网站根目录时，应将工作流中 base path 设置为空，并在 Pages 配置域名；不要直接复用项目子路径的生产包。
- 路径只在**构建时**设置。不能把 `/csk` 版本直接放到另一个仓库名下；需要重新构建。

Windows PowerShell 本地构建示例：

```powershell
$env:NEXT_PUBLIC_BASE_PATH='/csk'
.\BUILD_WINDOWS.cmd
```

本地预览 `START_WINDOWS.cmd` 会按产物的路径挂载；远端发布后不需要电脑继续开机。

## 发布后检查

确认 `manifest.webmanifest` 的 `start_url` / `scope` 与图标路径均含正确仓库前缀；`sw.js` 返回 JavaScript，不能是 GitHub 404 HTML。手机显示「核心已缓存」后，按 [iPhone 实机清单](IPHONE_INSTALL.md) 验收。

部署后要进一步验证：HTTPS 真访问、主屏幕安装、独立启动、关闭重开、飞行模式冷启动。CI 成功不等于 iPhone 实机成功。
