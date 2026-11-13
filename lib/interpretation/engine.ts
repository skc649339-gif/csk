import type { Palace, Star, ZiweiChart, SiHua } from '../ziwei/types';
import { validateChart } from '../ziwei/record-validation';
import { BRANCHES, PALACE_NAMES_ORDER } from '../ziwei/constants';
import { ADVICE_TOPIC_LABELS, DOMAINS, PAIRS, RULE_VERSION, SOURCES, STAR_LENSES, TRANSFORMS } from './knowledge';
import type { SourceId } from './knowledge';
import type { AdviceTopic, ChartReading, ReadingEvidence, ReadingRecommendation, ReadingSection } from './types';

const unique = <T,>(values: T[]) => [...new Set(values)];
const sorted = (stars: readonly Star[]) => [...stars].sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
const majors = (palace: Palace) => sorted(palace.stars.filter(star => star.type === 'major'));
const known = (palace: Palace) => majors(palace).filter(star => Object.hasOwn(STAR_LENSES, star.name));
const groupNames = new Set(['左辅','右弼','文昌','文曲','天魁','天钺','禄存','天马','擎羊','陀罗','火星','铃星','地空','地劫']);
const isModeled = (name: string) => Object.hasOwn(STAR_LENSES, name) || groupNames.has(name);
const unsupported = ['完整流年事件推断未支持：现有年干四化叠加不足以生成逐年运势报告。', '本版不判断具体疾病、寿命、婚育结果、收入金额或投资涨跌。', '未实现全流派格局、飞化链、流月流日及概率评分；资料缺失时不补造依据。'];

type AdviceCandidate = Omit<ReadingRecommendation, 'topic'>;
interface PalaceReading {
  section: ReadingSection;
  candidates: AdviceCandidate[];
}

const palaceActions: Record<AdviceTopic, string> = {
  personality: '选一个最近的决定，写下当时在意的事，并用后来的结果核对。',
  career: '选一项近期工作，写清希望完成的成果，结束后请一位同事给具体反馈。',
  wealth: '回顾最近一周的收支，把固定开销与可以调整的开销分别记下来。',
  relationships: '找一个双方都方便的时间，各说一项近期希望对方了解的需要。',
};

const generalAdvice = [
  '职业选择应结合真实技能、兴趣和工作反馈。',
  '理财前先核对收支和承受能力。这里的解读不预测收益或亏损。',
  '以真实相处和双方沟通判断关系。命盘无法判断伴侣品行或婚姻结局。',
];

function ev(rule: string, fact: string, palaces: Palace[], stars: string[] = [], relation: ReadingEvidence['relation'] = 'own', sources: SourceId[] = ['stars','context']): ReadingEvidence {
  return { rule, fact, branches:palaces.map(p=>p.branch), stars, relation, sources };
}
function section(id:string,title:string):ReadingSection {
  return { id,title,summary:'',paragraphs:[],evidence:[],advice:[],limitations:[] };
}
function domainName(name:string) {
  const normalized=name.endsWith('宫')?name:name+'宫';
  return normalized==='仆役宫'||normalized==='奴仆宫'?'交友宫':normalized;
}
function location(p:Palace) { return `${p.name}（${BRANCHES[p.branch]}位）`; }
function starFact(star:Star) { return star.name + (star.brightnessRaw ? `·${star.brightnessRaw}` : star.brightness ? `·${star.brightness}` : '·亮度未提供') + (star.siHua ? `·生年化${star.siHua}` : ''); }

function selectRecommendations(topics: [AdviceTopic, PalaceReading][]): ReadingRecommendation[] {
  const priorities: Record<string, number> = {
    'same-palace-pair': 0,
    'natal-transform': 1,
    'star-context': 2,
    'empty-opposite': 2,
  };
  const used = new Set<string>();
  return topics.map(([topic, reading]) => {
    const ranked = [...reading.candidates].sort((a, b) =>
      (priorities[a.evidence.rule] ?? 3) - (priorities[b.evidence.rule] ?? 3));
    const choice = ranked.find(candidate => !used.has(candidate.text)) ?? {
      text: palaceActions[topic],
      evidence: reading.section.evidence[0],
    };
    used.add(choice.text);
    return { topic, ...choice };
  });
}

