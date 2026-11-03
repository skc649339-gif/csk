import { Suspense } from 'react';
import SearchResults from './SearchResults';

export const metadata = { title: '全文搜索 · 古籍原典库' };

export default function SearchPage() {
  return <Suspense fallback={<main className="max-w-3xl mx-auto p-6">正在打开本地古籍搜索…</main>}><SearchResults /></Suspense>;
}
