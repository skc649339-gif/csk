# R4-01最小转换补丁

固定依赖lunar-lite0.2.8的lunar2solar先构造普通月，再切换闰月。普通月29天、真实闰月30天时，合法闰月三十被提前拒绝。

本地patches/lunar-lite-0.2.8.json仅把这段转换改为：先取得年份闰月，选定实际负月号，再构造一次Lunar。isLeapMonth用于非实际闰月时仍忽略；返回结构、安星源码、四种流派语义和历史存储不变。没有更新或增加依赖，锁文件原字节不变。

正常npm ci --legacy-peer-deps会通过根postinstall执行scripts/apply-lunar-lite-fix.mjs。脚本只处理当前安装目录中的精确0.2.8版本和原SHA，校验iztro解析同一副本；未知版本/内容在写前失败，已补丁文件不重复写。不要把手工编辑node_modules当作交付。

若使用--ignore-scripts，补丁不会自动执行：必须显式运行node scripts/apply-lunar-lite-fix.mjs后再测试/构建；新增本地回归会检查补丁SHA并拒绝未补丁安装。不能跳过该回归发布。补丁脚本只改依赖安装产物，不接触浏览器数据。

scripts/regression/lunar-lite-fix.test.mjs保留14组严格成功要求，覆盖12时辰支×男女共336张命盘、非法普通月/闰月日拒绝及补丁幂等/版本/哈希保护。既有snapshot-lunar.test.ts的合法日期零失败断言完整保留。