/** No chart generation, current-clock access, networking or storage operations. */
export function interpretChart(input: unknown): ChartReading {
  const empty:ChartReading = { version:RULE_VERSION,status:'unavailable',warnings:[],sections:[],palaces:[],periods:[],currentPeriodId:null,snapshotAge:null,unsupported:[...unsupported],coverage:{rules:[],stars:[],unmodeledStars:[]} };
  try {
    validateChart(input,'白话解读输入');
    assertRelations(input);
  } catch(error) {
    empty.warnings.push(`无法可靠生成解读。${error instanceof Error ? error.message : '命盘结构异常'}。请保留原记录，在「我的命盘」导出备份后检查；本页不会修改记录。`);
    return empty;
  }
  const chart = input as ZiweiChart;
  const reading:ChartReading = { ...empty, status:'ready',snapshotAge:chart.currentAge };
  const byBranch = new Map(chart.palaces.map(p=>[p.branch,p]));
  const find = (name:string) => chart.palaces.find(p=>domainName(p.name)===name)!;
  const palaceReadings = new Map<number,PalaceReading>();
  for(const name of PALACE_NAMES_ORDER) {
    const palace = find(name);
    const result = readPalace(palace, byBranch);
    palaceReadings.set(palace.branch,result);
    reading.palaces.push(result.section);
  }
  const life=byBranch.get(chart.mingGongBranch)!;
  const body=byBranch.get(chart.shenGongBranch)!;
  const personalityReading = palaceReadings.get(life.branch)!;
  const personality = cloneSection(personalityReading.section, 'personality', '性格与人生方向');
  const same=life.branch===body.branch;
  personality.paragraphs.push(same ? '命宫与身宫在同一宫位，传统上会把自我定位与实际投入一起阅读。可以观察自己的选择是否与口头上重视的事一致；这不等于性格单一或人生只有一种走法。' : `命宫与身宫不同：身宫落在${body.name}。除了命宫所示的自我表达，还可以从「${DOMAINS[domainName(body.name)].focus}」观察自己实际把精力投向哪里。两者是并行的观察视角，不把它写成某个年龄后的必然转变。`);
  personality.evidence.push(ev('body-focus',`命宫在${location(life)}；身宫在${location(body)}；${same?'身命同宫':'身命不同宫'}`,[life,...(same?[]:[body])],[], 'structure',['snapshot','editorial']));
  if(!same) personality.advice.push(`比较「自己想成为怎样的人」与「${body.name}相关事务上实际花的时间」，找出需要调整的分工。`);
  const careerReading = palaceReadings.get(find('官禄宫').branch)!;
  const wealthReading = palaceReadings.get(find('财帛宫').branch)!;
  const loveReading = palaceReadings.get(find('夫妻宫').branch)!;
  const career=cloneSection(careerReading.section,'career','事业与工作发展');
  const wealth=cloneSection(wealthReading.section,'wealth','财运与理财倾向');
  const love=cloneSection(loveReading.section,'relationships','感情与婚姻');
  const overview=section('overview','命盘整体总结');
  const focus=[life,find('官禄宫'),find('财帛宫')];
  overview.summary=`这张盘可以先从「${personality.summary}」读起，再把工作与资源安排放在一起看。`;
  overview.paragraphs=[`自我定位：${personality.paragraphs[0]}`, `工作方式：${career.summary}；资源安排：${wealth.summary}。这三部分可能呈现不同需要，不必要求自己在每种情境都表现一样。`, same ? '身命同宫，让“重视什么”和“投入什么”成为同一条观察线索；是否符合实际，需要用自己的经验检验。' : `身宫在${body.name}，提示把实际投入也纳入整体阅读，而不只停在命宫的性格词语上。`];
  overview.evidence=[...personality.evidence.filter(e=>e.rule==='body-focus'),...focus.flatMap(p=>palaceReadings.get(p.branch)!.section.evidence.filter(e=>['star-context','empty-opposite','same-palace-pair'].includes(e.rule)))];
  overview.advice=unique([personality.advice[0],career.advice[0],wealth.advice[0]]).filter(Boolean);
  overview.limitations=['这是一份按本盘数据组合的传统文化阅读，不是心理测评或事实证明。'];
  const transforms=readTransforms(chart);
  const annual=section('annual','流年说明 · 暂未提供完整推断');
  annual.summary='本版不根据当前年份生成流年吉凶。';
  annual.paragraphs=['原看盘页可展示年干四化叠加；那不等于完整、经过专项验证的流年体系。为避免把叠加标记写成会发生的事件，这里保留明确的未支持说明。'];
  annual.evidence=[ev('annual-boundary','当前 ZiweiChart 快照没有完整的逐年运势分析结构；本模块未读取当前年份。',[],[],'structure',['snapshot','editorial'])];
  annual.advice=['需要研究流年时，应先明确采用的流派、年龄口径和完整计算依据，再加入专项对照验证。'];
  annual.limitations=[unsupported[0]];
  const advice=section('advice','综合建议与需要注意的事项');
  advice.summary='把盘面提供的观察角度，转成可以验证的小行动。';
  advice.paragraphs=['从下列建议中挑一项适合眼下处境的行动。做完后记下实际变化，再判断它是否值得保留。'];
  advice.recommendations = selectRecommendations([
    ['personality', personalityReading],
    ['career', careerReading],
    ['wealth', wealthReading],
    ['relationships', loveReading],
  ]);
  advice.evidence = uniqueEvidence([
    ...advice.recommendations.map(item => item.evidence),
    ...personality.evidence, ...career.evidence, ...wealth.evidence, ...love.evidence, ...transforms.evidence,
  ]);
  advice.advice = advice.recommendations.map(item => item.text);
  advice.generalAdvice = [...generalAdvice];
  advice.limitations=['现实中的健康、金钱与关系决定需要现实资料和适当的专业支持，不以命盘替代。'];
  reading.sections=[overview,personality,career,wealth,love,transforms,annual,advice];
  const periods=[...chart.daXians].sort((a,b)=>a.startAge-b.startAge);
  for(const dx of periods) {
    const palace=byBranch.get(dx.palaceBranch)!;
    const base=palaceReadings.get(palace.branch)!.section;
    const period=section(`period-${dx.startAge}-${dx.endAge}`,`${dx.startAge}–${dx.endAge} 岁 · ${palace.name}`);
    period.summary=`${dx.startAge}–${dx.endAge} 岁这一大限落在本命${palace.name}，以「${DOMAINS[domainName(palace.name)].focus}」作为阶段性观察主题。`;
    period.paragraphs=[`年龄区间完全沿用已保存的命盘，并非按今天重新计算。“大限”是传统的阶段视角，不表示这十年只会发生这一类事情。${dx.endAge<18?'该阶段以成长、学习和照顾关系来理解，不套用成人事业或投资预测。':''}`,`所落宫位的本命基础：${base.paragraphs[0]}这里只把它作为背景，不当作十年事件清单。`];
    period.evidence=[ev('period-range',`快照大限 ${dx.startAge}–${dx.endAge} 岁，palaceBranch=${dx.palaceBranch}，本命宫为${palace.name}`,[palace],[],'period',['snapshot','periods']), ...base.evidence.filter(e=>['star-context','empty-opposite','same-palace-pair'].includes(e.rule))];
    period.advice=[dx.endAge<18?'用具体学习与陪伴经验观察变化，保留自主尝试的空间。':`围绕${DOMAINS[domainName(palace.name)].focus}设一个近期可复查的目标，不把十年看作不可改变的安排。`];
    period.limitations=['年龄与“当前大限”标记为快照保存时的口径，打开历史记录不会自动更新。'];
    if(dx.siHua) {
      for(const [key,mark] of [['lu','禄'],['quan','权'],['ke','科'],['ji','忌']] as const) {
        const name=dx.siHua[key];
        const target=chart.palaces.find(p=>p.stars.some(s=>s.name===name));
        if(target) {
          const modeled = isModeled(name);
          period.evidence.push(ev(modeled ? 'period-transform' : 'period-transform-unmodeled', `大限 ${dx.startAge}–${dx.endAge} 岁记录${name}化${mark}，本命落在${location(target)}`, [target], [name], 'period', modeled ? ['snapshot','transforms','periods'] : ['snapshot']));
          if (modeled) {
            period.paragraphs.push(`大限化${mark}为${name}，位于本命${target.name}。可把「${TRANSFORMS[mark].label}」与${DOMAINS[domainName(target.name)].focus}联系起来。${TRANSFORMS[mark].reading}`);
          } else {
            period.limitations.push(`${name}的大限化${mark}只列快照标记，缺少对应的解读规则。`);
          }
        } else period.limitations.push(`快照大限化${mark}为${name}，但盘内没有该星，无法定位，未生成落宫解释。`);
      }
    } else period.limitations.push('旧快照未提供大限四化，本版不重新推算补入。');
    reading.periods.push(period);
  }
  const current=chart.daXians[chart.currentDaXianIndex];
  if (!current) {
    reading.warnings.push('快照没有当前大限标记，可手动查看全部已记录的年龄区间。');
  } else if (chart.currentAge < current.startAge || chart.currentAge > current.endAge) {
    reading.warnings.push(`快照年龄 ${chart.currentAge} 岁与当前大限标记 ${current.startAge}–${current.endAge} 岁不符。已隐藏当前大限标记，可手动查看已记录的年龄区间。`);
  } else {
    reading.currentPeriodId = `period-${current.startAge}-${current.endAge}`;
  }
  const all=[...reading.sections,...reading.palaces,...reading.periods];
  reading.coverage.rules=unique(all.flatMap(s=>s.evidence.map(e=>e.rule))).sort();
  reading.coverage.stars=unique(chart.palaces.flatMap(p=>known(p).map(s=>s.name))).sort();
  reading.coverage.unmodeledStars=unique(chart.palaces.flatMap(p=>p.stars.filter(s=>!isModeled(s.name)).map(s=>s.name))).sort();
  return reading;
}

