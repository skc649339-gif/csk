import assert from 'node:assert/strict';
import fs from 'node:fs';
import { importRecords, importRecordsWithResult, saveRecordWithResult, deleteRecordWithResult, listRecords, inspectRecords, RECORDS_KEY } from '../../lib/ziwei/records';
const fixture=JSON.parse(fs.readFileSync('scripts/regression/fixtures/records-v1-587a084.json','utf8'));
class Memory {
  raw:string|null=null; writes=0; failBeforeRead=false; failWrite=false; readbackFailures=0; armedFailures=0; mismatch=false;
  getItem(_key:string){
    if(this.failBeforeRead)throw Error('QA pre-read');
    if(this.readbackFailures>0){this.readbackFailures--;throw Error('QA committed readback');}
    if(this.mismatch){this.mismatch=false;const data=JSON.parse(this.raw!);const extra=structuredClone(fixture.records[0]);extra.id='qa-concurrent-record';data.records.unshift(extra);this.raw=JSON.stringify(data);}
    return this.raw;
  }
  setItem(_key:string,value:string){if(this.failWrite)throw Error('QA quota');this.raw=value;this.writes++;this.readbackFailures=this.armedFailures;}
}
function seeded(){const s=new Memory();importRecords(JSON.stringify(fixture),s);importRecords(JSON.stringify(fixture),s);return s;}
let passed=0;
function test(name:string,fn:()=>void){fn();passed++;console.log('PASS '+name);}
test('pre-validation, pre-read and quota failures keep bytes/content/count/order unchanged',()=>{
  for(const kind of ['validation','read','write']){const s=seeded(),before=s.raw,deep=listRecords(s),writes=s.writes;
    if(kind==='read')s.failBeforeRead=true;if(kind==='write')s.failWrite=true;
    assert.throws(()=>importRecordsWithResult(kind==='validation'?'invalid JSON':JSON.stringify(fixture),s));
    assert.equal(s.raw,before);assert.equal(s.writes,writes);s.failBeforeRead=false;assert.deepEqual(listRecords(s),deep);
  }
});
test('third-round readback failure: commit returns snapshot, never reports unsaved or rolls back',()=>{
  const s=seeded(),old=listRecords(s),writes=s.writes;s.armedFailures=1;
  const outcome=importRecordsWithResult(JSON.stringify(fixture),s);
  assert.equal(outcome.verification,'unverified');assert.equal(outcome.count,1);assert.equal(outcome.records.length,3);
  assert.match(outcome.warning!,/已经提交/);assert.ok(!outcome.warning!.includes('未保存'));
  assert.equal(s.writes,writes+1);assert.deepEqual(listRecords(s),outcome.records);assert.deepEqual(listRecords(s).slice(1),old);
  const beforeResync=s.writes;assert.deepEqual(inspectRecords(s).records,outcome.records);assert.equal(s.writes,beforeResync);
});
test('legacy scalar API returns committed count despite readback interruption',()=>{
  const s=seeded();s.armedFailures=1;assert.equal(importRecords(JSON.stringify(fixture),s),1);assert.equal(listRecords(s).length,3);
});
test('persistent readback restriction retains committed snapshot until read-only resync',()=>{
  const s=seeded(),old=listRecords(s),writes=s.writes;s.armedFailures=Infinity;
  const outcome=importRecordsWithResult(JSON.stringify(fixture),s);assert.equal(outcome.verification,'unverified');
  assert.equal(JSON.parse(s.raw!).records.length,3);assert.deepEqual(JSON.parse(s.raw!).records.slice(1),old);
  assert.throws(()=>inspectRecords(s),/无法读取/);assert.equal(s.writes,writes+1);
  s.readbackFailures=0;s.armedFailures=0;assert.deepEqual(inspectRecords(s).records,outcome.records);assert.equal(s.writes,writes+1);
});
test('readback mismatch can be safely resynced without overwriting another writer',()=>{
  const s=seeded(),old=listRecords(s),writes=s.writes;s.mismatch=false;
  const set=s.setItem.bind(s);s.setItem=(key,value)=>{set(key,value);s.mismatch=true;};
  const outcome=importRecordsWithResult(JSON.stringify(fixture),s);assert.equal(outcome.verification,'unverified');
  const actual=inspectRecords(s).records;assert.equal(actual.length,4);assert.equal(actual[0].id,'qa-concurrent-record');
  assert.deepEqual(actual.slice(2),old);assert.equal(s.writes,writes+1);
});
test('save and selected delete also distinguish commit from verification failure',()=>{
  const s=seeded(),before=listRecords(s);s.armedFailures=1;
  const saved=saveRecordWithResult(fixture.records[0].birthInfo,fixture.records[0].chart,s);
  assert.equal(saved.verification,'unverified');assert.equal(listRecords(s).length,3);assert.deepEqual(listRecords(s).slice(1),before);
  const removed=deleteRecordWithResult(saved.record.id,s);assert.equal(removed.verification,'unverified');assert.deepEqual(listRecords(s),before);
});
test('intentional repeated imports remain additive with unique IDs',()=>{
  const s=seeded(),old=listRecords(s);const a=importRecordsWithResult(JSON.stringify(fixture),s),b=importRecordsWithResult(JSON.stringify(fixture),s);
  assert.equal(a.verification,'verified');assert.equal(b.verification,'verified');assert.equal(b.records.length,4);
  assert.equal(new Set(b.records.map(r=>r.id)).size,4);assert.deepEqual(b.records.slice(2),old);
});
test('serialization exception before commit leaves the complete original storage unchanged',()=>{
  const s=seeded(),before=s.raw,writes=s.writes;
  const payload=JSON.stringify(fixture).replace('"records":[{','"records":[{"qaDeep":'+'['.repeat(20000)+'0'+']'.repeat(20000)+',');
  assert.throws(()=>importRecordsWithResult(payload,s));assert.equal(s.raw,before);assert.equal(s.writes,writes);
});
console.log(`Record commit outcomes: ${passed} cases passed; synthetic storage only.`);
