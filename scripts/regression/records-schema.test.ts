import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RECORDS_KEY, saveRecord, listRecords, importRecords, exportRecords, inspectRecords, exportRawRecords, deleteRecord } from '../../lib/ziwei/records';

const legacy = JSON.parse(readFileSync('scripts/regression/fixtures/records-v1-587a084.json', 'utf8'));
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
class MemoryStorage {
  data = new Map<string, string>(); writes = 0;
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes++; this.data.set(key, value); }
}
const target = new MemoryStorage();
assert.equal(importRecords(JSON.stringify(legacy), target), 1, 'actual pre-repair v1 fixture remains compatible');
assert.deepEqual(listRecords(target)[0].chart, legacy.records[0].chart, 'old chart snapshot is not recomputed or normalized');
assert.deepEqual(listRecords(target)[0].birthInfo, legacy.records[0].birthInfo);
const noOptional = clone(legacy);
for (const p of noOptional.records[0].chart.palaces) {
  for (const key of ['daXianAge','isCurrentDaXian','isMingGong','isShenGong','selfSihua','oppositeBranch','isEmpty','borrowedFromBranch','borrowedFromName','borrowedStars']) delete p[key];
  for (const s of p.stars) for (const key of ['siHua','brightness','brightnessRaw']) delete s[key];
}
for (const dx of noOptional.records[0].chart.daXians) for (const key of ['stemIndex','stemName','siHua']) delete dx[key];
assert.equal(importRecords(JSON.stringify(noOptional), target), 1, 'omitted optional fields in v1 remain accepted');
const emptySihua = clone(legacy); emptySihua.records[0].chart.palaces[0].stars[0].siHua = '';
assert.equal(importRecords(JSON.stringify(emptySihua), target), 1, 'legacy empty transformation marker remains accepted');

const changes: Array<[string, (r: any) => void]> = [
  ['brightnessRaw object', r => r.chart.palaces[0].stars[0].brightnessRaw = {invalid:true}],
  ['brightnessRaw null', r => r.chart.palaces[0].stars[0].brightnessRaw = null],
  ['brightnessRaw array', r => r.chart.palaces[0].stars[0].brightnessRaw = ['庙']],
  ['brightness object', r => r.chart.palaces[0].stars[0].brightness = {}],
  ['star type coercion', r => r.chart.palaces[0].stars[0].type = ['major']],
  ['sihua coercion', r => r.chart.palaces[0].stars[0].siHua = ['禄']],
  ['star name object', r => r.chart.palaces[0].stars[0].name = {}],
  ['stars null', r => r.chart.palaces[0].stars = null],
  ['palace flag', r => r.chart.palaces[0].isMingGong = 'true'],
  ['palace flag null', r => r.chart.palaces[0].isEmpty = null],
  ['age tuple object', r => r.chart.palaces[0].daXianAge = [{},10]],
  ['age tuple length', r => r.chart.palaces[0].daXianAge = [1,10,20]],
  ['age tuple order', r => r.chart.palaces[0].daXianAge = [20,1]],
  ['self sihua null', r => r.chart.palaces[0].selfSihua = null],
  ['self sihua nested', r => r.chart.palaces[0].selfSihua = [{siHua:'禄',starName:{}}]],
  ['borrowed stars nested', r => r.chart.palaces[0].borrowedStars = [{}]],
  ['borrowed branch', r => r.chart.palaces[0].borrowedFromBranch = 12],
  ['borrowed name', r => r.chart.palaces[0].borrowedFromName = []],
  ['four pillars nested', r => r.chart.lunarInfo.fourPillars = ['甲子','甲子',{},'甲子']],
  ['four pillars length', r => r.chart.lunarInfo.fourPillarsLunar = ['甲子']],
  ['lunar flag type', r => r.chart.lunarInfo.isLeapMonth = 'false'],
  ['lunar zero month', r => r.chart.lunarInfo.lunarMonth = 0],
  ['decade empty', r => r.chart.daXians = []],
  ['decade sihua', r => r.chart.daXians[0].siHua = {stemIndex:0,stemName:'甲',lu:{},quan:'太阳',ke:'武曲',ji:'天同'}],
  ['decade stem', r => r.chart.daXians[0].stemIndex = []],
  ['decade age order', r => {r.chart.daXians[0].startAge=30;r.chart.daXians[0].endAge=20;}],
  ['root optional text', r => r.chart.mingZhu = {}],
  ['root optional null', r => r.chart.analysisCacheProfile = null],
  ['root label', r => r.label = {}],
  ['birth gender coercion', r => r.birthInfo.gender = ['male']],
  ['birth orig null', r => r.birthInfo.origInput = null],
  ['birth invalid clock date', r => r.birthInfo.origInput = {year:1990,month:2,day:30,clockHour:12,clockMinute:0}],
  ['birth invalid clock hour', r => r.birthInfo.origInput = {year:1990,month:1,day:1,clockHour:24,clockMinute:0}],
  ['birth longitude null', r => r.birthInfo.longitude = null],
  ['birth policy', r => r.birthInfo.leapMonthPolicy = {}],
  ['timestamp out of date range', r => r.createdAt = r.updatedAt = 1e300],
];
for (const [name, change] of changes) {
  const bad = clone(legacy); change(bad.records[0]);
  const before = target.getItem(RECORDS_KEY), recordsBefore = listRecords(target), writes = target.writes;
  const mixed = clone(legacy); mixed.records[0].id = 'qa-normal-first';
  mixed.records.push(bad.records[0]);
  assert.throws(() => importRecords(JSON.stringify(mixed), target), /校验失败/, name);
  assert.equal(target.writes, writes, `${name}: no partial write`);
  assert.equal(target.getItem(RECORDS_KEY), before, `${name}: original bytes unchanged`);
  assert.deepEqual(listRecords(target), recordsBefore, `${name}: count, content and order unchanged`);
}