function assertRelations(chart:ZiweiChart) {
  const names=chart.palaces.map(p=>domainName(p.name));
  if(new Set(names).size!==12 || PALACE_NAMES_ORDER.some(n=>!names.includes(n))) throw new Error('十二宫名称缺失或重复');
  const allNames=chart.palaces.flatMap(p=>p.stars.map(s=>s.name));
  if(new Set(allNames).size!==allNames.length) throw new Error('星曜重复，无法确定其真实落宫');
  for(const p of chart.palaces) {
    if(domainName(p.name)==='命宫' && p.branch!==chart.mingGongBranch) throw new Error('命宫名称与地支标记冲突');
    if(p.isMingGong!==undefined && p.isMingGong!==(p.branch===chart.mingGongBranch)) throw new Error('命宫布尔标记与地支冲突');
    if(p.isShenGong!==undefined && p.isShenGong!==(p.branch===chart.shenGongBranch)) throw new Error('身宫标记与地支冲突');
    const empty=majors(p).length===0;
    if(p.isEmpty!==undefined && p.isEmpty!==empty) throw new Error('空宫标记与实际主星冲突');
    if(p.oppositeBranch!==undefined && p.oppositeBranch!==(p.branch+6)%12) throw new Error('对宫标记冲突');
    if(empty && p.borrowedFromBranch!==undefined && p.borrowedFromBranch!==(p.branch+6)%12) throw new Error('借对宫标记冲突');
    if(p.selfSihua?.some(mark=>!p.stars.some(star=>star.name===mark.starName))) throw new Error('自化标记的星曜不在该宫，无法回查依据');
  }
  const periods=[...chart.daXians].sort((a,b)=>a.startAge-b.startAge);
  for(let i=0;i<periods.length;i++) {
    const d=periods[i],p=chart.palaces.find(p=>p.branch===d.palaceBranch)!;
    if(domainName(d.palaceName)!==domainName(p.name) || d.endAge-d.startAge!==9 || (i>0 && periods[i-1].endAge>=d.startAge)) throw new Error('大限区间或落宫资料冲突');
  }
}

