import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { generateChart, type LunarMonthPolicy } from '../../lib/ziwei/algorithm';
import { calendarInputToSolar } from '../../lib/ziwei/calendar-input';
import { interpretChart, readingToText } from '../../lib/interpretation/engine';
import { GLOSSARY, PAIRS, SOURCES, STAR_LENSES } from '../../lib/interpretation/knowledge';
import type { ZiweiChart } from '../../lib/ziwei/types';
import { exportRecords, importRecords, listRecords, saveRecord, RECORDS_KEY } from '../../lib/ziwei/records';

const results:{name:string;status:string;detail?:unknown;error?:string}[]=[];
function test(name:string,fn:()=>unknown) { try { const detail=fn(); results.push({name,status:'PASS',detail});console.log('PASS '+name); } catch(e) { results.push({name,status:'FAIL',error:e instanceof Error?e.stack:String(e)}); console.error('FAIL '+name+' '+String(e)); } }
const chart=generateChart({year:1990,month:1,day:1,hour:4,gender:'male'});
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const clone=<T,>(v:T):T=>JSON.parse(JSON.stringify(v));
const isMajor=(s:{type:string})=>s.type==='major';
function deepFreeze(v:unknown) { if(v&&typeof v==='object'){Object.freeze(v);for(const value of Object.values(v))deepFreeze(value);} }
class Memory { data=new Map<string,string>(); getItem(k:string){return this.data.get(k)??null;} setItem(k:string,v:string){this.data.set(k,v);} }
const legacy=JSON.parse(readFileSync('scripts/regression/fixtures/records-v1-587a084.json','utf8'));
const baseReading=interpretChart(chart);

test('正常完整四层报告：8专题+12宫+12大限',()=>{ assert.equal(baseReading.status,'ready',baseReading.warnings.join());assert.equal(baseReading.sections.length,8);assert.equal(baseReading.palaces.length,12);assert.equal(baseReading.periods.length,12);for(const s of [...baseReading.sections,...baseReading.palaces,...baseReading.periods]){assert.ok(s.summary);assert.ok(s.paragraphs.length);assert.ok(s.evidence.length);assert.ok(s.advice.length);} });
test('输入深冻结及整盘SHA不变',()=>{ const input=clone(chart),before=digest(input);deepFreeze(input);interpretChart(input);assert.equal(digest(input),before);return {before,after:digest(input)}; });
test('同一快照结果确定，无当前日期参与',()=>{assert.deepEqual(interpretChart(chart),interpretChart(clone(chart)));});
test('宫位与星曜数组重排不影响报告',()=>{const c=clone(chart);c.palaces.reverse();c.palaces.forEach(p=>p.stars.reverse());assert.deepEqual(interpretChart(c),baseReading);});
test('匿名姓名与出生地不参与性格推断或文本',()=>{const c=clone(chart);c.birthInfo.name='QA_PRIVATE_NAME';c.birthInfo.city='QA_PRIVATE_CITY';c.birthInfo.province='QA_PRIVATE_PROVINCE';const r=interpretChart(c);assert.deepEqual(r,baseReading);assert.ok(!readingToText(r).includes('QA_PRIVATE'));});
test('不同命盘产生不同结论与依据',()=>{const c=generateChart({year:1993,month:6,day:18,hour:9,gender:'female'});const other=interpretChart(c);assert.equal(other.status,'ready');assert.notEqual(other.sections[0].summary,baseReading.sections[0].summary);assert.notDeepEqual(other.sections[0].evidence,baseReading.sections[0].evidence);});

