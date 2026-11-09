import type { BirthInfo, ZiweiChart } from './types';
import type { SavedRecord } from './records';
import { isSupportedSolarDate, SOLAR_INPUT_MIN, SOLAR_INPUT_MAX } from './date-range';

function fail(path: string, reason: string): never {
  throw new Error(`命盘数据校验失败：${path}${reason}；原数据已保留`);
}
function object(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, '应为对象');
}
function text(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string') fail(path, '应为文字');
}
function number(value: unknown, path: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, '应为有限数值');
}
function integer(value: unknown, min: number, max: number, path: string): asserts value is number {
  number(value, path);
  if (!Number.isInteger(value) || value < min || value > max) fail(path, `应为 ${min}–${max} 的整数`);
}
function boolean(value: unknown, path: string) {
  if (typeof value !== 'boolean') fail(path, '应为是/否值');
}
function choice(values: readonly string[]) {
  return (value: unknown, path: string) => {
    if (typeof value !== 'string' || !values.includes(value)) fail(path, `应为 ${values.map(v => v || '空四化标记').join('、')}`);
  };
}
type Rule = (value: unknown, path: string) => void;
function optional(value: Record<string, unknown>, key: string, rule: Rule, path: string) {
  // Omitted fields remain compatible with old v1 snapshots. Explicit null has no valid typed meaning.
  if (value[key] !== undefined) rule(value[key], `${path}.${key}`);
}
function array(value: unknown, path: string, rule: Rule, length?: number): asserts value is unknown[] {
  if (!Array.isArray(value)) fail(path, '应为数组');
  if (length !== undefined && value.length !== length) fail(path, `应包含 ${length} 项`);
  for (let index = 0; index < value.length; index++) rule(value[index], `${path}[${index}]`);
}
const branch: Rule = (value, path) => integer(value, 0, 11, path);
const stem: Rule = (value, path) => integer(value, 0, 9, path);
const age: Rule = (value, path) => integer(value, 0, 200, path);
const siHua = choice(['禄', '权', '科', '忌']);
const starSiHua = choice(['', '禄', '权', '科', '忌']);
const pillars: Rule = (value, path) => array(value, path, text, 4);
const ages: Rule = (value, path) => {
  array(value, path, age, 2);
  if ((value[0] as number) > (value[1] as number)) fail(path, '年龄顺序错误');
};
function date(value: Record<string, unknown>, path: string, normalized: boolean) {
  integer(value.year, SOLAR_INPUT_MIN.year - 1, SOLAR_INPUT_MAX.year, `${path}.year`);
  integer(value.month, 1, 12, `${path}.month`);
  integer(value.day, 1, 31, `${path}.day`);
  if (!isSupportedSolarDate(value.year, value.month, value.day, normalized)) fail(path, '日期不存在或超出支持范围');
}

