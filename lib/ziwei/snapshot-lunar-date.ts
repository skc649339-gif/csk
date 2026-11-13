import { Lunar, LunarMonth } from 'lunar-javascript';
import { LUNAR_YEAR_MIN, LUNAR_YEAR_MAX, lunarMonthDayCount } from './lunar-solar';
import { isSupportedSolarDate } from './date-range';

/** Validate a stored effective lunar date, without recomputing or changing a chart. */
export function isValidSnapshotLunarDate(year: number, signedMonth: number, day: number, leap: boolean): boolean {
  if (![year, signedMonth, day].every(Number.isInteger) || typeof leap !== 'boolean') return false;
  const month = Math.abs(signedMonth);
  if (month < 1 || month > 12 || day < 1 || day > 30 || (signedMonth < 0 && !leap)) return false;
  if (year < LUNAR_YEAR_MIN - 1 || year > LUNAR_YEAR_MAX + 1) return false;
  try {
    if (year >= LUNAR_YEAR_MIN && year <= LUNAR_YEAR_MAX) {
      return day <= lunarMonthDayCount(year, month, leap);
    }
    // The input range is unchanged. Its Gregorian/late-zi edges can produce a
    // genuine 1899 or 2051 lunar snapshot; allow only dates reachable there.
    const count = LunarMonth.fromYm(year, leap ? -month : month)?.getDayCount();
    if (!count || day > count) return false;
    const solar = Lunar.fromYmd(year, leap ? -month : month, day).getSolar();
    return isSupportedSolarDate(solar.getYear(), solar.getMonth(), solar.getDay(), true);
  } catch { return false; }
}