const samples:ZiweiChart[]=[];
for(const year of [1900,1949,1990,2000,2049,2050]) for(const hour of Array.from({length:12},(_,i)=>i)) for(const gender of ['male','female'] as const) samples.push(generateChart({year,month:1,day:1,hour,gender}));
test('144张合成命盘：全部依据回查，十四星与身命同异/空宫覆盖',()=>{
  const stars=new Set<string>(),rules=new Set<string>(),marks=new Set<string>(),pairs=new Set<string>();let same=0,different=0,empty=0;
  for(const c of samples){const before=digest(c),r=interpretChart(c);assert.equal(r.status,'ready',r.warnings.join());assert.equal(digest(c),before);if(c.mingGongBranch===c.shenGongBranch)same++;else different++;
    r.coverage.stars.forEach(n=>stars.add(n));r.coverage.rules.forEach(n=>rules.add(n));
    for(const s of [...r.sections,...r.palaces,...r.periods])for(const e of s.evidence){for(const id of e.sources)assert.ok(SOURCES[id]);for(const b of e.branches)assert.ok(c.palaces.some(p=>p.branch===b));for(const name of e.stars)assert.ok(e.branches.some(b=>c.palaces.find(p=>p.branch===b)!.stars.some(s=>s.name===name)),JSON.stringify(e));
      if(e.rule==='same-palace-pair')pairs.add(e.stars.join('+'));
      if(e.rule==='empty-opposite'){empty++;const p=c.palaces.find(p=>p.branch===e.branches[0])!,op=c.palaces.find(p=>p.branch===e.branches[1])!;assert.equal(p.stars.filter(isMajor).length,0);assert.equal(op.branch,(p.branch+6)%12);for(const n of e.stars)assert.ok(op.stars.some(s=>s.name===n&&isMajor(s)));}
    }
    for(const p of c.palaces)for(const star of p.stars)if(star.siHua){marks.add(star.siHua);const note=r.palaces.find(s=>s.id===`palace-${p.branch}`)!.evidence.find(e=>e.rule==='natal-transform'&&e.stars.includes(star.name));assert.ok(note);assert.deepEqual(note.branches,[p.branch]);assert.ok(note.fact.includes('化'+star.siHua));}
  }
  assert.equal(stars.size,14);assert.equal(marks.size,4);assert.ok(same&&different&&empty);assert.equal(pairs.size,PAIRS.length,'每一条具名同宫组合须有真实引擎样本');
  return {charts:samples.length,stars:[...stars].sort(),marks:[...marks].sort(),same,different,emptyReferences:empty,pairs:[...pairs].sort(),rules:[...rules].sort()};
});
test('全部真实大限：年龄区间、当前快照索引及背景落宫匹配',()=>{for(const c of samples){const r=interpretChart(c);for(const d of c.daXians){const s=r.periods.find(s=>s.id===`period-${d.startAge}-${d.endAge}`)!;assert.ok(s.title.includes(`${d.startAge}–${d.endAge}`));assert.ok(s.evidence.find(e=>e.rule==='period-range')!.branches.includes(d.palaceBranch));}const d=c.daXians[c.currentDaXianIndex];assert.equal(r.currentPeriodId,d?`period-${d.startAge}-${d.endAge}`:null);}return{periods:samples.length*12};});
test('空宫不会把对宫四化写成本宫四化',()=>{for(const c of samples){const r=interpretChart(c);for(const p of c.palaces.filter(p=>!p.stars.some(isMajor))){const s=r.palaces.find(s=>s.id===`palace-${p.branch}`)!;for(const e of s.evidence.filter(e=>e.rule==='natal-transform'))assert.ok(p.stars.some(star=>e.stars.includes(star.name)&&!!star.siHua));assert.ok(s.limitations.some(t=>t.includes('不能把对宫当成本宫')));}}});
test('空宫且对宫无主星不编造主星',()=>{const c=clone(chart);const p=c.palaces.find(p=>!p.stars.some(isMajor))!;const op=c.palaces.find(a=>a.branch===(p.branch+6)%12)!;op.stars=op.stars.filter(s=>!isMajor(s));op.isEmpty=true;delete op.borrowedStars;delete op.borrowedFromBranch;const r=interpretChart(c);assert.equal(r.status,'ready',r.warnings.join());assert.ok(r.palaces.find(s=>s.id===`palace-${p.branch}`)!.summary.includes('都没有'));});
test('旧快照缺少可选亮度/大限四化不补算',()=>{const c=clone(chart);c.palaces.forEach(p=>p.stars.forEach(s=>{delete s.brightnessRaw;delete s.brightness;}));c.daXians.forEach(d=>delete d.siHua);const r=interpretChart(c);assert.equal(r.status,'ready');assert.ok(r.palaces.some(s=>s.limitations.some(t=>t.includes('没有亮度'))));assert.ok(r.periods.every(s=>s.limitations.some(t=>t.includes('未提供大限四化'))));});
test('大限四化单独读取快照，不改写生年四化',()=>{const c=clone(chart);const d=c.daXians[0];d.siHua={stemIndex:0,stemName:'甲',lu:'廉贞',quan:'破军',ke:'武曲',ji:'太阳'};const before=digest(c);const r=interpretChart(c);assert.equal(r.status,'ready');const s=r.periods.find(s=>s.id===`period-${d.startAge}-${d.endAge}`)!;assert.equal(s.evidence.filter(e=>e.rule==='period-transform').length,4);assert.equal(digest(c),before);});
test('大限四化找不到星则明确缺项',()=>{const c=clone(chart);c.daXians[0].siHua={stemIndex:0,stemName:'甲',lu:'未提供的星',quan:'破军',ke:'武曲',ji:'太阳'};const r=interpretChart(c);assert.ok(r.periods[0].limitations.some(t=>t.includes('无法定位')));assert.ok(!r.periods[0].evidence.some(e=>e.stars.includes('未提供的星')));});
test('无当前大限索引允许手动选取',()=>{const c=clone(chart);c.currentDaXianIndex=-1;const r=interpretChart(c);assert.equal(r.status,'ready');assert.equal(r.currentPeriodId,null);assert.ok(r.warnings.length);});
test('年度不会按当前年份虚构预测',()=>{const s=baseReading.sections.find(s=>s.id==='annual')!;assert.ok(s.summary.includes('不根据当前年份'));assert.ok(s.evidence.every(e=>e.stars.length===0));});
test('三方四正依据的地支间隔准确',()=>{for(const s of baseReading.palaces)for(const e of s.evidence.filter(e=>e.rule==='related-palaces'))assert.ok([4,6,8].includes((e.branches[1]-e.branches[0]+12)%12));});
test('过时借星注记不覆盖实际对宫星曜',()=>{const c=clone(chart),p=c.palaces.find(p=>!p.stars.some(isMajor))!;p.borrowedStars=['伪造主星'];p.borrowedFromName='错误宫名';const r=interpretChart(c);assert.equal(r.status,'ready');const s=r.palaces.find(s=>s.id===`palace-${p.branch}`)!;assert.ok(s.limitations.some(x=>x.includes('注记与实际对宫不一致')));assert.ok(!s.evidence.some(e=>e.stars.includes('伪造主星')));});
test('未知主星保留限制，不借用原型对象属性',()=>{const c=clone(chart);const p=c.palaces.find(p=>p.stars.some(isMajor))!;p.stars.filter(isMajor).forEach((s,i)=>s.name='UNMODELED_'+i);p.selfSihua=[];const r=interpretChart(c);assert.equal(r.status,'ready');assert.ok(r.coverage.unmodeledStars.includes('UNMODELED_0'));assert.ok(!r.palaces.find(s=>s.id===`palace-${p.branch}`)!.evidence.some(e=>e.rule==='star-context'));});
test('来源、术语与组合清单可维护且完整',()=>{assert.equal(Object.keys(STAR_LENSES).length,14);assert.ok(PAIRS.length>=20);assert.ok(GLOSSARY.length>=7);assert.ok(Object.values(SOURCES).every(s=>s.scope));});

