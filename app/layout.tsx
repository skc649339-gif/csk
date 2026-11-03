import type { Metadata, Viewport } from 'next';
import './globals.css';
import './personal.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import PwaStatus from '@/components/PwaStatus';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const metadata: Metadata = {
  title: '紫微斗数',
  description: 'iPhone 自用紫微斗数：本地排盘、命盘记录与古籍研读，无需账号。',
  applicationName: '紫微斗数',
  manifest: `${basePath}/manifest.webmanifest`,
  appleWebApp: { capable: true, title: '紫微斗数', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: `${basePath}/icons/icon-192.png`, sizes: '192x192', type: 'image/png' }],
    apple: [{ url: `${basePath}/icons/apple-touch-icon.png`, sizes: '180x180', type: 'image/png' }],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5efe0' },
    { media: '(prefers-color-scheme: dark)', color: '#020810' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('ziwei-theme');document.documentElement.setAttribute('data-theme',t==='light'||t==='dark'?t:matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');}catch(e){}})();` }} />
      </head>
      <body className="min-h-screen">
        <ThemeProvider>
          {children}
          <PwaStatus />
        </ThemeProvider>
      </body>
    </html>
  );
}