function readPalace(palace:Palace, byBranch:Map<number,Palace>):PalaceReading {
  const domain=DOMAINS[domainName(palace.name)];
  const result=section(`palace-${palace.branch}`,`${palace.name} · ${domain.title}`);
  const candidates: AdviceCandidate[] = [];
  function addAdvice(text: string, evidence: ReadingEvidence) {
    result.advice.push(text);
    candidates.push({text, evidence});
  }
  const own=majors(palace), opposite=byBranch.get((palace.branch+6)%12)!;
  const borrowed=own.length===0;
  const from=borrowed?opposite:palace;
  const effective=known(from);
  const pair=PAIRS.find(pair=>pair.names.every(name=>effective.some(s=>s.name===name)));
  const traits=effective.map(s=>STAR_LENSES[s.name]);
  result.evidence.push(ev('palace-domain',`${location(palace)}；传统观察主题：${domain.focus}`,[palace],[],'structure',['snapshot','palaces']));
  const prefix=borrowed?'本宫无主星，以下只作借对宫的间接参考。':'';
  if(effective.length) {
    const application = unique(traits.map(t => domain.application[t.axis])).join('，同时');
    result.summary = `${borrowed ? '借对宫参考，' : ''}${application}，可以从${traits.map(t => t.focus).join('和')}入手`;
    result.paragraphs.push(prefix + (pair ? pair.reading : `从${domain.title}来看，可以留意自己是否倾向于${traits.map(t => t.strength).join('，以及')}。请用实际经历核对这些观察。`));
    result.paragraphs.push(`转成日常语言：${unique(traits.map(t=>domain.application[t.axis])).join('；')}。潜在的拉扯在于，${traits.map(t=>t.tension).join('；另一方面，')}。可以留意这在什么情况下出现，而不把它当成固定缺点。`);
    const starEvidence = ev(borrowed?'empty-opposite':'star-context',`${location(palace)}${borrowed?`无主星；参考真实对宫${location(opposite)}的主星`:'实际主星'}：${effective.map(starFact).join('、')}${borrowed?'。所列亮度与四化属于对宫，不移入本宫':''}`,[palace,...(borrowed?[opposite]:[])],effective.map(s=>s.name),borrowed?'opposite':'own',['snapshot','stars','context','editorial']);
    result.evidence.push(starEvidence);
    if (pair) {
      const pairEvidence = ev('same-palace-pair',`${pair.names.join('、')}实际同在${location(from)}${borrowed?`，供${palace.name}借对宫参考`:'，综合两种表达需要'}。这里只读同宫组合。`,[from],pair.names,borrowed?'opposite':'own',['stars','context','editorial']);
      result.evidence.push(pairEvidence);
      addAdvice(pair.practice, pairEvidence);
    } else {
      for (const trait of traits) addAdvice(trait.practice, starEvidence);
    }
    const bright=effective.filter(s=>['庙','旺'].includes(s.brightnessRaw||'') || (!s.brightnessRaw && s.brightness==='bright'));
    const dim=effective.filter(s=>['不','陷'].includes(s.brightnessRaw||'') || (!s.brightnessRaw && s.brightness==='dim'));
    if(bright.length||dim.length) {
      result.paragraphs.push(`${borrowed?'参考的对宫':'本宫'}亮度中，${[bright.length?`${bright.map(s=>s.name).join('、')}偏向传统所说较易发挥的条件`:null,dim.length?`${dim.map(s=>s.name).join('、')}偏向需要更多磨合的条件`:null].filter(Boolean).join('；')}。这只调节前述倾向的表达，不证明能力高低，也不抵消其他条件。`);
      result.evidence.push(ev('brightness-context',`${location(from)}亮度：${[...bright,...dim].map(starFact).join('、')}`,[from],[...bright,...dim].map(s=>s.name),borrowed?'opposite':'own',['snapshot','context','editorial']));
    }
    if(effective.some(s=>!s.brightness&&!s.brightnessRaw)) result.limitations.push('部分主星没有亮度字段，相关解释没有作庙旺调节。');
  } else {
    result.summary=borrowed?'本宫与对宫都没有已覆盖的主星，暂不作性格或事件推断。':'本宫主星尚未覆盖，保留盘面事实，不生成星性结论。';
    result.paragraphs.push(`这部分的传统主题是${domain.focus}。${result.summary}可以阅读下方实际辅曜与四化资料，但不能据此补出不存在的主星。`);
    result.evidence.push(ev('insufficient-major',`${location(palace)}主星：${own.map(s=>s.name).join('、')||'无'}；${location(opposite)}主星：${majors(opposite).map(s=>s.name).join('、')||'无'}`,[palace,opposite],[], 'structure',['snapshot','editorial']));
    result.limitations.push('主星依据不足，未生成具体星性结论。');
  }
  if(borrowed) {
    result.limitations.push('借星是间接参考，不能把对宫当成本宫，也不把对宫四化当成本宫四化。');
    if((palace.borrowedFromName!==undefined && domainName(palace.borrowedFromName)!==domainName(opposite.name)) || (palace.borrowedStars!==undefined && [...palace.borrowedStars].sort().join('|')!==majors(opposite).map(s=>s.name).sort().join('|'))) result.limitations.push('快照中的借星注记与实际对宫不一致，此处只采用实际对宫主星，不沿用过时注记。');
  }
  const groups:[string,string[],string,string][] = [
    ['support',['左辅','右弼','天魁','天钺'],'本宫有传统协助类辅曜。结合前述主星，较适合把“独自做好”转成“找到合适的协作与反馈”；这不保证现实中自动出现贵人。','主动提出具体的求助事项，明确双方能承担的范围。'],
    ['learning',['文昌','文曲'],'本宫有传统表达与文书类辅曜。可以用记录、学习和沟通来承接前述主题，不推断学历高低或考试结果。','重要约定写下来，用他人能看懂的方式复述一次。'],
    ['resources',['禄存'],'本宫见禄存，可把稳步积累与资源整理作为补充观察，不等于已有财富。','定期核对已投入的资源，保留适当余地。'],
    ['movement',['天马'],'本宫见天马，可补充变化、行动和环境转换的视角，不预测迁居、旅行或升迁。','改变前比较新旧方案的实际成本与支持条件。'],
    ['friction',['擎羊','陀罗','火星','铃星'],'本宫有传统摩擦与急缓类煞曜。与主星一起看，可提醒自己留意推进节奏、沟通边界或反复卡住的地方，不据此断言灾祸。','重要决定多留一步复核，分歧先谈具体行为。'],
    ['uncertainty',['地空','地劫'],'本宫有空劫类标记。这里只提醒核对预期与实际资源的落差，不解释为注定损失、破财或没有缘分。','先核实可用资源，避免仅凭想象作长期承诺。'],
  ];
  for(const [id,names,text,advice] of groups) {
    const present=sorted(palace.stars.filter(s=>names.includes(s.name)));
    if(!present.length)continue;
    result.paragraphs.push(text);
    const evidence = ev(`aux-${id}`,`${location(palace)}实际同宫辅曜：${present.map(s=>s.name).join('、')}；结合本宫或借对宫主星阅读`,[palace],present.map(s=>s.name),'own',['snapshot','stars','editorial']);
    result.evidence.push(evidence);
    addAdvice(advice, evidence);
  }
  for(const star of sorted(palace.stars).filter(s=>s.siHua)) {
    const mark=star.siHua!;
    const evidence = natalTransformEvidence(palace, star, mark);
    result.evidence.push(evidence);
    if (!isModeled(star.name)) {
      result.limitations.push(`${star.name}的生年化${mark}只列快照标记，缺少对应的解读规则。`);
      continue;
    }
    result.paragraphs.push(`本宫记录${star.name}生年化${mark}。把这个传统符号放在「${domain.focus}」的主题下，可留意${TRANSFORMS[mark].label}。${TRANSFORMS[mark].reading}`);
    addAdvice(TRANSFORMS[mark].practice, evidence);
  }
  const related=[4,8,6].map(offset=>byBranch.get((palace.branch+offset)%12)!);
  const relatedFacts=related.map(p=>`${p.name}的${known(p).map(s=>s.name).join('、')||'空宫或未覆盖主星'}`);
  result.paragraphs.push(`把${domain.title}放回整体看，还要参考${relatedFacts.join('；')}。${related.some(p=>p.stars.some(s=>s.siHua==='忌' && isModeled(s.name)))?'关联宫位有生年化忌，表示另一个主题也可能牵动注意力；不能直接转写成本宫出问题。':'这些关联是补充观察的背景，不能单凭一处标记确定好坏。'}`);
  for(const p of related) result.evidence.push(ev('related-palaces',`${location(palace)}的${p.branch===(palace.branch+6)%12?'对宫':'三合宫'}为${location(p)}；实际主星${majors(p).map(starFact).join('、')||'无'}；本宫四化${sorted(p.stars).filter(s=>s.siHua).map(s=>s.name+'化'+s.siHua).join('、')||'未标注'}`,[palace,p],majors(p).map(s=>s.name),'related',['snapshot','context','editorial']));
  if(palace.selfSihua?.length) {
    result.paragraphs.push(`快照还记录本宫自化：${palace.selfSihua.map(m=>`${m.starName}自化${m.siHua}`).join('、')}。这与生年四化是不同层次，本版保留事实，不将两者相加为事件预测。`);
    result.evidence.push(ev('self-transform',`${location(palace)}宫干自化：${palace.selfSihua.map(m=>`${m.starName}自化${m.siHua}`).join('、')}`,[palace],palace.selfSihua.map(m=>m.starName),'own',['snapshot','editorial']));
  }
  result.advice.push(domain.advice);
  result.advice=unique(result.advice);
  const unmodeled=palace.stars.filter(s=>!isModeled(s.name));
  if(unmodeled.length) result.limitations.push(`本宫另有${unmodeled.map(s=>s.name).sort().join('、')}，本版没有对应独立组合规则，未据其推断。`);
  return {section: result, candidates};
}

