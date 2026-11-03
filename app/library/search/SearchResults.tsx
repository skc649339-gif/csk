'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { searchClassics, getParagraphById } from '@/lib/classics';

export default function SearchResults() {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get('q')?.trim() || '';
  const [input, setInput] = useState(q);
  useEffect(() => { setInput(q); }, [q]);
  const hits = q ? searchClassics(q, 50) : [];
  return (
    <main className="max-w-3xl mx-auto px-5 py-8" style={{ color: 'var(--t-text)' }}>
      <nav className="flex gap-5 mb-7" aria-label="页面导航"><Link href="/library/">← 古籍库</Link><Link href="/">排盘</Link></nav>
      <h1 className="text-2xl font-semibold mb-5">古籍全文搜索</h1>
      <form className="flex gap-3 mb-5" onSubmit={event => { event.preventDefault(); router.push(`/library/search/?q=${encodeURIComponent(input.trim())}`); }}>
        <input aria-label="搜索关键词" className="min-w-0 flex-1 rounded-lg p-3 text-base" style={{ background: 'var(--t-card)', border: '1px solid var(--t-border)', color: 'var(--t-text)' }} value={input} onChange={event => setInput(event.target.value)} placeholder="如：紫微、化忌、七杀朝斗" />
        <button type="submit" className="rounded-lg px-4 py-3" style={{ background: 'var(--t-gold)', color: 'var(--t-bg)' }}>搜索</button>
      </form>
      <p className="leading-7 mb-5" style={{ color: 'var(--t-text2)' }}>在手机本地检索三部古籍；不需要搜索服务。{q ? `「${q}」显示 ${hits.length} 条结果（最多50条）。` : '请输入关键词。'}</p>
      {q && !hits.length && <p className="card-glass rounded-xl p-5">暂未找到匹配原文，可尝试其他词语。</p>}
      <div className="space-y-4">
        {hits.map((hit, index) => (
          <Link key={`${hit.paragraphId}-${index}`} className="block card-glass rounded-xl p-5" href={`/library/${hit.bookSlug}/${getParagraphById(hit.paragraphId)?.chapterIdx ?? 0}/#${hit.paragraphId}`}>
            <div className="mb-2 text-sm" style={{ color: 'var(--t-gold)' }}>《{hit.bookTitle}》 · {hit.chapterTitle}</div>
            <div className="leading-8 break-words" dangerouslySetInnerHTML={{ __html: hit.snippet }} />
          </Link>
        ))}
      </div>
      <style>{`mark { background: rgba(184,146,42,.25); color: inherit; padding: 0 2px; border-radius: 2px; font-weight: 600; }`}</style>
    </main>
  );
}
