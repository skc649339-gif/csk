import { Solar } from 'lunar-javascript';
import { lunarToSolar, LUNAR_YEAR_MIN, LUNAR_YEAR_MAX, type SolarDate } from './lunar-solar';
import { isRealSolarDate, isSupportedSolarDate, SOLAR_RANGE_LABEL } from './date-range';

export type CalendarKind = 'solar' | 'lunar';

/** Form-only adapter. All time, leap-month school and chart rules stay in the upstream engine. */
export function calendarInputToSolar(
  year: number, month: number, day: number, calendar: CalendarKind, leapMonth = false,
): SolarDate {
  if (![year, month, day].every(Number.isInteger)) throw new RangeError('出生日期必须为整数');
  if (calendar === 'lunar') {
    if (year < LUNAR_YEAR_MIN || year > LUNAR_YEAR_MAX) throw new RangeError(`农历出生年份范围为 ${LUNAR_YEAR_MIN}–${LUNAR_YEAR_MAX}`);
    const solar = lunarToSolar(year, month, day, leapMonth);
    if (!solar) throw new RangeError('这个农历日期不存在，请检查闰月和当月天数');
    return solar;
  }
  if (calendar !== 'solar') throw new RangeError('不支持的历法');
  if (!isRealSolarDate(year, month, day)) {
    throw new RangeError('这个公历日期不存在，请检查年月日');
  }
  if (!isSupportedSolarDate(year, month, day)) throw new RangeError(`公历出生日期范围为 ${SOLAR_RANGE_LABEL}`);
  return { year, month, day };
}

export function solarToCalendarInput(date: SolarDate, calendar: CalendarKind) {
  const solar = calendarInputToSolar(date.year, date.month, date.day, 'solar');
  if (calendar === 'solar') return { ...solar, leapMonth: false };
  if (calendar !== 'lunar') throw new RangeError('不支持的历法');
  const lunar = Solar.fromYmd(solar.year, solar.month, solar.day).getLunar();
  if (lunar.getYear() < LUNAR_YEAR_MIN || lunar.getYear() > LUNAR_YEAR_MAX) {
    throw new RangeError('换算结果超出支持的农历年份');
  }
  return { year: lunar.getYear(), month: Math.abs(lunar.getMonth()), day: lunar.getDay(), leapMonth: lunar.getMonth() < 0 };
}
