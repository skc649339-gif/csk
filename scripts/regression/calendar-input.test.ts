import assert from 'node:assert/strict';
import { calendarInputToSolar, solarToCalendarInput } from '../../lib/ziwei/calendar-input';
import { lunarMonthDayCount, leapMonthOfLunarYear } from '../../lib/ziwei/lunar-solar';
import { formToBirthInfo } from '../../lib/ziwei/share';
import { generateChart } from '../../lib/ziwei/algorithm';
import type { BirthFormState } from '../../components/BirthForm';

assert.deepEqual(calendarInputToSolar(2024, 1, 1, 'lunar'), { year: 2024, month: 2, day: 10 });
assert.deepEqual(calendarInputToSolar(2023, 2, 1, 'lunar', true), { year: 2023, month: 3, day: 22 });
assert.deepEqual(solarToCalendarInput({ year: 2023, month: 3, day: 22 }, 'lunar'), { year: 2023, month: 2, day: 1, leapMonth: true });
assert.throws(() => calendarInputToSolar(2024, 2, 30, 'solar'), /公历日期不存在/);
assert.throws(() => calendarInputToSolar(2023, 2, 29, 'solar'), /公历日期不存在/);
assert.throws(() => calendarInputToSolar(2024, 2, 1, 'lunar', true), /农历日期不存在/);
assert.throws(() => calendarInputToSolar(1899, 1, 1, 'lunar'), /年份范围/);
assert.throws(() => calendarInputToSolar(2051, 2, 11, 'solar'), /日期范围/);
const shortMonth = Array.from({ length: 12 }, (_, index) => index + 1).find(month => lunarMonthDayCount(2024, month) === 29)!;
assert.ok(shortMonth);
assert.throws(() => calendarInputToSolar(2024, shortMonth, 30, 'lunar'), /农历日期不存在/, '小月不能静默改成29日');
for (const year of [1901, 1986, 1990, 2000, 2023, 2024, 2050]) {
  for (const month of [1, 6, 12]) {
    const date = { year, month, day: 15 };
    const lunar = solarToCalendarInput(date, 'lunar');
    assert.deepEqual(calendarInputToSolar(lunar.year, lunar.month, lunar.day, 'lunar', lunar.leapMonth), date);
  }
  const leap = leapMonthOfLunarYear(year);
  if (leap) {
    const day = lunarMonthDayCount(year, leap, true);
    const solar = calendarInputToSolar(year, leap, day, 'lunar', true);
    assert.deepEqual(solarToCalendarInput(solar, 'lunar'), { year, month: leap, day, leapMonth: true });
  }
}
const form: BirthFormState = { name: '', year: '2024', month: '2', day: '10', clockHour: '23', clockMinute: '30', unknownTime: false, province: '', city: '', longitude: 120, gender: 'female' };
const lunarDate = calendarInputToSolar(2024, 1, 1, 'lunar');
const viaLunar = formToBirthInfo({ ...form, year: String(lunarDate.year), month: String(lunarDate.month), day: String(lunarDate.day) });
const viaSolar = formToBirthInfo(form);
assert.deepEqual(viaLunar, viaSolar, '同一个出生日期，两种历法入口产生相同引擎输入，包括晚子时');
assert.deepEqual(generateChart(viaLunar), generateChart(viaSolar), '公农历输入对应命盘完全相同');
console.log('✅ 公农历输入：春节、闰月、小月拒绝、跨年往返、晚子时排盘一致均通过');
