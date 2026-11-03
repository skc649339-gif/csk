import Link from 'next/link';
export const metadata = { title: '本地隐私 · 紫微斗数' };
export default function PrivacyPage() {
  return <main className="personal-app app-help"><Link href="/">← 返回命盘</Link><h1 className="text-2xl my-6">本地隐私说明</h1><p>本版不提供账号、会员、支付、广告或跨设备同步；没有分析统计脚本。</p><h2 className="mt-8">资料存在哪里</h2><p>出生日期、时间、性别、出生地、姓名与命盘在浏览器内计算。只有你点击保存后，命盘记录才写入当前站点的 localStorage。应用资源通过 Service Worker 缓存。主题选择与最近打开的已保存命盘编号也只在本机保存。</p><h2 className="mt-8">网络请求</h2><p>联网时静态托管服务会收到获取网页、图标、脚本与样式的普通请求（包括 IP 与浏览器请求头），其访问日志由托管服务管理。应用不会把出生信息或命盘内容传给服务器，没有 API 解读请求。点击外部网站或视频后由对方网站处理访问。</p><h2 className="mt-8">删除、导入与备份</h2><p>「我的命盘」中可逐条删除、导出 JSON 备份或从本地文件导入。备份文件含出生资料，请由自己保管；应用不会上传备份。清除网站数据、删除主屏幕应用或系统回收存储可能清除记录。Safari 标签页与主屏幕 App 的存储可能分开，建议在主屏幕 App 内保存并定期备份。</p><h2 className="mt-8">离线与权限</h2><p>应用仅缓存同源静态资源，不申请位置、相机、麦克风或推送权限。保存后会尝试请求浏览器保留本地存储，系统可以拒绝；这不影响本次保存成功，但不是永久保存保证。</p></main>;
}