for(const [name,change] of [
  ['缺少命盘',()=>null],['空对象',()=>({})],['错误嵌套对象',(c:ZiweiChart)=>{(c.palaces[0].stars[0] as unknown as Record<string,unknown>).brightnessRaw={invalid:true};return c;}],
  ['缺失星曜数组',(c:ZiweiChart)=>{delete (c.palaces[0] as unknown as Record<string,unknown>).stars;return c;}],
  ['非法农历日期',(c:ZiweiChart)=>{Object.assign(c.lunarInfo,{lunarYear:2050,lunarMonth:12,lunarDay:30,isLeapMonth:false});return c;}],
  ['重复宫位',(c:ZiweiChart)=>{c.palaces[0].branch=c.palaces[1].branch;return c;}],
  ['星曜重复',(c:ZiweiChart)=>{c.palaces[0].stars.push(clone(c.palaces[1].stars[0]));return c;}],
  ['错误身宫标记',(c:ZiweiChart)=>{c.palaces[0].isShenGong=!(c.palaces[0].branch===c.shenGongBranch);return c;}],
  ['错误空宫标记',(c:ZiweiChart)=>{c.palaces[0].isEmpty=!c.palaces[0].stars.every(s=>!isMajor(s));return c;}],
  ['错误对宫标记',(c:ZiweiChart)=>{c.palaces[0].oppositeBranch=c.palaces[0].branch;return c;}],
  ['错误大限年龄',(c:ZiweiChart)=>{c.daXians[0].endAge=c.daXians[0].startAge+20;return c;}],
  ['null可选字段',(c:ZiweiChart)=>{(c.palaces[0].stars[0] as unknown as Record<string,unknown>).brightnessRaw=null;return c;}],
  ['伪造自化星曜',(c:ZiweiChart)=>{c.palaces[0].selfSihua=[{starName:'不存在的星',siHua:'禄'}];return c;}],
] as [string,(c:ZiweiChart)=>unknown][])test('异常数据安全降级：'+name,()=>{const c=change(clone(chart)),before=digest(c);const r=interpretChart(c);assert.equal(r.status,'unavailable');assert.equal(r.sections.length,0);assert.ok(r.warnings[0].includes('保留'));assert.equal(digest(c),before);});

