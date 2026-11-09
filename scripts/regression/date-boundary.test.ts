import assert from 'node:assert/strict';
import { calendarInputToSolar, solarToCalendarInput } from '../../lib/ziwei/calendar-input';
import { SOLAR_INPUT_MAX, isSupportedSolarDate } from '../../lib/ziwei/date-range';
import { lunarMonthDayCount } from '../../lib/ziwei/lunar-solar';
import { formToBirthInfo } from '../../lib/ziwei/share';
import { generateChart } from '../../lib/ziwei/algorithm';
import { saveRecord, listRecords, exportRecords, importRecords } from '../../lib/ziwei/records';
import type { BirthFormState } from '../../components/BirthForm';
class MemoryStorage {data=new Map<string,string>();getItem(k:string){return this.data.get(k)??null;}setItem(k:string,v:string){this.data.set(k,v);}}
assert.deepEqual(SOLAR_INPUT_MAX, {year:2051,month:2,day:10});
assert.equal(lunarMonthDayCount(2050,12),29);
assert.deepEqual(calendarInputToSolar(2050,12,15,'lunar'),{year:2051,month:1,day:27});
assert.deepEqual(solarToCalendarInput({year:2051,month:1,day:27},'lunar'),{year:2050,month:12,day:15,leapMonth:false});
assert.throws(()=>calendarInputToSolar(2051,2,11,'solar'),/范围/);
assert.throws(()=>calendarInputToSolar(2051,12,31,'solar'),/范围/);
assert.throws(()=>calendarInputToSolar(2051,1,1,'lunar'),/年份范围/);
assert.ok(isSupportedSolarDate(2051,2,11,true));
assert.ok(!isSupportedSolarDate(2051,2,12,true));
interface BoundarySample { year:number; month:number; day:number; calendar:'solar'|'lunar'; hour:string; minute:string; leap?:boolean; unknownTime?:boolean; longitude?:number }
const cases: BoundarySample[] = [
  {year:2050,month:12,day:15,calendar:'lunar' as const,hour:'12',minute:'0'},
  {year:2050,month:12,day:29,calendar:'lunar' as const,hour:'23',minute:'30'},
  {year:2050,month:12,day:29,calendar:'lunar' as const,hour:'12',minute:'0',unknownTime:true},
  {year:2050,month:12,day:31,calendar:'solar' as const,hour:'23',minute:'30'},
  {year:2024,month:2,day:29,calendar:'solar' as const,hour:'23',minute:'30'},
  {year:2023,month:2,day:1,calendar:'lunar' as const,leap:true,hour:'23',minute:'30'},
  {year:1900,month:1,day:1,calendar:'solar' as const,hour:'0',minute:'30',longitude:75},
];
for (const item of cases) {
  const solar = calendarInputToSolar(item.year,item.month,item.day,item.calendar,!!item.leap);
  const unknownTime = !!item.unknownTime;
  const form:BirthFormState={name:'QA_BOUNDARY_ONLY',year:String(solar.year),month:String(solar.month),day:String(solar.day),clockHour:item.hour,clockMinute:item.minute,unknownTime,province:item.longitude===undefined?'':'合成地点',city:'',longitude:item.longitude??120,gender:'female'};
  const birth=formToBirthInfo(form);
  if(!unknownTime) birth.origInput={...solar,clockHour:Number(item.hour),clockMinute:Number(item.minute)};
  const chart=generateChart(birth), source=new MemoryStorage();
  saveRecord(birth,chart,source);
  assert.deepEqual(listRecords(source)[0].chart,JSON.parse(JSON.stringify(chart)));
  const restored=new MemoryStorage(); importRecords(exportRecords(source),restored);
  assert.deepEqual(listRecords(restored)[0].birthInfo,listRecords(source)[0].birthInfo);
  assert.deepEqual(listRecords(restored)[0].chart,listRecords(source)[0].chart);
}
console.log(`Date boundaries: ${cases.length} input/chart/save/reopen/export/import cycles passed; precise derived upper endpoint enforced.`);
