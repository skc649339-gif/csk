'use client';
import Link from 'next/link';
import type { ZiweiChart, Palace } from '@/lib/ziwei/types';
import { BRANCHES, STEMS, STAR_DESCRIPTIONS } from '@/lib/ziwei/constants';
import { type TimeView } from './TimeNav';

const PALACE_MEANING: Record<string, string> = {
  '命宫': '观察命盘整体的出发点，结合主星及财帛、官禄、迁移三宫一同阅读。',
  '兄弟': '传统用于观察同辈与兄弟姊妹的关系。', '夫妻': '传统用于观察伴侣关系与相处方式。',
  '子女': '传统用于观察子女及晚辈关系。', '财帛': '传统用于观察求财方式与资源流动。',
  '疾厄': '传统命理中的身体主题宫位，内容不作为健康诊断。', '迁移': '传统用于观察外出与外部环境。',
  '交友': '传统用于观察朋友、同事等人际关系。', '仆役': '传统用于观察朋友与协作关系。',
  '官禄': '传统用于观察事业、职业与社会角色。', '田宅': '传统用于观察居所、家庭环境与不动产。',
  '福德': '传统用于观察精神生活与内在感受。', '父母': '传统用于观察长辈关系与支持。',
};
export default function InsightPanel({ chart, selectedPalace }: {
  chart: ZiweiChart; selectedPalace?: Palace | null;
  selectedSiHua?: { starName: string; siHua: string; view: TimeView } | null;
}) {
  const palace = selectedPalace || chart.palaces.find(p => p.isMingGong) || chart.palaces[0];
  const opposite = chart.palaces.find(p => p.branch === (palace.branch + 6) % 12);
  const main = palace.stars.filter(s => s.type === 'major');
  const related = chart.palaces.filter(p => [(palace.branch + 4) % 12, (palace.branch + 8) % 12].includes(p.branch));
  const meaning = Object.entries(PALACE_MEANING).find(([key]) => palace.name.includes(key))?.[1];
  return <section className="app-insight" aria-label="宫位详细说明"><span className="app-eyebrow">本地宫位说明</span><h2>{palace.name} <small>{STEMS[palace.stem]}{BRANCHES[palace.branch]}</small></h2><p>{meaning}</p><div className="app-insight-stars">{palace.stars.map(s => <span key={s.name}>{s.name}{s.brightnessRaw && <small> · {s.brightnessRaw}</small>}{s.siHua && <b> 化{s.siHua}</b>}</span>)}</div>{main.length === 0 && <p>此宫无主星。对宫为{opposite?.name}，可参考对宫主星：{opposite?.stars.filter(s => s.type === 'major').map(s => s.name).join('、') || '无'}。</p>}{main.map(s => { const data = STAR_DESCRIPTIONS[s.name]; return <div key={s.name} className="app-star-note"><strong>{s.name}</strong>{data ? <p>{data.nature} · {data.element}<br />{data.keywords}</p> : <p>原项目未提供该星的独立说明。</p>}<Link href={`/library/search/?q=${encodeURIComponent(s.name)}`}>查阅「{s.name}」古籍原文 →</Link></div>; })}<p className="app-muted">三方：{related.map(p => p.name).join('、')}；对宫：{opposite?.name}。盘面连线对应三方四正。</p>{palace.daXianAge && <p>本宫大限：{palace.daXianAge[0]}–{palace.daXianAge[1]} 岁。</p>}<p className="app-muted">星性文字来自原项目静态资料，属于通用说明；未接入未开源的个性化断语库。</p></section>;
}
