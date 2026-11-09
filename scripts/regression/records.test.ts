import assert from 'node:assert/strict';
import { generateChart } from '../../lib/ziwei/algorithm';
import type { BirthInfo } from '../../lib/ziwei/types';
import { RECORDS_KEY, saveRecord, listRecords, deleteRecord, exportRecords, importRecords } from '../../lib/ziwei/records';

class MemoryStorage {
  data = new Map<string, string>();
  failWrite = false;
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.failWrite) throw new Error('quota'); this.data.set(key, value); }
}
const info: BirthInfo = { year: 1990, month: 1, day: 1, hour: 4, gender: 'male', name: '本地测试', province: '北京', city: '北京', longitude: 116.4 };
const chart = generateChart(info);
const storage = new MemoryStorage();
assert.deepEqual(listRecords(storage), []);
const first = saveRecord(info, chart, storage);
const second = saveRecord(info, chart, storage);
assert.notEqual(first.id, second.id, '同一天/同姓名不能静默合并');
assert.equal(listRecords(storage).length, 2);
assert.deepEqual(listRecords(storage)[1].chart, JSON.parse(JSON.stringify(chart)), '整盘快照重读一致');
const reopened = new MemoryStorage();
reopened.data = new Map(storage.data);
assert.equal(listRecords(reopened).length, 2, '存储重开后不丢失');
deleteRecord(first.id, reopened);
assert.equal(listRecords(reopened).length, 1);
assert.equal(listRecords(reopened)[0].id, second.id, '只删除指定记录');
const backup = exportRecords(reopened);
assert.equal(importRecords(backup, reopened), 1);
assert.equal(listRecords(reopened).length, 2);
assert.notEqual(listRecords(reopened)[0].id, listRecords(reopened)[1].id, '重复导入追加，保留原条目');

// Storage-full, denied reads and malformed imports must never report success or replace existing bytes.
let before = reopened.getItem(RECORDS_KEY);
reopened.failWrite = true;
assert.throws(() => saveRecord(info, chart, reopened), /保存失败/);
assert.throws(() => deleteRecord(second.id, reopened), /保存失败/);
assert.throws(() => importRecords(backup, reopened), /保存失败/);
assert.equal(reopened.getItem(RECORDS_KEY), before);
reopened.failWrite = false;
for (const bad of ['not-json', JSON.stringify({ version: 2, records: [] }), JSON.stringify({ version: 1, records: [{}] })]) {
  assert.throws(() => importRecords(bad, reopened));
  assert.equal(reopened.getItem(RECORDS_KEY), before);
}
const corrupt = new MemoryStorage();
corrupt.setItem(RECORDS_KEY, '{broken');
assert.throws(() => listRecords(corrupt), /原数据已保留/);
assert.throws(() => saveRecord(info, chart, corrupt), /原数据已保留/);
assert.equal(corrupt.getItem(RECORDS_KEY), '{broken');
assert.throws(() => listRecords({ getItem: () => { throw new Error('denied'); }, setItem: () => {} }), /无法读取/);
assert.throws(() => saveRecord({ ...info, day: 2 }, chart, storage), /不一致/);
const badChart = JSON.parse(JSON.stringify(chart));
badChart.palaces[0].branch = badChart.palaces[1].branch;
assert.throws(() => saveRecord(info, badChart, storage), /宫位地支重复/);
const altered = JSON.parse(backup);
altered.records[0].chart.palaces = [];
assert.throws(() => importRecords(JSON.stringify(altered), storage), /校验失败/);
for (let index = 0; index < 12; index++) saveRecord({ ...info, name: `命盘${index}` }, chart, storage);
assert.equal(listRecords(storage).length, 14, '没有静默只保留十条的上游限制');
const emptyMarkerChart = JSON.parse(JSON.stringify(chart));
emptyMarkerChart.palaces[0].stars[0].siHua = '';
const emptyMarker = saveRecord(info, emptyMarkerChart, storage);
assert.equal(emptyMarker.chart.palaces[0].stars[0].siHua, '', '保留 iztro 无四化的空串，不篡改引擎快照');
const invalidMarkerChart = JSON.parse(JSON.stringify(chart));
invalidMarkerChart.palaces[0].stars[0].siHua = '未知四化';
assert.throws(() => saveRecord(info, invalidMarkerChart, storage), /siHua/);
console.log('✅ 本地记录：多盘、重开、快照、指定删除、备份往返、错误版本、损坏数据保护和存储写失败均通过');