function natalTransformEvidence(palace: Palace, star: Star, mark: SiHua): ReadingEvidence {
  const modeled = isModeled(star.name);
  return ev(modeled ? 'natal-transform' : 'natal-transform-unmodeled',
    `${location(palace)}快照记录${star.name}生年化${mark}`, [palace], [star.name], 'own',
    modeled ? ['snapshot','transforms','editorial'] : ['snapshot']);
}

function readTransforms(chart:ZiweiChart):ReadingSection {
  const result=section('transformations','四化影响解读');
  const marked=chart.palaces.flatMap(p=>sorted(p.stars).filter(s=>s.siHua).map(s=>({p,s}))).sort((a,b)=>a.p.branch-b.p.branch || a.s.name.localeCompare(b.s.name));
  result.summary=marked.length?`快照记录了 ${marked.length} 处生年四化标记。`:'快照没有生年四化标记，本版不重新推算或补造。';
  const interpreted = marked.filter(({s}) => isModeled(s.name));
  for(const {p,s} of marked) {
    const mark=s.siHua as SiHua;
    result.evidence.push(natalTransformEvidence(p, s, mark));
    if (!isModeled(s.name)) {
      result.limitations.push(`${s.name}的星性尚无解读规则。生年化${mark}只作为快照标记显示，不用于本盘的个性建议。`);
      continue;
    }
    result.paragraphs.push(`${p.name}记录了${s.name}化${mark}。${TRANSFORMS[mark].reading}可结合「${DOMAINS[domainName(p.name)].focus}」观察自己的实际经历。`);
    result.advice.push(TRANSFORMS[mark].practice);
  }
  const lu=interpreted.find(x=>x.s.siHua==='禄'),ji=interpreted.find(x=>x.s.siHua==='忌');
  if(lu&&ji) {
    const delta=(lu.p.branch-ji.p.branch+12)%12;
    const relation=delta===0?'同一宫位':delta===6?'一组对宫':[4,8].includes(delta)?'一组三合宫':'不同且非直接三方四正的宫位';
    result.paragraphs.push(`本盘化禄与化忌落在${relation}（${lu.p.name}与${ji.p.name}）。可以同时存在愿意投入的资源与需要磨合的关注点；不把“禄”抵消“忌”，也不把它们拼成必然得失的故事。`);
    result.evidence.push(ev('transform-relation',`生年化禄${lu.s.name}在${location(lu.p)}；生年化忌${ji.s.name}在${location(ji.p)}；地支间隔${delta}，为${relation}`,[lu.p,ji.p],[lu.s.name,ji.s.name],'related',['snapshot','context','transforms','editorial']));
  }
  if (!interpreted.length) {
    result.paragraphs.push('现有快照没有足够的生年四化资料可作个性化解读。');
  }
  const missing = Object.keys(TRANSFORMS).filter(mark => !marked.some(({s}) => s.siHua === mark));
  if (missing.length) {
    result.limitations.push(`生年四化缺项。快照未提供${missing.map(mark => `化${mark}`).join('、')}，仅解读已记录且有规则的标记。`);
  }
  result.limitations.push('生年四化、大限四化和自化分开阅读；不提供未经验证的飞化链和发生年份。');
  if(!result.advice.length)result.advice.push('先核对原盘的四化资料，再讨论其传统含义。');
  return result;
}

