# 本地命盘写入协调

保存、删除和导入都通过 `lib/ziwei/records.ts` 的异步浏览器入口。三者使用同一个原生 Web Locks 排他锁 `ziwei-personal-records-v1:write`。锁不是 localStorage 键，不产生额外存储；锁内读取最新列表、校验、修改、一次性提交并核对读回。没有用旧列表回滚。历史 `version: 1` 格式、存储键、快照及备份兼容性不变。当前盘指针和主题仍是独立界面偏好，不参与记录列表的读改写。

- 支持安全上下文中的原生 Web Locks 才能写入；无法取得锁时明确拒绝，查看及导出仍可用。15秒等待超时通过原生 AbortSignal 取消排队，不会稍后悄悄提交。页面销毁后由浏览器释放或取消其锁。
- 已读回相同字节才显示“已保存/已删除/已导入并核验”。提交后读回失败会显示“已提交、待核验”，在只读重新读取前阻止重复写入，不将结果伪装成未写入或已核验。
- 浏览器里的旧同步写接口拒绝调用。保留显式隔离存储的非浏览器同步接口，供历史数据测试使用。不能用模块变量、localStorage 伪锁或独立二次读取替代原生协调。
- 原生锁只约束同一存储分区中遵守该协议的代码。尚打开的旧缓存页面、直接用开发者工具写入、其他不遵守协议的代码不受保护；不得混用旧/新版本进行写入。未来受控更新前先导出备份、关闭旧页面并确认新版本。没有改动 Service Worker 或强制刷新。
- 浏览器读回、重新打开可验证本地记录；不能承诺系统永不清理站点数据。真实 iPhone Safari、主屏幕及其存储分区行为仍待独立实测。

官方参考：[WebKit Safari 15.4 新功能](https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/#web-apis)（包括 iOS 15.4）与 [W3C Web Locks 工作草案](https://www.w3.org/TR/web-locks/)。浏览器版本资料不是项目真机验收。

开发回归：先用现有构建命令构建 `/csk/`；`npm run test:records-lock` 使用外部提供的 Playwright（`PLAYWRIGHT_MODULE_PATH`、`PLAYWRIGHT_BROWSERS_PATH`、可选 `PLAYWRIGHT_CHROMIUM_EXECUTABLE`），通过本机测试服务和临时 profile 验证 Chromium/WebKit。它不会向用户资料或真实站点写入；属于开发回归，不是正式发布/独立验收。
