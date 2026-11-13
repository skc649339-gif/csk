'use client';
import { useMemo, useRef, useState } from 'react';
import type { ZiweiChart } from '@/lib/ziwei/types';
import { interpretChart, readingToText } from '@/lib/interpretation/engine';
import type { ReadingSection } from '@/lib/interpretation/types';
import { ADVICE_TOPIC_LABELS, GLOSSARY, RULE_VERSION, SOURCES } from '@/lib/interpretation/knowledge';
import './PlainLanguageReading.css';

const TOPICS = [['overview','整体总结'],['personality','性格方向'],['career','事业工作'],['wealth','财运理财'],['relationships','感情婚姻'],['palaces','十二宫'],['transformations','四化影响'],['periods','十年大限'],['annual','流年边界'],['advice','综合建议']] as const;
type Topic = typeof TOPICS[number][0];

export function ReadingPreview({ chart, onOpen }: {chart:ZiweiChart;onOpen:()=>void}) {
  const reading=useMemo(()=>interpretChart(chart),[chart]);
  return <section className="reading-preview" aria-label="白话解读摘要">
    <div><span className="app-eyebrow">读懂你的命盘 · 本地生成</span><h2>把盘面，读成生活中的语言</h2>
      <p>{reading.status==='ready'?reading.sections[0].summary:'这份命盘的部分资料需要检查，暂不能可靠生成白话解读。原始记录不会因此改变。'}</p>
      <small>先看结论，再看依据。传统文化参考，不作必然命运预测。</small></div>
    <button type="button" className="app-button" onClick={onOpen}>查看白话解读 →</button>
  </section>;
}

function Section({ value }: {value:ReadingSection}) {
  return <article className="reading-section" aria-label={value.title}>
    <h2>{value.title}</h2>
    <div className="reading-conclusion"><span>一句话总结</span><p>{value.summary}</p></div>
    <h3>大白话详细解读</h3>
    {value.paragraphs.map((p,i)=><p key={i}>{p}</p>)}
    <details className="reading-evidence"><summary>对应的命盘依据 · {value.evidence.length} 项</summary>
      <p className="reading-small">下面是可回查的盘面事实与使用的规则。白话文字是本版编辑性解释，并非古籍逐字断语。</p>
      <ul>{value.evidence.map((e,i)=><li key={i}><p>{e.fact}</p><small>规则 {e.rule} · {e.sources.map(source=>SOURCES[source].title).join(' / ')}</small></li>)}</ul>
    </details>
    <h3>实际生活建议</h3>
    {value.recommendations ? <ul className="reading-actions" data-testid="reading-recommendations">
      {value.recommendations.map(({topic,text,evidence})=><li key={topic} data-advice-topic={topic}>
        <strong>{ADVICE_TOPIC_LABELS[topic]}</strong> {text}
        <p className="reading-small" data-testid="recommendation-evidence">
          <strong>盘面依据</strong> {evidence.fact}<br />
          <strong>来源</strong> {evidence.sources.map(source=>SOURCES[source].title).join(' / ')}
        </p>
      </li>)}
    </ul> : <ul className="reading-actions">{value.advice.map((text,i)=><li key={i}>{text}</li>)}</ul>}
    {!!value.generalAdvice?.length && <div data-testid="reading-general-advice">
      <h3>通用提醒</h3>
      <ul className="reading-actions">{value.generalAdvice.map(text=><li key={text}>{text}</li>)}</ul>
    </div>}
    {value.limitations.length>0&&<aside className="reading-limits" aria-label="阅读边界"><strong>阅读边界</strong>{value.limitations.map((p,i)=><p key={i}>{p}</p>)}</aside>}
  </article>;
}

