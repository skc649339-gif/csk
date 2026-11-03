import Link from 'next/link';
import { ALL_STARS, STAR_BRIEF_SEO, STAR_TO_SLUG } from '@/lib/seo/knowledge';

export const metadata = {
  title: '主星知识 · 紫微斗数',
  description: '十四主星基础说明与古籍原文检索，资料来自原项目的本地知识数据。',
};

export default function KnowledgeHomePage() {
  return (
    <main className="max-w-4xl mx-auto px-5 py-8" style={{ color: 'var(--t-text)' }}>
      <nav className="flex gap-5 mb-7" aria-label="页面导航">
        <Link href="/">← 排盘</Link>
        <Link href="/library/">古籍原典 →</Link>
      </nav>
      <h1 className="text-2xl font-semibold mb-3">十四主星知识</h1>
      <p className="text-base leading-7 mb-6" style={{ color: 'var(--t-text2)' }}>
        保留原项目的主星基础说明，可直接检索三部古籍原文。原项目未开源的十三主题完整断语与 AI 接口不包含在此版本中。
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ALL_STARS.map(star => (
          <article key={star} className="card-glass rounded-xl p-5">
            <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--t-gold)' }}>
              <Link href={`/knowledge/${STAR_TO_SLUG[star]}/overview/`}>{star}</Link>
            </h2>
            <p className="text-base leading-7 mb-3" style={{ color: 'var(--t-text2)' }}>{STAR_BRIEF_SEO[star]}</p>
            <div className="flex flex-wrap gap-4">
              <Link href={`/knowledge/${STAR_TO_SLUG[star]}/overview/`}>查看简介</Link>
              <Link href={`/library/search/?q=${encodeURIComponent(star)}`}>检索原典</Link>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-8 leading-7" style={{ color: 'var(--t-faint)' }}>
        数据来源：<a href="https://github.com/Renhuai123/ziwei-doushu" target="_blank" rel="noreferrer">紫微斗数开源项目</a>。
        简介为原项目整理的传统知识，古籍检索结果另标书名与章节。
      </p>
    </main>
  );
}