test('旧版备份：解读重开、导出和重新导入深度一致',()=>{const m=new Memory();importRecords(JSON.stringify(legacy),m);const stored=m.getItem(RECORDS_KEY);const a=listRecords(m)[0];const r=interpretChart(a.chart);assert.equal(r.status,'ready',r.warnings.join());assert.equal(m.getItem(RECORDS_KEY),stored);const exported=exportRecords(m);const other=new Memory();importRecords(exported,other);assert.deepEqual(interpretChart(listRecords(other)[0].chart),r);assert.deepEqual(listRecords(other)[0].chart,a.chart);return{legacyRecordChartSha256:digest(a.chart),reportSha256:digest(r)};});
test('解读不影响追加保存及失败导入后的字节与顺序',()=>{const m=new Memory();saveRecord(chart.birthInfo,chart,m);saveRecord(samples[1].birthInfo,samples[1],m);const before=m.getItem(RECORDS_KEY);for(const x of listRecords(m))interpretChart(x.chart);const bad=JSON.parse(exportRecords(m));bad.records[1].chart.palaces[0].stars[0].brightnessRaw={invalid:true};assert.throws(()=>importRecords(JSON.stringify(bad),m));assert.equal(m.getItem(RECORDS_KEY),before);});

test('14个原失败闰月 × 四策略及2050年末农历边界',()=>{let count=0;for(const [year,month]of [[1906,4],[1914,5],[1919,7],[1925,4],[1936,3],[1938,7],[1941,6],[1944,4],[1952,5],[1955,3],[2017,6],[2036,6],[2047,5],[2050,3]])for(const policy of ['split','prev-month','next-month','origin-month'] as LunarMonthPolicy[]){const solar=calendarInputToSolar(year,month,30,'lunar',true);const c=generateChart({...solar,hour:6,gender:'male'},{leapMonth:policy});const before=digest(c);assert.equal(interpretChart(c).status,'ready',JSON.stringify({year,month,policy}));assert.equal(digest(c),before);count++;}const solar=calendarInputToSolar(2050,12,15,'lunar',false);const c=generateChart({...solar,hour:6,gender:'female'});assert.equal(interpretChart(c).status,'ready');const m=new Memory();saveRecord(c.birthInfo,c,m);assert.deepEqual(interpretChart(listRecords(m)[0].chart),interpretChart(c));return{leapCases:count,lunar2050EndSolar:solar};});