export default function PlainLanguageReading({ chart, onBack }: {chart:ZiweiChart;onBack:()=>void}) {
  const reading=useMemo(()=>interpretChart(chart),[chart]);
  const [topic,setTopic]=useState<Topic>('overview');
  const [palaceId,setPalaceId]=useState(`palace-${chart.mingGongBranch}`);
  const [periodId,setPeriodId]=useState(reading.currentPeriodId||reading.periods[0]?.id||'');
  const [copyStatus,setCopyStatus]=useState('');
  const [manualCopy,setManualCopy]=useState(false);
  const articleRef=useRef<HTMLDivElement>(null);
  const text=useMemo(()=>readingToText(reading),[reading]);
  async function copy() {
    try {
      if(!navigator.clipboard?.writeText)throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(text);
      setCopyStatus('已复制完整白话报告。内容可能包含个人偏好分析，请只分享给信任的人。');
      setManualCopy(false);
    } catch {
      setManualCopy(true);
      setCopyStatus('浏览器未允许自动复制。请在下方文本框中长按、全选并复制；没有上传或修改记录。');
    }
  }
  const current=topic==='palaces'?(reading.palaces.find(s=>s.id===palaceId)||reading.palaces[0]):topic==='periods'?(reading.periods.find(s=>s.id===periodId)||reading.periods[0]):reading.sections.find(s=>s.id===topic);
  function switchTopic(next:Topic) { setTopic(next); setCopyStatus(''); }
  return <section className="plain-reading" aria-label="命盘白话解读">
    <div className="app-toolbar"><button type="button" className="app-button quiet" onClick={onBack}>← 返回命盘</button><button type="button" className="app-button quiet" disabled={reading.status!=='ready'} onClick={()=>void copy()}>复制完整解读</button></div>
    <header className="reading-header"><span className="app-eyebrow">CSK · 白话解读</span><h1>从命盘，读到日常</h1><p>先给结论，再解释盘面依据。你可以把它当作传统文化中的自我观察角度，与真实经历比较。</p><div className="reading-meta"><span>本地规则 {RULE_VERSION}</span><span>无外部 AI · 离线可读</span><span>不更改命盘或保存记录</span></div></header>
    <p className="reading-disclaimer">命理解释不等于客观事实，也不决定人生。这里不预测必然的财富、疾病或感情结果；实际选择仍需现实资料与个人判断。</p>
    {reading.warnings.map((warning,i)=><p key={i} className="app-notice" role={reading.status==='unavailable'?'alert':'status'}>{warning}</p>)}
    {copyStatus&&<p role="status" className="app-notice">{copyStatus}</p>}
    {manualCopy&&<label className="reading-copy">完整解读文本<textarea readOnly value={text} onFocus={e=>e.currentTarget.select()} aria-label="手动复制完整解读" /></label>}
    {reading.status==='ready'&&<>
      <nav className="reading-topics" aria-label="白话解读主题">{TOPICS.map(([id,label])=><button type="button" key={id} aria-pressed={topic===id} aria-controls="reading-content" onClick={()=>switchTopic(id)}>{label}</button>)}</nav>
      {topic==='palaces'&&<label className="reading-picker">选择宫位<select aria-label="选择宫位" value={palaceId} onChange={e=>setPalaceId(e.target.value)}>{reading.palaces.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>}
      {topic==='periods'&&<div className="reading-periods"><label className="reading-picker">选择十年大限<select aria-label="选择十年大限" value={periodId} onChange={e=>setPeriodId(e.target.value)}>{reading.periods.map(s=><option key={s.id} value={s.id}>{s.title}{s.id===reading.currentPeriodId?'（快照当前）':''}</option>)}</select></label><p className="reading-small">快照年龄 {reading.snapshotAge} 岁。{reading.currentPeriodId ? '当前区间沿用保存时的标记。' : '这份解读没有可显示的当前区间标记。'}全部已记录区间均可选择。</p></div>}
      <div id="reading-content" ref={articleRef} tabIndex={-1}>{current&&<Section key={current.id} value={current} />}</div>
      <details className="reading-glossary"><summary>专业术语，展开用大白话理解</summary><dl>{GLOSSARY.map(([term,meaning])=><div key={term}><dt>{term}</dt><dd>{meaning}</dd></div>)}</dl></details>
      <details className="reading-sources"><summary>规则出处、覆盖与未支持事项</summary><p>传统概念参照以下章目。本版未复制第三方解说，现代语句与生活建议为 CSK 编辑性改写，不声称覆盖全部流派或具有实证预测能力。外链仅在你主动点击时访问。</p>{Object.entries(SOURCES).map(([id,source])=><div key={id}><strong>{source.url?<a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>:source.title}</strong><p>{source.scope}</p></div>)}<p>本盘已覆盖主星：{reading.coverage.stars.join('、')||'无'}。</p><p>本盘未作独立星性解释的其他星曜：{reading.coverage.unmodeledStars.join('、')||'无'}。</p><ul>{reading.unsupported.map(t=><li key={t}>{t}</li>)}</ul></details>
    </>}
  </section>;
}
