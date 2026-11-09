import { LUNAR_YEAR_MIN, LUNAR_YEAR_MAX, lunarMonthDayCount, lunarToSolar, type SolarDate } from './lunar-solar';

export const SOLAR_INPUT_MIN: SolarDate = { year: LUNAR_YEAR_MIN, month: 1, day: 1 };
const lastDay = lunarMonthDayCount(LUNAR_YEAR_MAX, 12);
const lastSolar = lunarToSolar(LUNAR_YEAR_MAX, 12, lastDay);
if (!lastSolar) throw new Error('无法确定已支持农历年份的公历边界');
// This endpoint is derived from lunar 2050-12-29, not the whole Gregorian year 2051.
export const SOLAR_INPUT_MAX: SolarDate = lastSolar;
const dayValue = ({ year, month, day }: SolarDate) => Date.UTC(year, month - 1, day);

export function isRealSolarDate(year: number, month: number, day: number): boolean {
  if (![year, month, day].every(Number.isInteger)) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

/** Original clock dates use the exact input range; normalized chart dates may shift by one day. */
export function isSupportedSolarDate(year: number, month: number, day: number, normalized = false): boolean {
  if (!isRealSolarDate(year, month, day)) return false;
  const value = Date.UTC(year, month - 1, day);
  // Existing longitude correction (-180..180 degrees, UTC+8) and late-zi rules shift at most one day.
  const padding = normalized ? 86_400_000 : 0;
  return value >= dayValue(SOLAR_INPUT_MIN) - padding && value <= dayValue(SOLAR_INPUT_MAX) + padding;
}

export const SOLAR_RANGE_LABEL = `${SOLAR_INPUT_MIN.year}-01-01 至 ${SOLAR_INPUT_MAX.year}-${String(SOLAR_INPUT_MAX.month).padStart(2, '0')}-${String(SOLAR_INPUT_MAX.day).padStart(2, '0')}`;
