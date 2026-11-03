# 上游仓库检查记录

检查日期：2026-11-03。来源：<https://github.com/Renhuai123/ziwei-doushu>。

本记录描述开发前的上游快照 `a600484a49255039d0725f1ba9e11ca81a948f97`，并非本分支改造后的测试结论。代码在独立分支 `feature/iphone-pwa` 开发；上游 `main` 保留。检查依据为本地实际源码与随仓库许可证，不能用上游商业网站的功能宣传替代本仓库能力。

## 1. 可复用功能清单

| 功能 | 源码证据 | 上游实际状态与复用方式 |
| --- | --- | --- |
| 中文出生信息输入 | `components/BirthForm.tsx`、`lib/ziwei/share.ts` | 姓名（可选）、公历年/月/日、男/女、钟点与分钟、时辰不详、省/城市、经度；本地转换成 `BirthInfo`。原表单年份上限固定 2026。 |
| 中国出生地字典 | `lib/ziwei/cities.ts` | 省市与经度数据，可本地打包，无定位、地图服务或网络 API 要求。 |
| 公历与农历换算 | `lib/ziwei/lunar-solar.ts` | 农历日期/闰月存在性、月长校验、农历转公历（1900–2050）；公历转农历由 `getLunarInfo()` / lunar-javascript 支持。上游表单未接农历输入 UI。 |
| 十二宫与十四主星 | `lib/ziwei/algorithm.ts` 的 `generateChart()` | 基于 iztro 生成命/身宫、五行局、主星、辅星、吉星、煞星、杂曜，保留原排盘引擎，不重写安星算法。 |
| 星曜亮度 | `algorithm.ts`、`school-data.ts`、`school-tables.generated.ts` | 庙旺得利平不陷等原始亮度、粗分类亮度；全书默认与其他亮度表；`setBrightnessSchool()` 可复用。 |
| 公历/农历信息与四柱 | `algorithm.ts` 的 `getLunarInfo()`、`types.ts` | 节气四柱与农历口径四柱、农历生年/月/日/闰月、命主、身主、阴阳性别。 |
| 生年四化 | `algorithm.ts`、`constants.ts`、`PalaceCell.tsx` | 原盘保存禄权科忌；支持同宫多颗四化星显示，不应压缩为每宫一个标记。 |
| 大限与流年 | `algorithm.ts`、`components/TimeNav.tsx`、`ChartBoard.tsx` | 大限年龄区间、当前大限；盘内本命/当前大限/流年切换及四化叠层，流年可增减年份。 |
| 运限辅助工具 | `lib/ziwei/yunxian-context.ts`、`sihua.ts` | 虚岁、大限查找、童限、流月/流日/流时四化及自化等工具代码存在，但多数未接 Demo UI；不能据此宣称上游已具备这些完整界面。 |
| 空宫借星与对宫 | `algorithm.ts`、`types.ts` | 结构化保存空宫、对宫、借星来源与主星名，方便本地解释。 |
| 三方四正 | `components/ChartBoard.tsx` | 点击宫位，盘面高亮本宫、对宫与两三合宫，并绘制连线；可保留触控操作。 |
| 星曜解释 | `StarDetailPanel.tsx`、`constants.ts` | 本地十四主星详细说明、职业/感情/财富/健康等文本与星曜基础说明；组件有数据，但 `/chart` 未接 `onStarSelect`。 |
| 格局识别与命宫摘要 | `lib/ziwei/patterns.ts`、`PatternsCard.tsx`、`ChartSummary.tsx` | 现有规则库、格局等级/条件/说明、命宫星曜关键词、四化摘要可直接复用。部分组件未接上游排盘 Demo。 |
| 十二神煞 | `lib/ziwei/shier-shen.ts` | 将前、岁前、博士神煞及中英文标签函数存在，部分本命星已进入引擎。 |
| 真太阳时工具 | `lib/ziwei/true-solar-time.ts` | 经度修正、均时差近似、海外标准时区偏移、日期跨越与晚子时换日工具；注意下文表单口径差异。 |
| 夏令时提示与钟表校正工具 | `dst-cn.ts`、`clock-adjust.ts` | 中国 1986–1991 夏令时区间/判定、手动钟表转标准时间函数；原工具强调不自动替用户扣除，跨日返回 null。 |
| 闰月策略 | `algorithm.ts` 的 `resolveEffectiveLunarDate()` | 分半、归本月、归下月、原闰月四种策略；非法参数直接报错。默认 split。 |
| 流派配置存储 | `school-config.ts` | 10 类配置类型、默认值、本地存储与旧配置迁移；实际 `generateChart()` 的显式参数只有闰月，亮度由 setter 处理，其余类型不等于全部已接入引擎/UI。 |
| 历史命盘辅助 hook | `lib/ziwei/history.ts` | localStorage 保存表单、标签、时间戳、删除；上游 `/chart` 没有调用，最多10条，存在静默丢记录风险，需改造。 |
| 名人示例 | `lib/ziwei/famous.ts`、`FamousPersonCard.tsx` | 本地历史名人出生示例、分类、展示组件；样例时辰索引已有回归保护，可保留研究用途，不代表其出生资料已独立认证。 |
| 古籍阅读器 | `app/library/`、`lib/classics/` | 《骨髓赋》《紫微斗数全集》《紫微斗数全书》目录、章节、段落锚点、全文搜索；数据为静态代码，不需要数据库。 |
| 知识库框架与主星简述 | `app/knowledge/`、`lib/seo/knowledge.ts` | 14主星、13主题标签与简述存在；完整详情数据为空，必须清楚区分已提供简述与未开源论断。 |
| 双盘表单与起盘 | `app/heming/page.tsx`、`heming-knowledge.ts` | 双方出生表单和本地排盘存在；合盘方法论文本存在；AI合盘接口不在仓库，当前点击分析会失败。 |
| 分享辅助组件 | `ShareModal.tsx`、`ShareCardCanvas.tsx`、`share.ts` | URL序列化/还原、剪贴板、html2canvas图片下载代码存在；上游排盘页未接这些入口，不能称为已完整工作的分享产品。分享URL含出生信息，个人版应由用户主动选择。 |
| 主题与基础移动布局 | `ThemeProvider.tsx`、`globals.css` | 深浅主题、CSS变量、部分响应式网格和动画；小字号与小点击区仍需手机体验修正。 |
| 其他保留素材 | `lib/nihai/`、`app/preview/`、`ScrollIntro.tsx` | 天纪/地纪/人纪资料结构、卷轴演示与视觉组件；并非完整三纪产品，优先保留源码，不影响首阶段排盘主流程。 |
| 类型与回归 | `types.ts`、`scripts/regression/`、`.github/workflows/ci.yml` | TypeScript 类型检查、17个上游测试脚本；CI含类型检查和排盘回归，没有生产构建/PWA/浏览器测试。 |

