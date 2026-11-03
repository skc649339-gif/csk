import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { generateChart } from '../../lib/ziwei/algorithm';
import ChartBoard from '../../components/ChartBoard';
import TimeNav from '../../components/TimeNav';
import { SI_HUA_TABLE, STEMS } from '../../lib/ziwei/constants';

const chart = generateChart({ year: 1990, month: 1, day: 1, hour: 4, gender: 'male' });
const board = renderToStaticMarkup(React.createElement(ChartBoard, { chart }));
assert.equal((board.match(/>本命<\/button>/g) || []).length, 1, 'one functional navigation on chart board');
assert.equal((board.match(/aria-label="查看[^\"]+宫位"/g) || []).length, 12, 'all twelve palaces remain interactive');
const index = chart.currentDaXianIndex === 1 ? 2 : 1;
const dx = chart.daXians[index];
const palace = chart.palaces.find(p => p.branch === dx.palaceBranch)!;
const daxian = renderToStaticMarkup(React.createElement(TimeNav, {
  chart, view: 'daxian', liunianYear: 2026, daXianIndex: index,
  onDaXianChange() {}, onViewChange() {}, onYearChange() {},
}));
assert.ok(daxian.includes(`大限 ${dx.startAge}–${dx.endAge}`), 'chosen rather than current period displayed');
assert.ok(daxian.includes(STEMS[palace.stem]), 'chosen palace stem shown');
for (const name of SI_HUA_TABLE[palace.stem]) assert.ok(daxian.includes(name), `chosen period sihua ${name}`);
const liunian = renderToStaticMarkup(React.createElement(TimeNav, {
  chart, view: 'liunian', liunianYear: 2030, onViewChange() {}, onYearChange() {},
}));
assert.ok(liunian.includes('2030'));
for (const name of SI_HUA_TABLE[6]) assert.ok(liunian.includes(name), `2030 sihua ${name}`);
console.log('Navigation regression passed: single navigation, twelve palaces, selected period and annual sihua.');
