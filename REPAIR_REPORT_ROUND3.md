# csk 第三阶段缺陷修复与回归报告

日期：2026-11-09（测试日志使用 UTC）。目标仓库：`skc649339-gif/csk`；目标分支：`feature/iphone-pwa`。

本轮完成四项缺陷的本地修复与回归，具备进入第三轮独立验收的条件。七项指定命令最终退出码均为 0，隔离 Chromium 四个端到端场景最终全部通过。核心引擎 15 个文件、依赖锁文件和 PWA 路径配置保持原样。

**修复尚未上线。** 没有执行远端 push、merge、工作流触发或 GitHub Pages 发布；线上仍为原部署。本轮未访问或操作用户的 Safari、主屏幕 App、真实命盘或浏览器存储。iPhone 对本次修复的验证保持 `NOT_VERIFIED`。

## 1. 修复前 Git 状态与版本边界

| 项目 | 实际核实结果 |
| --- | --- |
| 本地目录 | 工作区内 `app-source` |
| 当前分支 | `feature/iphone-pwa` |
| 修复前 HEAD | `587a084b67994f55fa4c32347334788765fca4e2` |
| 修复前工作区 | 干净；无既有未提交修改 |
| 实际 csk 远端分支 | `587a084b67994f55fa4c32347334788765fca4e2`，开始与结束只读查询一致 |
| csk 远端 | `https://github.com/skc649339-gif/csk.git` |
| origin 远端 | `https://github.com/Renhuai123/ziwei-doushu.git`；未写入 |
| 本地 main | 不存在；未创建、修改或合并 |
| 线上实际构建提交 | `4085979420cd212362097f370179b9a1efbc74cd` |
| 最新远端 Pages 工作流 | [Actions #42583469729](https://github.com/skc649339-gif/csk/actions/runs/42583469729)，success；结束查询仍只有原运行 |
| 本地修复构建缓存版本 | `fc0c3d6d3fbd609e069c`；57 项核心缓存资源 |

远端 HEAD `587a084` 与线上构建 `4085979` 的差别沿用上一轮事实：后续提交更新部署文档，并非新发布。旧 `origin/feature/iphone-pwa` 跟踪引用是上游克隆历史，不作为 csk 的当前版本。本轮没有 fetch、pull、切换分支或改写历史。

修复方案先写于交付包 `PLAN.md`，随后实施。基线、所有原始文件哈希见 [git-before.json](docs/repair-evidence/round3/git-before.json)；结束远端查询见 [remote-after.json](docs/repair-evidence/round3/remote-after.json)。最终本地提交号随交付记录提供，报告本身纳入该提交；该本地提交没有推送。

## 2. 四项问题的根因与处理结果

| 问题 | 本地状态 | 根因与关键处理 |
| --- | --- | --- |
| P1-01 异常备份持续崩溃 | **FIXED** | 原校验只覆盖部分结构，未校验星曜 `brightnessRaw` 等嵌套渲染字段。异常对象进入 React 渲染并随活动记录恢复。现完整验证已定义的记录、出生信息、星曜、宫位、农历、大限及可选字段；整份导入验证通过后才写一次。启动改为只读检查，异常记录隔离显示，原始数据可完整导出；另加局部错误边界。 |
| P2-01 农历 2050 年末不能保存 | **FIXED** | 农历输入允许 2050 年，换算公历可到 2051 年；旧保存校验把原始钟表年也限制为 2050，导致同一日期在起盘与保存阶段使用不同契约。现由既有历法库推导准确公历终点，表单、转换和存储统一使用。 |
| P3-01 真机验收文档过时 | **FIXED** | 部署报告仍写全部未测试，未纳入用户已提供的设备反馈。已补充三项 `USER_REPORTED_PASS`，其余逐项保持未核实，且明确用户反馈属于原已部署版本。 |
| P3-02 localhost 网站元数据 | **FIXED** | `SITE_URL` 默认本机地址，Pages 构建没有显式设置线上站点地址，原 robots/sitemap 继续使用该默认值。自用 PWA 保留 noindex，robots 禁止抓取且不再广告 sitemap/host，sitemap 保留空端点；默认站点与 Actions 环境使用真实 HTTPS 地址和基础路径，新增制品检查。 |

这些状态仅表示本地源码与本轮有效回归已完成。GitHub 托管执行本次修改后的 Actions、真实 HTTPS 交付及 iPhone 本次修复效果均为 **NOT_VERIFIED**。

### P1：校验、原子性和恢复路径

- `lib/ziwei/record-validation.ts:56` 起覆盖 BirthInfo、Star、Palace、DaXian、LunarInfo、ZiweiChart 和 SavedRecord。必填字符串、有限数值、枚举、真实日期、嵌套数组、元组长度、唯一宫位和时间戳均在运行时验证；不依赖 TypeScript 断言作为安全边界。
- 可选字段允许省略，显式 `null`、错误对象/数组及类型强制转换被拒绝；保留旧版 iztro 的空四化标记 `''`。未知且不参与界面渲染的扩展字段保留，不重算或改写旧命盘快照。
- `lib/ziwei/records.ts:27` 验证整份备份及重复 ID；`importRecords` 在所有输入和已有记录通过后才一次 `setItem`。混合异常备份直接报字段位置与原因，无部分写入。
- `inspectRecords`（第 52 行）只读保留所有底层字符串；正常且 ID 唯一的记录按原顺序显示。异常记录不自动打开；损坏 JSON、未知版本、重复编号也有只读提示与原始导出。
- 恢复期间停用保存、导入和删除，连活动记录指针也不重写。原异常内容与其他正常记录均保留。用户可查看正常记录、导出完整原始文件，交由后续人工修复；**本轮不自动修复异常值，也不自动解锁损坏存储的写入**。
- `components/ChartRenderBoundary.tsx:6` 为额外保护：即使未来出现未预料的渲染异常，仍提供返回列表、原始导出入口。`app/chart/page.tsx:42` 接入启动检查，第 114 行显示恢复面板，第 122 行包裹命盘渲染。
- 审查 `PalaceCell.tsx`、`InsightPanel.tsx` 的字段使用后，在记录入口集中校验；这两个渲染组件未作修改。

### P2：精确日期契约

`lib/ziwei/date-range.ts` 使用未改动的 `lunarToSolar` 和 `lunarMonthDayCount` 推导：

| 日期口径 | 范围 |
| --- | --- |
| 农历原始输入 | 1900–2050 年；具体月份、日数及闰月由原历法库验证 |
| 公历原始钟表日期 | 1900-01-01 至 **2051-02-10**，后者对应农历 2050-12-29 |
| 经既有经度校正、晚子时规则后的排盘日 | 原始日期范围前后各允许一天；不扩大表单输入范围 |

2051-02-11 的公历原始输入及农历 2051 年均被拒绝。`calendar-input.ts`、`BirthForm.tsx` 和记录校验共用该契约；切换到公历时年份选项可正确表示 2051 年。算法、农历换算库、星曜表和时辰换日逻辑均未修改。

### P3：自用部署和真机证据

`lib/site.ts` 默认 `https://skc649339-gif.github.io/csk`，Actions 根据仓库名构造 `NEXT_PUBLIC_SITE_URL`。原有基础路径构造语义保持一致。`app/sitemap.ts` 返回空列表，`app/robots.ts` 不再输出 Host/Sitemap，布局已有 noindex 保留。

noindex 和 robots 是抓取策略，并非访问控制；Pages 站点仍可通过链接公开访问，出生信息仍由本地记录机制处理。Manifest 的 `start_url`、`scope`、Service Worker 路径和注册/升级代码未改动。

## 3. 实际修改文件

| 范围 | 文件 |
| --- | --- |
| P1 实现 | 新增 `lib/ziwei/record-validation.ts`、`components/ChartRenderBoundary.tsx`；修改 `lib/ziwei/records.ts`、`app/chart/page.tsx` |
| P2 实现 | 新增 `lib/ziwei/date-range.ts`；修改 `lib/ziwei/calendar-input.ts`、`components/BirthForm.tsx` |
| P3 实现及文档 | `lib/site.ts`、`app/sitemap.ts`、`app/robots.ts`、`.github/workflows/deploy-pages.yml`、`DEPLOY_REPORT.md` |
| 专项测试 | 新增 `records-schema.test.ts`、`date-boundary.test.ts`、`repair-e2e.mjs`、`fixtures/records-v1-587a084.json`（均在 `scripts/regression/`） |
| 既有测试接入 | `scripts/regression/records.test.ts`、`calendar-input.test.ts`、`pwa.test.mjs`、`scripts/run-tests.mjs` |
| 交付证据 | 本报告及 `docs/repair-evidence/round3/` |

现有记录测试只调整更精确的错误信息断言；日期测试把笼统的“2051 年全拒绝”改为准确终点后一日拒绝。没有改动 `package.json`、`package-lock.json`、核心引擎基线文件、真实数据、main 或上游。没有添加应用运行时依赖。

## 4. 新增与修改的测试

- `records-schema.test.ts`：基线旧版导出兼容、可选字段省略、空四化兼容；36 种错误字段分别放入正常/异常混合备份，检查拒绝、零写入、原始字符串/数量/内容/顺序不变。另测好—坏—好存储的只读检查、原始导出、阻止修改、破损 JSON、未知版本、重复 ID。
- `date-boundary.test.ts`：7 组输入→排盘→保存→读取→导出→导入闭环，覆盖原复现、农历最终日晚子时、未知时辰、跨年、2 月 29 日、2023 闰二月、1900 下界经度回退；另拒绝越界日期并验证归一化仅有一天余量。
- `repair-e2e.mjs`：实际本地构建 UI 的保存/备份往返/删除、异常导入不变性、异常活动记录刷新恢复、精确原始导出、受控渲染失败保护、进程关闭后离线重开与新排盘、旧部署 A→本地修复 B 的 SW 升级。
- `pwa.test.mjs:244`：生产 robots/sitemap 无 localhost、不广告抓取地址；218 个 HTML 均有 noindex，资源地址不得指向 localhost，站内根路径均属于 `/csk/`；继续检查所有核心缓存资源哈希、图标与现有 SW 单元行为。

旧版合成 fixture 是本轮从经哈希核实的 `587a084` 模块生成，标签为 `QA_LEGACY_V1_ONLY`，并非真实用户命盘。异常数据、离线和删除测试全部限定为内存存储或新建的临时 Chromium 配置目录及 `127.0.0.1` 测试服务器。

## 5. 七项自动化命令的本轮执行结果

隔离目录：`repair-round3-20261109/project`。使用 Node `v24.22.1`、官方 npm `12.2.2` CLI；npm 包 tarball 的 SHA-512 与官方元数据一致。以下命令实际由 Node 调用该 npm CLI，参数保持表中原样。环境设为 `NEXT_PUBLIC_BASE_PATH=/csk`、`NEXT_PUBLIC_SITE_URL=https://skc649339-gif.github.io/csk`、`NEXT_TELEMETRY_DISABLED=1`、`CI=1`。

| 命令 | 最终退出码 | 本轮结果 | 日志 |
| --- | --- | --- | --- |
| `npm ci --legacy-peer-deps` | 0 | 安装 181 个包；源码与隔离副本锁文件均未变化 | [01-install.log](docs/repair-evidence/round3/01-install.log) |
| `npm run typecheck` | 0 | 类型检查通过（两次均为 0） | [02-typecheck-attempt2.log](docs/repair-evidence/round3/02-typecheck-attempt2.log) |
| `npm test` | 0 | 上游回归 17/17，含 768 个采样命盘完整性回归 | [03-upstream.log](docs/repair-evidence/round3/03-upstream.log) |
| `npm run test:local` | 0 | 本地 5/5 套件；包含 36 种异常与 7 组日期闭环（两次均为 0） | [04-local-attempt2.log](docs/repair-evidence/round3/04-local-attempt2.log) |
| `npm run test:engine` | 0 | 15/15 文件与上游引擎基线一致 | [05-engine.log](docs/repair-evidence/round3/05-engine.log) |
| `npm run build` | 0 | 静态构建成功；57 项核心缓存资源约 2.09 MiB | [06-build.log](docs/repair-evidence/round3/06-build.log) |
| `npm run test:pwa` | 0 | 15 项检查通过，含生产元数据与路径检查 | [07-pwa.log](docs/repair-evidence/round3/07-pwa.log) |

完整开始/结束 UTC 时间、耗时、各次退出码见 [commands.json](docs/repair-evidence/round3/commands.json)。以上均为本轮重新执行结果，未复用第二轮成功状态。

安装日志中有 `node-domexception` 弃用提示，以及 npm 12 对 esbuild postinstall 的默认阻止提示；未修改全局 allowScripts。平台二进制可正常运行，构建和后续受控错误边界编译实际通过。部分命令因沙箱账号查询或网络限制在授权的执行环境重跑；测试文件与数据仍在隔离目录，没有要求用户运行 Windows 脚本。

## 6. P1/P2 原始样本修复前后对比

修复前证据不是抄录历史报告：本轮于 `2026-11-09T10:18:03.751Z` 对哈希一致的基线模块重新执行，见 [before-reproduction.json](docs/repair-evidence/round3/before-reproduction.json)。

| 原始样本 | 本轮修复前实测 | 修复后实测 |
| --- | --- | --- |
| 正常合成 v1 备份中的 `brightnessRaw={"invalid":true}` | 导入返回 1；实际 React 渲染报对象不能作为子节点 | 导入被拒绝，中文错误指出 `brightnessRaw` 和合法值；混合备份零写入，原记录字符串、顺序、数量完全一致 |
| 该异常记录已经存在且被活动指针选中 | 既有页面路径会在恢复活动记录时使用未验证对象 | 实际构建刷新无未捕获错误，显示恢复面板；好—坏—好中的两条正常记录仍可打开；坏记录、其活动指针和完整原字符串保留，原始导出逐字节一致 |
| 农历 2050-12-15 12:00 | 换算为公历 2051-01-27，排盘成功；保存报“命盘与出生信息不一致，未保存” | 单元闭环及实际 UI 均能保存；公农历切换保留同一日期；重新打开、备份往返、离线重开成功 |

异常原样本见 [malformed-v1-before.json](docs/repair-evidence/round3/malformed-v1-before.json)，仅含合成资料。修复后证据见 [local.json](docs/repair-evidence/round3/local.json) 与 [repair-e2e-attempt2.json](docs/repair-evidence/round3/repair-e2e-attempt2.json)。

## 7. 数据完整性与旧备份兼容性

| 检查 | 结果及证据 |
| --- | --- |
| 旧 v1 备份 | 基线 fixture 导入成功；chart 和 BirthInfo 深比较不变，不重算快照 |
| 可选旧字段 | 可省略；历史空四化标记保留；见 records-schema 专项 |
| 混合异常备份 | 36 种变体均拒绝；已有记录零写入且原字符串、内容、数量、顺序不变 |
| 已有异常活动记录 | 两条正常记录可读；原好—坏—好顺序、坏记录与活动指针不变；连续刷新不崩溃 |
| 无法解析的旧原字符串 | `'{broken'` 仍可原样下载；没有自动覆盖或创建空列表 |
| 正常导出、导入、指定删除 | 实际 UI 完成；正常命盘导出后再导入可读，指定删除后其他记录保留 |
| 底层写入异常 | 既有本地回归中的配额/写失败保护继续通过 |
| 生产数据 | 未访问；无清空操作、批量删除、自动迁移或修复回写 |

兼容结论的证据范围是应用生成的正常 v1 样本、可选字段变体和本轮合成边界盘。无法穷尽所有外部手工 JSON。被严格校验拒绝的数据不会自动丢弃；若已经在设备上，进入可导出原始数据的只读模式。

## 8. 构建、离线、升级及安全回归

### 实际 Chromium 端到端

环境：Playwright 驱动系统 Chrome `157.0.8103.38`，headless，440×956 视口；只使用新建临时配置目录。以下属于桌面 Chromium 实测，**不属于 iPhone 验收**。

| 场景 | 最终结果 |
| --- | --- |
| 正常旧备份、原子拒绝、2050 农历边界与离线 CRUD | PASS；最终合成记录 5 条，无未捕获错误；关闭浏览器进程后离线重开，再离线起新盘并保存成功 |
| 已损坏活动记录恢复 | PASS；正常记录 2 条可查看，原始导出一致，活动指针保留；损坏 JSON 同样可导出 |
| 额外渲染错误边界 | PASS；受控子组件异常被捕获，导出与返回两个操作均可执行 |
| SW 双版本升级 | PASS；A 为第二轮保存的原部署制品，缓存版本 `260b7801028e3f22e730`；B 为本轮修复制品 `fc0c3d6d3fbd609e069c`。B 等待期间不刷新未保存表单；关闭所有窗口后启用 B，坏/好原数据完整保留；再次离线冷启动可恢复 |

第一次 E2E 中，错误边界专项因测试脚本从根目录解析不到 tsx 内部的 esbuild 而失败（整体退出码 1；其余三个场景通过）。只修正了测试依赖解析为 tsx 所在作用域，未改应用依赖或运行时代码；第二次四个场景全通过（退出码 0）。失败日志 [10-e2e-attempt1.log](docs/repair-evidence/round3/10-e2e-attempt1.log) 和复测 [10-e2e-attempt2.log](docs/repair-evidence/round3/10-e2e-attempt2.log) 均保留，没有将首次失败覆盖为通过。

### 产物与源码核验

- 57 项预缓存 URL、文件大小及 SHA-256 与本地制品一致；218 个 HTML 的元数据与资源路径检查通过。新制品与旧制品内容变化导致缓存版本变化，属于预期。
- 15 个引擎文件与 `a600484a49255039d0725f1ba9e11ca81a948f97` 基线一致，现有上游算法测试全部通过。没有替换算法。
- `public/manifest.webmanifest`、`scripts/build-pwa.mjs`、`components/PwaStatus.tsx`、`next.config.js` 原始哈希不变，`start_url`/`scope` 继续为 `/csk/`、SW 路径继续为 `/csk/sw.js`。
- 186 个被测源码/测试文件与最终本地文件及隔离副本哈希一致；E2E 解析修正后的脚本采用第二次实测版本。后加报告和证据文件不属于应用构建输入。
- 源码/测试/报告差异的 `git diff HEAD --check -- . ':(exclude)docs/repair-evidence/round3/'` 为 0；锁文件、远端配置原始哈希不变；未发现活动 Git hooks。补充核验见 [final-source-review.json](docs/repair-evidence/round3/final-source-review.json)。原始证据不作去空格处理：首次完整暂存检查报告 Next 构建日志的三行尾空格及 robots 制品末尾空行（退出码 2），本地提交因此在创建前停止；确认仅来自工具原始输出后保留证据，对源码单独检查。见 [staging-review.json](docs/repair-evidence/round3/staging-review.json)。

补充清单核验脚本最初对目录形式 URL 和 `.txt` 目录处理有两次工具错误，修正路径解析后通过；这两次不是应用回归失败，记录仍保留于 `verification-helper-attempts.json`。

### npm 依赖审计与隐私边界

| 命令 | 退出码 | 官方 registry 结果 |
| --- | --- | --- |
| `npm audit --json` | 0 | 0 项已知漏洞，包含开发依赖 |
| `npm audit --omit=dev --json` | 0 | 0 项已知漏洞，生产依赖 |

审计显式使用 `https://registry.npmjs.org`（项目默认镜像不提供可用审计接口），没有运行 audit fix 或改依赖。见 [08-audit.log](docs/repair-evidence/round3/08-audit.log)、[09-audit-production.log](docs/repair-evidence/round3/09-audit-production.log)。这是执行时数据库快照，不代表未来永无漏洞。

本轮新逻辑没有上传出生资料的网络路径；正常 E2E 页面观察到的非 GET/HEAD 请求数为 0。源码和交付文本的常见 GitHub/OpenAI Token、私钥格式扫描匹配数为 0；该检查不宣称穷尽全部潜在敏感格式。所有回归命盘均为合成资料；没有读取本机授权文件、导出凭证或提交浏览器配置目录。

## 9. 尚未解决的问题与风险

| 项目 | 状态 | 实际限制 |
| --- | --- | --- |
| 本轮四项缺陷的本地修复 | FIXED | 指定自动化及有效专项回归通过；没有剩余可复现的本地应用回归失败 |
| 真实 iPhone 上本次修复 | NOT_VERIFIED | 审查员无法操作真实 iPhone；iOS 文件下载、导入选择器、Safari/主屏幕存储隔离与升级需另验 |
| 修改后的 GitHub Actions 与 HTTPS 交付 | NOT_VERIFIED | 本轮禁止 push/发布，未执行；线上旧缺陷仍可能存在 |
| 长期本地持久化 | NOT_VERIFIED | 未进行多日测试或系统回收压力测试；操作系统清理网站数据的风险仍需用户备份 |

`DEPLOY_REPORT.md` 的 iPhone 16 Pro Max 启动、飞行模式冷启动排盘、保存保持 **USER_REPORTED_PASS**；这些是用户对原版本的反馈。真实 iPhone 备份导入导出、指定删除、多份记录重新打开、主题保持、跨版本更新和长期存储仍未验证，iOS 版本未提供。

没有观察到本轮修复造成的数据丢失；不能用隔离合成测试承诺任何设备上零风险。尤其是检测到异常数据后将停用写操作，避免“为了恢复界面而覆盖原存储”。原始异常备份含原数据，建议像正常命盘备份一样仅在用户自己的文件位置保留。

## 10. 第三轮独立验收建议与交付边界

**建议进入第三轮独立验收；尚不能宣布完整稳定发布验收通过。** 本地 P1、P2、P3 修复及回归证据已齐备。独立验收先审核本地提交/补丁和上述证据，重点复验异常导入原子性、恢复原始数据不变与日期契约；本报告属于实施者回归报告，不替代独立审查。

后续经用户另行决定部署验证版本后，建议只用合成数据在 iPhone 16 Pro Max 检查：

1. 正常备份导入导出、多份记录重新打开、指定删除；确认没有影响其他正常记录。
2. 在隔离测试来源或专用测试记录环境复验异常导入拒绝与原始导出；不要将异常样本导入存有真实命盘的旧线上版本。
3. 农历 2050-12-15 12:00 起盘、保存、重开和备份往返，以及飞行模式冷启动与离线新起盘。
4. 从原缓存到修复缓存的更新、未保存表单保留、主题保持，并补充 iOS 版本与长期观察。

本轮停止于本地源码、测试、文档、证据与可复审变更交付。保留现有线上可运行版本，不进行远端推送、main 合并、Pages 发布、站点数据清理或真实用户数据处理。

### 复核入口

完整证据目录：`docs/repair-evidence/round3/`。交付包另含修复方案、手机可阅读的同版 HTML、完整日志、合成测试截图及 Git 补丁。

普通 Node/npm 环境可在独立副本按第五节执行七项命令；E2E 使用 `node scripts/regression/repair-e2e.mjs`，由审查环境提供 Playwright（`PLAYWRIGHT_MODULE_PATH`）、可用 Chromium（可选 `PLAYWRIGHT_CHROMIUM_EXECUTABLE`），并通过 `REPAIR_PREVIOUS_SITE` 指定旧制品目录。测试服务器强制绑定 `127.0.0.1` 随机端口，使用临时配置目录；缺少环境时应标为未执行，不能复用本报告的通过状态。