## 2. 当前缺陷与需改造处

1. **没有 PWA 壳。** 未提供 Web App Manifest、安装图标、Service Worker、离线缓存或 iOS 主屏幕启动配置。`next.config.js` 未启用静态导出，原生产运行方式为 Next 服务进程。
2. **命盘未持久化接入。** `/chart` 用 React state 持有命盘，刷新/关页消失；`useHistory()` 没有接入。旧 hook 保存失败仍更新界面、吞掉异常，且超过10条自动截断。去重未考虑姓名/出生地/经度，可能错误合并不同记录；JSON未校验。
3. **宫位解释依赖不存在的接口。** `InsightPanel` 挂载自动发送 `POST /api/interpret`，选宫/四化也调用此接口；仓库没有 API 路由。界面能画盘，但不能提供商业站 AI 解读。个人版应使用已有本地说明，明确内容来源与范围。
4. **重复且不同步的运限导航。** `/chart` 自己维护 `view` / `liunianYear` 并画一条 `TimeNav`，`ChartBoard` 又独立维护同名状态及导航。外层切换不影响盘面四化；应合并状态来源。
5. **未接农历输入。** 引擎和历法工具具备能力，原表单却只有公历。需增加历法选择、闰月选择、合法日验证，转换后复用原表单到引擎链路。
6. **知识库首页链接失效。** `STAR_DB = {}`，`getAllKnowledgeRoutes()` 返回0，详情页 `dynamicParams=false`。首页展示182主题与14个详情入口，实际详情404。不能补造未开源断语，应提供现有基础说明并清楚标明上游缺失。
7. **隐私要求不符。** `layout.tsx` 挂载 Vercel Analytics、SpeedInsights；隐私/服务条款仍含会员、商业线上服务等说明。个人版应移除运行时统计、取消自动上传出生数据/AI请求，并改写真实隐私说明。
8. **静态导出阻碍。** `/library/search` 在服务器组件读取运行时 `searchParams`，需改为浏览器搜索；`robots.ts` / `sitemap.ts` 需静态可生成；动态章节使用现有 `generateStaticParams()`；空知识路由必须妥善处理。静态导出仍需实际运行构建验证，不能仅改配置即宣称成功。
9. **尚未验证 Safari。** 原仓库没有 iOS实机、WebKit、SW、存储配额/禁用与冷启动测试。13px表单字体、16px左右流年箭头等触控目标需要改善；安全区、软键盘、纵向滚动、standalone模式需验收。
10. **算法口径与宣传不完全相同。** `true-solar-time.ts` 支持均时差，但当前 `share.ts` / `BirthForm` 按经度差转换；`generateChart()` 不根据经度再次换算。默认改造应锁定上游测试结果，不无说明地切换算法。时间不详当前回落子时，并非自动确定真实时辰，必须对用户明示。
11. **部分功能仅有库/组件。** 引擎明确不产出 `palace.selfSihua` / `daXians[].siHua`；盘面可用已有工具做运限四化叠层，但不能因类型定义存在便宣称完整飞星、自化或流月流日UI已完成。未接UI的流派选项也需区别标注。
12. **不必要依赖与文案。** package.json 含 Anthropic SDK、pg、ioredis、统计组件等，当前本地排盘不需要；元数据及首页宣称AI深度解读，超出实际源码能力。生产客户端应确认无这些服务请求，是否移除闲置依赖可独立处理。

