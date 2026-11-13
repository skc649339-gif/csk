import assert from 'node:assert/strict';import fs from 'node:fs';
import { isValidSnapshotLunarDate } from '../../lib/ziwei/snapshot-lunar-date';
import { lunarMonthDayCount, lunarToSolar } from '../../lib/ziwei/lunar-solar';
import { importRecords, listRecords } from '../../lib/ziwei/records';
import { generateChart } from '../../lib/ziwei/algorithm';
import { formToBirthInfo } from '../../lib/ziwei/share';
const fixture=JSON.parse(fs.readFileSync('scripts/regression/fixtures/records-v1-587a084.json','utf8'));
class Memory {raw:string|null=null;writes=0;getItem(_key:string){return this.raw;}setItem(_key:string,v:string){this.writes++;this.raw=v;}}
let validDays=0,invalidMonthEdges=0,charts=0;
const generationFailures: Array<{year:number;month:number;day:number;policy:string;solar:unknown;error:string}> = [];
for(let year=1900;year<=2050;year++)for(let month=1;month<=12;month++)for(const leap of [false,true]){
  const days=lunarMonthDayCount(year,month,leap);
  if(!days){assert.equal(isValidSnapshotLunarDate(year,month,1,leap),false);continue;}
  for(let day=1;day<=days;day++){assert.ok(isValidSnapshotLunarDate(year,month,day,leap),`${year}/${month}/${day} leap=${leap}`);validDays++;}
  assert.equal(isValidSnapshotLunarDate(year,month,days+1,leap),false);invalidMonthEdges++;
  if(leap)for(const day of [1,16,days])for(const policy of ['split','prev-month','next-month','origin-month'] as const){
    const solar=lunarToSolar(year,month,day,true)!;
    let chart;
    try { chart=generateChart({...solar,hour:6,gender:'female',name:'QA_ROUND4_POLICY_ONLY'},{leapMonth:policy}); }
    catch(error) { generationFailures.push({year,month,day,policy,solar,error:String(error)}); continue; }
    const data=structuredClone(fixture);data.records[0].birthInfo=chart.birthInfo;data.records[0].chart=chart;
    const s=new Memory();assert.equal(importRecords(JSON.stringify(data),s),1);assert.deepEqual(listRecords(s)[0].chart,JSON.parse(JSON.stringify(chart)));charts++;
    if(policy==='origin-month'){data.records[0].chart.lunarInfo.lunarMonth=-month;const signed=new Memory();assert.equal(importRecords(JSON.stringify(data),signed),1);assert.equal(listRecords(signed)[0].chart.lunarInfo.lunarMonth,-month);}
  }
}
const s=new Memory();importRecords(JSON.stringify(fixture),s);importRecords(JSON.stringify(fixture),s);const before=s.raw,old=listRecords(s),writes=s.writes;
const badDates=[[2050,12,30,false],[2050,1,1,true],[2023,-2,1,false],[2051,1,2,false],[1899,1,1,false]] as const;
for(const[year,month,day,leap]of badDates){const mixed=structuredClone(fixture),bad=structuredClone(fixture.records[0]);mixed.records[0].id='qa-good-before-invalid';bad.id='qa-invalid';Object.assign(bad.chart.lunarInfo,{lunarYear:year,lunarMonth:month,lunarDay:day,isLeapMonth:leap});mixed.records.push(bad);
  assert.throws(()=>importRecords(JSON.stringify(mixed),s),/日期不存在/);assert.equal(s.raw,before);assert.equal(s.writes,writes);assert.deepEqual(listRecords(s),old);
}
for(const sample of [{year:1900,month:1,day:1,hour:0,longitude:75},{year:2051,month:2,day:10,hour:23,longitude:120}]){
  const info=formToBirthInfo({name:'QA_ROUND4_EDGE_ONLY',year:String(sample.year),month:String(sample.month),day:String(sample.day),clockHour:String(sample.hour),clockMinute:'30',unknownTime:false,province:'QA',city:'',longitude:sample.longitude,gender:'male'});
  info.origInput={year:sample.year,month:sample.month,day:sample.day,clockHour:sample.hour,clockMinute:30};const chart=generateChart(info),data=structuredClone(fixture);data.records[0].birthInfo=chart.birthInfo;data.records[0].chart=chart;
  const edge=new Memory();assert.equal(importRecords(JSON.stringify(data),edge),1);assert.deepEqual(listRecords(edge)[0].chart,JSON.parse(JSON.stringify(chart)));
}
console.log(`Snapshot lunar validity: ${validDays} valid days, ${invalidMonthEdges} invalid month edges, ${charts} unchanged leap-policy snapshots, signed legacy months, exact normalized edges and zero-write mixed rejection passed.`);
fs.mkdirSync('test-results',{recursive:true});
fs.writeFileSync('test-results/snapshot-lunar-range.json',JSON.stringify({validDays,invalidMonthEdges,charts,generationFailures},null,2)+'\n');
assert.equal(generationFailures.length,0,`Valid lunar inputs must not fail chart generation. Full original failure samples retained in test-results/snapshot-lunar-range.json: ${JSON.stringify(generationFailures)}`);