function cloneSection(value:ReadingSection,id:string,title:string):ReadingSection { return { ...value,id,title,paragraphs:[...value.paragraphs],evidence:[...value.evidence],advice:[...value.advice],limitations:[...value.limitations] }; }
function uniqueEvidence(items:ReadingEvidence[]) { const seen=new Set<string>(); return items.filter(e=>{const key=JSON.stringify(e);if(seen.has(key))return false;seen.add(key);return true;}); }

export function readingToText(reading:ChartReading):string {
  if(reading.status!=='ready')return reading.warnings.join('\n');
  const chapters = [...reading.sections, ...reading.palaces, ...reading.periods].map(s => {
    const advice = s.recommendations?.map(({topic, text, evidence}) => [
      `「${ADVICE_TOPIC_LABELS[topic]}」${text}`,
      `盘面依据 ${evidence.fact}`,
      `来源 ${evidence.sources.map(source => SOURCES[source].title).join(' / ')}`,
    ].join('\n')) ?? s.advice;
    const reminders = s.generalAdvice?.length ? ['【通用提醒】', ...s.generalAdvice] : [];
    return [s.title, '【一句话总结】', s.summary, '【大白话详细解读】', ...s.paragraphs,
      '【对应的命盘依据】', ...s.evidence.map(e => `${e.fact} [${e.rule}]`),
      '【实际生活建议】', ...advice, ...reminders, ...s.limitations.map(t => `阅读边界：${t}`)].join('\n');
  });
  return [`CSK 白话解读 · ${reading.version}`, '传统文化参考，非命运定论；本地生成，不上传出生资料。',
    ...reading.warnings, ...chapters, '【未支持事项】', ...reading.unsupported].join('\n\n');
}