## 3. 许可证与授权限制

| 内容 | 仓库声明 | 处理要求 |
| --- | --- | --- |
| 源码（app/components/lib） | 根目录 `LICENSE`，MIT；Copyright (c) 2026 紫微研究 | 完整保留许可证及版权声明；二次开发可复用。 |
| 三部古籍原文 | README、DATASET-LICENSE 声明 Public Domain | 保留书名、来源，区分古籍原文与现代整理/解释。 |
| Releases v3.0样本与v4.0解读数据集 | `DATASET-LICENSE`，CC BY 4.0 | 使用时注明版本、上游链接、作者王多鱼AI；本阶段没有下载或整包内置，不能把它们当作已交付能力。 |
| `docs/tianji-ziwei/` 的1848条原话整理 | 目录 `LICENSE.md`，CC BY-NC-SA 4.0 | 单独标记非商业、署名、相同方式共享；不将其重标为MIT；原课程权利归原权利人。源码交付保留该目录与许可，默认不必把整套文档作为PWA缓存。 |
| 解读数据集中的倪海厦引用 | `DATASET-LICENSE`明确排除在数据授权范围之外 | 批量单独使用时按对应非商业许可处理，不能视作CC BY商用数据。 |
| `lib/nihai/`、星曜/合盘文本中的现代引文 | 代码层为MIT；部分文字提及课程、现代注家或原话 | 保留来源/署名；现代引用与课程摘录另行注意原内容权利，勿声称根MIT已覆盖全部原课程权益。自用阶段保留，不扩大为商业授权结论。 |
| 第三方依赖 | 各 npm 包的许可证 | 分发时保留依赖许可证，最终以锁定安装版本和产物许可证汇总为准；不把上游MIT当作所有依赖的统一许可。 |

以上为仓库授权文本的工程分类，不替代权利人对未声明内容的授权。

## 4. 服务端、账号与费用边界

- 本地 `generateChart()`、lunar-javascript、iztro、字典、格局和古籍数据均可在浏览器运行；不需要付费API、数据库、登录、Apple开发者账号、Mac或Xcode。
- 上游缺失 `/api/interpret`、`/api/heming` 等后端，添加 `.env` Key 不能凭空获得这些接口。商业站断语库、AI prompt、会员支付与完整线上UI未开源，不在本阶段复用范围。
- 巨型样本/解读数据集不适合直接整包放入 iPhone 缓存；本阶段不自动下载。已有本地基础说明与格局可离线展示。
- 长期HTTPS需要托管静态产物，不能使用要求Windows电脑持续运行的局域网地址或临时隧道冒充交付。免费托管候选需按部署时的实际条款核查；第三方账号创建、GitHub仓库授权等必须由用户完成或明确授权。
- 本机测试通过仅确认代码/本地浏览器行为；HTTPS部署状态、真实iPhone添加主屏幕、standalone冷启动和断网运行必须各自单列证据。

