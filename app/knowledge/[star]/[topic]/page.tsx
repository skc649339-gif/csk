import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ALL_STARS, ALL_TOPICS, STAR_BRIEF_SEO, STAR_TO_SLUG, SLUG_TO_STAR, getKnowledge } from '@/lib/seo/knowledge';
import { TOPIC_LABEL, type TopicKey } from '@/lib/ziwei/db-analysis';

export const dynamicParams = false;

// 保留旧专题地址，但绝不将空断语库包装成已提供的完整解读。
export function generateStaticParams() {
  return ALL_STARS.flatMap(star => ALL_TOPICS.map(topic => ({ star: STAR_TO_SLUG[star], topic })));
}

type PageProps = { params: Promise<{ star: string; topic: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { star: slug, topic } = await params;
  const star = SLUG_TO_STAR[slug];
  if (!star || !ALL_TOPICS.includes(topic as TopicKey)) return {};
  return {
    title: `${star} · ${topic === 'overview' ? '主星简介' : TOPIC_LABEL[topic as TopicKey]} · 紫微斗数`,
    description: STAR_BRIEF_SEO[star],
  };
}

export default async function KnowledgePage({ params }: PageProps) {
  const { star: slug, topic } = await params;
  const star = SLUG_TO_STAR[slug];
  if (!star || !ALL_TOPICS.includes(topic as TopicKey)) notFound();
  const data = getKnowledge(star, topic as TopicKey);
  return (
    <main className="max-w-3xl mx-auto px-5 py-8" style={{ color: 'var(--t-text)' }}>
      <nav className="flex flex-wrap gap-5 mb-7" aria-label="页面导航">
        <Link href="/knowledge/">← 主星知识</Link>
        <Link href="/chart/">排盘</Link>
        <Link href="/library/">古籍原典</Link>
      </nav>
      <h1 className="text-3xl font-semibold mb-5" style={{ color: 'var(--t-gold)' }}>{star} · 主星简介</h1>
      <section className="card-glass rounded-xl p-5 mb-5">
        <h2 className="text-lg font-semibold mb-3">基础说明</h2>
        <p className="text-base leading-8" style={{ color: 'var(--t-text2)' }}>{STAR_BRIEF_SEO[star]}</p>
      </section>
      {data.exists ? (
        <section className="card-glass rounded-xl p-5 mb-5">
          <h2 className="text-lg font-semibold mb-3">{data.topicLabel}</h2>
          <p className="whitespace-pre-wrap leading-8">{data.parsed.raw}</p>
        </section>
      ) : topic !== 'overview' ? (
        <section className="card-glass rounded-xl p-5 mb-5">
          <h2 className="text-lg font-semibold mb-3">{TOPIC_LABEL[topic as TopicKey]}</h2>
          <p className="leading-8" style={{ color: 'var(--t-text2)' }}>
            此专题的完整论断未在原项目开源。本页保留主星简介与原典入口，未生成替代断语。
          </p>
        </section>
      ) : null}
      <section className="card-glass rounded-xl p-5 mb-6">
        <h2 className="text-lg font-semibold mb-3">查阅古籍原文</h2>
        <p className="leading-8 mb-4" style={{ color: 'var(--t-text2)' }}>检索《骨髓赋》《紫微斗数全集》《紫微斗数全书》，结果会显示原文出处。</p>
        <Link className="inline-block py-3" href={`/library/search/?q=${encodeURIComponent(star)}`}>搜索「{star}」→</Link>
      </section>
      <nav className="flex flex-wrap gap-4" aria-label="其他主星">
        {ALL_STARS.filter(s => s !== star).map(s => <Link key={s} className="py-2" href={`/knowledge/${STAR_TO_SLUG[s]}/overview/`}>{s}</Link>)}
      </nav>
      <p className="mt-8 leading-7" style={{ color: 'var(--t-faint)' }}>
        来源：<a href="https://github.com/Renhuai123/ziwei-doushu" target="_blank" rel="noreferrer">Renhuai123/ziwei-doushu</a> 的本地主星资料。
      </p>
    </main>
  );
}
