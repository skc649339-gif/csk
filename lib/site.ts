/**
 * 自用 csk 站点根地址；其他部署通过 NEXT_PUBLIC_SITE_URL 显式覆盖。
 * 生产构建的默认值不使用 localhost。抓取策略由布局 noindex 和 robots 独立声明。
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://skc649339-gif.github.io/csk').replace(/\/+$/, '');

/** 只取域名部分，用于界面上展示（如分享卡底部） */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '');