const stored = clone(legacy), goodLast = clone(legacy.records[0]), malformed = clone(legacy.records[0]);
stored.records[0].id = 'qa-good-first'; goodLast.id = 'qa-good-last'; malformed.id = 'qa-bad-active';
malformed.chart.palaces[0].stars[0].brightnessRaw = {invalid:true};
stored.records.push(malformed, goodLast);
const raw = JSON.stringify(stored, null, 2), damaged = new MemoryStorage(); damaged.data.set(RECORDS_KEY, raw);
const inspection = inspectRecords(damaged);
assert.ok(inspection.recoveryMessage?.includes('brightnessRaw'));
assert.deepEqual(inspection.records.map(r => r.id), ['qa-good-first','qa-good-last']);
assert.equal(exportRawRecords(damaged), raw, 'raw damaged bytes stay available for export');
assert.equal(damaged.writes, 0, 'inspection and raw export never mutate storage');
for (const action of [() => importRecords(JSON.stringify(legacy), damaged), () => deleteRecord('qa-good-first', damaged), () => saveRecord(legacy.records[0].birthInfo, legacy.records[0].chart, damaged)]) {
  assert.throws(action, /校验失败/);
  assert.equal(exportRawRecords(damaged), raw);
}
assert.deepEqual(JSON.parse(exportRawRecords(damaged)).records.map((r:any) => r.id), ['qa-good-first','qa-bad-active','qa-good-last']);
for (const invalid of ['{broken', JSON.stringify({version:2,records:[]})]) {
  const storage = new MemoryStorage(); storage.data.set(RECORDS_KEY, invalid);
  assert.equal(inspectRecords(storage).records.length, 0);
  assert.ok(inspectRecords(storage).recoveryMessage);
  assert.equal(exportRawRecords(storage), invalid); assert.equal(storage.writes, 0);
}
const duplicate = clone(stored); duplicate.records[1] = clone(duplicate.records[0]);
const duplicates = new MemoryStorage(); duplicates.data.set(RECORDS_KEY,JSON.stringify(duplicate));
assert.deepEqual(inspectRecords(duplicates).records.map(r=>r.id), ['qa-good-last']);
assert.equal(duplicates.writes,0);
assert.ok(exportRecords(target).includes('QA_LEGACY_V1_ONLY'));
console.log(`Record schema/recovery: legacy compatibility, ${changes.length} malformed cases, atomic imports, raw export and valid-record preservation passed.`);
