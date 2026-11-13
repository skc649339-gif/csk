import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { patchedConverter, applyLunarLiteFix } from '../apply-lunar-lite-fix.mjs';
import { generateChart } from '../../lib/ziwei/algorithm';

const require = createRequire(import.meta.url);
const { Lunar, LunarYear } = require('lunar-typescript');
const { lunar2solar } = require('lunar-lite');
const patch = JSON.parse(fs.readFileSync('patches/lunar-lite-0.2.8.json', 'utf8'));
const file = require.resolve('lunar-lite/lib/convertor.js'), source = fs.readFileSync(file, 'utf8');
const hash = value => createHash('sha256').update(value).digest('hex');
assert.equal(hash(source), patch.afterSha256, 'clean installation must apply the committed fix');
assert.equal(patchedConverter(source, '0.2.8'), source);
const original = source.replace(patch.after, patch.before);
assert.equal(hash(original), patch.beforeSha256);
assert.equal(patchedConverter(original, '0.2.8'), source);
assert.throws(() => patchedConverter(original, '0.2.9'), /requires/);
assert.throws(() => patchedConverter(original + '\nunknown change', '0.2.8'), /SHA-256/);
const mtime = fs.statSync(file, { bigint: true }).mtimeNs;
assert.equal(applyLunarLiteFix().changed, false);
assert.equal(fs.statSync(file, { bigint: true }).mtimeNs, mtime, 'idempotent application must not rewrite dependency bytes');

const samples = [[1906,4],[1914,5],[1919,7],[1925,4],[1936,3],[1938,7],[1941,6],[1944,4],[1952,5],[1955,3],[2017,6],[2036,6],[2047,5],[2050,3]];
let charts = 0;
for (const [year, month] of samples) {
  const y = LunarYear.fromYear(year);
  assert.equal(y.getMonth(month).getDayCount(), 29);
  assert.equal(y.getMonth(-month).getDayCount(), 30);
  const solar = Lunar.fromYmd(year, -month, 30).getSolar();
  const converted = lunar2solar(`${year}-${month}-30`, true);
  assert.deepEqual([converted.solarYear,converted.solarMonth,converted.solarDay], [solar.getYear(),solar.getMonth(),solar.getDay()]);
  assert.throws(() => lunar2solar(`${year}-${month}-30`, false), /only 29 days/, 'the nonexistent regular day must stay invalid');
  assert.throws(() => lunar2solar(`${year}-${month}-31`, true));
  for (const gender of ['male','female']) for (let hour = 0; hour < 12; hour++) {
    const chart = generateChart({ year: solar.getYear(), month: solar.getMonth(), day: solar.getDay(), hour, gender, name: 'QA_ROUND6_SYNTHETIC' }, { leapMonth: 'origin-month' });
    assert.equal(chart.palaces.length, 12);
    assert.equal(chart.birthInfo.leapMonthPolicy, 'origin-month');
    assert.equal(chart.lunarInfo.isLeapMonth, true);
    charts++;
  }
}
const normal = lunar2solar('2024-1-1', false), ignoredFlag = lunar2solar('2024-1-1', true);
assert.deepEqual([normal.solarYear,normal.solarMonth,normal.solarDay], [ignoredFlag.solarYear,ignoredFlag.solarMonth,ignoredFlag.solarDay], 'non-leap-month flag remains ignored');
fs.mkdirSync('test-results', { recursive: true });
fs.writeFileSync(path.join('test-results','lunar-lite-fix.json'), JSON.stringify({ checkedAt: new Date().toISOString(), samples: samples.length, genderHourCharts: charts, status: 'PASS', patchHash: hash(source), invalidRegularDatesStillRejected: true, idempotenceNoWrite: true, unknownVersionAndHashRejected: true }, null, 2) + '\n');
console.log(`R4-01: ${samples.length} valid leap-day samples, ${charts} gender/hour charts, invalid dates and installation patch guards passed.`);