export function validateBirth(value: unknown, path: string): asserts value is BirthInfo {
  object(value, path); date(value, path, true);
  branch(value.hour, `${path}.hour`);
  choice(['male', 'female'])(value.gender, `${path}.gender`);
  for (const key of ['name', 'province', 'city']) optional(value, key, text, path);
  optional(value, 'longitude', (v, p) => { number(v, p); if (Math.abs(v) > 180) fail(p, '超出经度范围'); }, path);
  optional(value, 'leapMonthPolicy', choice(['split', 'prev-month', 'next-month', 'origin-month']), path);
  optional(value, 'origInput', (orig, p) => {
    object(orig, p); date(orig, p, false);
    integer(orig.clockHour, 0, 23, `${p}.clockHour`);
    integer(orig.clockMinute, 0, 59, `${p}.clockMinute`);
  }, path);
}
function star(value: unknown, path: string) {
  object(value, path); text(value.name, `${path}.name`);
  choice(['major', 'minor', 'lucky', 'sha'])(value.type, `${path}.type`);
  optional(value, 'siHua', starSiHua, path); // Untouched iztro snapshots may contain ''.
  optional(value, 'brightness', choice(['bright', 'normal', 'dim']), path);
  optional(value, 'brightnessRaw', choice(['庙', '旺', '得', '利', '平', '不', '闲', '陷', '地']), path);
}
function palace(value: unknown, path: string) {
  object(value, path); branch(value.branch, `${path}.branch`); stem(value.stem, `${path}.stem`);
  text(value.name, `${path}.name`); array(value.stars, `${path}.星曜`, star);
  optional(value, 'daXianAge', ages, path);
  for (const key of ['isCurrentDaXian', 'isMingGong', 'isShenGong', 'isEmpty']) optional(value, key, boolean, path);
  optional(value, 'selfSihua', (v, p) => array(v, p, (mark, mp) => {
    object(mark, mp); siHua(mark.siHua, `${mp}.siHua`); text(mark.starName, `${mp}.starName`);
  }), path);
  for (const key of ['oppositeBranch', 'borrowedFromBranch']) optional(value, key, branch, path);
  optional(value, 'borrowedFromName', text, path);
  optional(value, 'borrowedStars', (v, p) => array(v, p, text), path);
}
function daXian(value: unknown, path: string) {
  object(value, path); age(value.startAge, `${path}.startAge`); age(value.endAge, `${path}.endAge`);
  if ((value.startAge as number) > (value.endAge as number)) fail(path, '年龄顺序错误');
  branch(value.palaceBranch, `${path}.palaceBranch`); text(value.palaceName, `${path}.palaceName`);
  optional(value, 'stemIndex', stem, path); optional(value, 'stemName', text, path);
  optional(value, 'siHua', (v, p) => {
    object(v, p); stem(v.stemIndex, `${p}.stemIndex`);
    for (const key of ['stemName', 'lu', 'quan', 'ke', 'ji']) text(v[key], `${p}.${key}`);
  }, path);
}
export function sameBirth(a: BirthInfo, b: BirthInfo) {
  return a.year === b.year && a.month === b.month && a.day === b.day && a.hour === b.hour && a.gender === b.gender;
}
export function validateChart(value: unknown, path: string): asserts value is ZiweiChart {
  object(value, path); validateBirth(value.birthInfo, `${path}.出生信息`);
  object(value.lunarInfo, `${path}.农历`);
  const lunar = value.lunarInfo, lp = `${path}.农历`;
  integer(lunar.lunarYear, SOLAR_INPUT_MIN.year - 1, SOLAR_INPUT_MAX.year, `${lp}.lunarYear`);
  integer(lunar.lunarMonth, -12, 12, `${lp}.lunarMonth`);
  if (lunar.lunarMonth === 0) fail(lp, '农历月份不能为零');
  integer(lunar.lunarDay, 1, 30, `${lp}.lunarDay`); stem(lunar.yearStem, `${lp}.yearStem`);
  branch(lunar.yearBranch, `${lp}.yearBranch`); boolean(lunar.isLeapMonth, `${lp}.isLeapMonth`);
  optional(lunar, 'fourPillars', pillars, lp); optional(lunar, 'fourPillarsLunar', pillars, lp);
  for (const key of ['mingGongBranch', 'shenGongBranch', 'ziweiPos']) branch(value[key], `${path}.${key}`);
  integer(value.wuxingJu, 2, 6, `${path}.wuxingJu`); text(value.wuxingJuName, `${path}.wuxingJuName`);
  number(value.currentAge, `${path}.currentAge`); integer(value.currentDaXianIndex, -1, 11, `${path}.currentDaXianIndex`);
  array(value.palaces, `${path}.宫位`, palace, 12);
  const branches = value.palaces.map(p => (p as Record<string, unknown>).branch);
  if (new Set(branches).size !== 12) fail(path, '宫位地支重复');
  array(value.daXians, `${path}.大限`, daXian, 12);
  const dxBranches = value.daXians.map(dx => (dx as Record<string, unknown>).palaceBranch);
  if (new Set(dxBranches).size !== 12) fail(path, '大限宫位重复');
  for (const key of ['analysisCacheProfile', 'mingZhu', 'shenZhu', 'yinYangGender']) optional(value, key, text, path);
}
export function validateRecord(value: unknown, path: string): asserts value is SavedRecord {
  object(value, path); text(value.id, `${path}.id`); if (!value.id) fail(path, '编号不能为空');
  text(value.label, `${path}.label`); validateBirth(value.birthInfo, `${path}.出生信息`);
  validateChart(value.chart, `${path}.命盘`);
  if (!sameBirth(value.birthInfo, value.chart.birthInfo)) fail(path, '命盘与出生信息不一致');
  for (const key of ['createdAt', 'updatedAt']) {
    const timestamp = value[key];
    number(timestamp, `${path}.${key}`);
    if (timestamp <= 0 || !Number.isFinite(new Date(timestamp).getTime())) fail(`${path}.${key}`, '时间无效');
  }
  if ((value.updatedAt as number) < (value.createdAt as number)) fail(path, '更新时间早于创建时间');
}
