'use client';

import { useEffect, useState } from 'react';

type CacheState = 'checking' | 'ready' | 'unavailable' | 'failed';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default function PwaStatus() {
  const [online, setOnline] = useState(true);
  const [cache, setCache] = useState<CacheState>('checking');
  const [update, setUpdate] = useState(false);
  const [help, setHelp] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    setStandalone(window.matchMedia('(display-mode: standalone)').matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    let disposed = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let registration: ServiceWorkerRegistration | undefined;

    const check = async (worker?: ServiceWorker | null) => {
      const active = worker || registration?.active || navigator.serviceWorker.controller;
      if (!active) return;
      const channel = new MessageChannel();
      channel.port1.onmessage = event => {
        channel.port1.close();
        if (!disposed && event.data?.type === 'CACHE_STATUS') setCache(event.data.ready ? 'ready' : 'failed');
      };
      active.postMessage({ type: 'CACHE_STATUS' }, [channel.port2]);
      timers.push(setTimeout(() => {
        channel.port1.close();
        if (!disposed) setCache(previous => previous === 'checking' ? 'failed' : previous);
      }, 5000));
    };
    const onController = () => { void check(); };
    if (!('serviceWorker' in navigator) || !window.isSecureContext) {
      setCache('unavailable');
    } else {
      navigator.serviceWorker.addEventListener('controllerchange', onController);
      navigator.serviceWorker.register(`${basePath}/sw.js`, { scope: `${basePath}/`, updateViaCache: 'none' }).then(reg => {
        if (disposed) return;
        registration = reg;
        setUpdate(!!reg.waiting);
        void check(reg.active);
        const watchInstalling = () => {
          const worker = reg.installing;
          worker?.addEventListener('statechange', () => {
            if (disposed) return;
            if (worker.state === 'installed') {
              setUpdate(!!reg.waiting && !!reg.active);
              if (!reg.active) void check(worker);
            } else if (worker.state === 'activated') {
              void check(worker);
            } else if (worker.state === 'redundant' && !reg.active) {
              setCache('failed');
            }
          });
        };
        reg.addEventListener('updatefound', watchInstalling);
        watchInstalling();
      }).catch(() => { if (!disposed) setCache('failed'); });
    }
    return () => {
      disposed = true;
      timers.forEach(clearTimeout);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      navigator.serviceWorker?.removeEventListener('controllerchange', onController);
    };
  }, []);

  const cacheLabel = cache === 'ready' ? '核心已缓存' : cache === 'checking' ? '正在准备离线资源…' : cache === 'unavailable' ? '离线缓存不可用（需 HTTPS）' : '缓存未完成，请联网重开';

  return (
    <aside className="pwa-status" style={{ padding: '16px max(16px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))', color: 'var(--t-faint)', fontSize: 12, textAlign: 'center', borderTop: '1px solid var(--t-border)' }} aria-label="安装与离线状态">
      <p role="status" aria-live="polite">{online ? '在线' : '离线'} · <span data-testid="cache-status" data-ready={cache === 'ready'}>{cacheLabel}</span>{standalone ? ' · 主屏幕模式' : ''}</p>
      {update && <p style={{ marginTop: 8 }}>更新已下载。保存当前命盘后，关闭此应用的全部窗口，再重新打开以启用。</p>}
      <button type="button" onClick={() => setHelp(!help)} aria-expanded={help} style={{ minHeight: 44, padding: '8px 14px', color: 'var(--t-gold)', textDecoration: 'underline' }}>iPhone 安装与离线说明</button>
      {help && <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'left', lineHeight: 1.9 }}>
        <p>1. 用 iPhone Safari 打开部署后的 HTTPS 地址。</p>
        <p>2. 点“分享” →“添加到主屏幕”→“添加”，名称为“紫微斗数”。</p>
        <p>3. 点主屏幕图标打开。联网等待显示“核心已缓存”，再测试飞行模式下重新打开及排盘。</p>
        <p>命盘只保存在当前手机、当前站点。Safari、主屏幕 App 和不同域名可能各有独立存储；请在主屏幕 App 内保存。清除网站数据、删除 App 或系统回收存储可能使数据丢失，请定期导出备份。无痕浏览不适合保存。</p>
        <p>核心页面和排盘资源会预缓存；其他页面首次访问需要联网，成功访问后尽可能缓存。外部视频与链接需要网络。真实 iPhone 安装、持久化与离线效果待实机验收。</p>
      </div>}
    </aside>
  );
}