test('V2-AUD-02：综合建议四主题可回查，通用提醒另列',()=>{
  const inputs=[[1955,2],[1980,0],[1990,9]];
  const careerSummaries=new Set<string>();
  for(const [year,hour]of inputs){
    const c=generateChart({year,month:1,day:1,hour,gender:'male'}),r=interpretChart(c);
    const s=r.sections.find(x=>x.id==='advice')!;assert.equal(s.recommendations?.length,4);assert.ok(s.generalAdvice?.length);
    assert.deepEqual(s.advice,s.recommendations!.map(a=>a.text));
    for(const a of s.recommendations!){assert.ok(a.evidence.stars.length);assert.ok(s.evidence.some(e=>JSON.stringify(e)===JSON.stringify(a.evidence)));for(const name of a.evidence.stars)assert.ok(a.evidence.branches.some(branch=>c.palaces.find(p=>p.branch===branch)?.stars.some(star=>star.name===name)));}
    const text=readingToText(r);assert.ok(text.includes('【通用提醒】'));for(const a of s.recommendations!)assert.ok(text.includes(a.evidence.fact));
    careerSummaries.add(r.sections.find(s=>s.id==='career')!.summary);
  }
  assert.equal(careerSummaries.size,3,'S02/S04/S05 distinct actual career star sets');
});
test('V2-AUD-03：部分四化明确缺项，不补造其余标记',()=>{
  for(const n of [0,1,2,3]){const c=clone(chart);let count=0;for(const p of c.palaces)for(const s of p.stars)if(s.siHua&&count++>=n)delete s.siHua;
    const r=interpretChart(c),t=r.sections.find(s=>s.id==='transformations')!;assert.equal(r.status,'ready');assert.ok(t.limitations.some(s=>/缺|不完整|不足/.test(s)));assert.equal(t.evidence.filter(e=>e.rule==='natal-transform').length,n);
  }
});
test('V2-AUD-03：未知星四化保留事实而不生成该星断语',()=>{
  const c=clone(chart),p=c.palaces.find(p=>p.stars.some(s=>s.siHua))!,s=p.stars.find(s=>s.siHua)!;s.name='QA_UNKNOWN_TRANSFORM';delete p.selfSihua;
  const r=interpretChart(c),t=r.sections.find(s=>s.id==='transformations')!;assert.equal(r.status,'ready',r.warnings.join());assert.ok(t.evidence.some(e=>e.stars.includes(s.name)));assert.ok(!t.paragraphs.some(text=>text.includes(s.name)));assert.ok(t.limitations.some(text=>/未建模|星性|未知/.test(text)));assert.ok(!r.sections.find(s=>s.id==='advice')!.recommendations?.some(a=>a.evidence.stars.includes(s.name)));
});
test('V2-AUD-04：命宫别名与指针使用同一规范且冲突不解读',()=>{
  const c=clone(chart);const p=c.palaces.find(p=>p.name==='命宫')!;p.name='命';assert.equal(interpretChart(c).status,'ready');
  c.palaces.forEach(p=>delete p.isMingGong);c.mingGongBranch=(p.branch+1)%12;const before=digest(c);assert.equal(interpretChart(c).status,'unavailable');assert.equal(digest(c),before);
});
test('V2-AUD-04：年龄区间冲突只移除当前标记，仍可查看各历史区间',()=>{
  const c=clone(chart);c.currentAge=35;c.currentDaXianIndex=0;const before=digest(c),r=interpretChart(c);assert.equal(r.status,'ready');assert.equal(r.currentPeriodId,null);assert.equal(r.periods.length,12);assert.ok(r.warnings.some(s=>/冲突|不符|不一致/.test(s)));assert.equal(digest(c),before);
});
test('V2-AUD-05：S12及多盘双星组合不出现重复拼接动词',()=>{
  const s12=generateChart({year:2000,month:2,day:29,hour:0,gender:'male'});const r=interpretChart(s12);assert.equal(r.status,'ready');assert.ok(!readingToText(r).includes('重视重视'));
  for(const c of samples)assert.ok(!readingToText(interpretChart(c)).includes('重视重视'));
});
mkdirSync('test-results',{recursive:true});writeFileSync('test-results/reading.json',JSON.stringify({at:new Date().toISOString(),syntheticOnly:true,passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,results},null,2));
console.log(`reading: ${results.filter(r=>r.status==='PASS').length}/${results.length} tests passed`);
if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
