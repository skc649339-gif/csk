import type { BirthInfo, ZiweiChart } from './types';

export const RECORDS_KEY = 'ziwei-personal-records-v1';
export interface SavedRecord {
  id: string;
  label: string;
  birthInfo: BirthInfo;
  chart: ZiweiChart;
  createdAt: number;
  updatedAt: number;
}
type RecordStorage = Pick<Storage, 'getItem' | 'setItem'>;
interface Envelope { version: 1; records: SavedRecord[] }

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function int(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}
function validBirth(value: unknown): value is BirthInfo {
  if (!object(value) || !int(value.year, 1899, 2051) || !int(value.month, 1, 12) || !int(value.day, 1, 31) ||
      !int(value.hour, 0, 11) || !['male', 'female'].includes(String(value.gender))) return false;
  const date = new Date(Date.UTC(value.year, value.month - 1, value.day));
  if (date.getUTCFullYear() !== value.year || date.getUTCMonth() + 1 !== value.month || date.getUTCDate() !== value.day) return false;
  for (const key of ['name', 'province', 'city']) if (value[key] !== undefined && typeof value[key] !== 'string') return false;
  if (value.longitude !== undefined && (typeof value.longitude !== 'number' || !Number.isFinite(value.longitude) || Math.abs(value.longitude) > 180)) return false;
  if (value.origInput !== undefined) {
    const orig = value.origInput;
    if (!object(orig) || !int(orig.year, 1900, 2050) || !int(orig.month, 1, 12) || !int(orig.day, 1, 31) ||
        !int(orig.clockHour, 0, 23) || !int(orig.clockMinute, 0, 59)) return false;
  }
  return true;
}
function sameBirth(a: BirthInfo, b: BirthInfo) {
  return a.year === b.year && a.month === b.month && a.day === b.day && a.hour === b.hour && a.gender === b.gender;
}
function validChart(value: unknown): value is ZiweiChart {
  if (!object(value) || !validBirth(value.birthInfo) || !object(value.lunarInfo) || !Array.isArray(value.palaces) ||
      value.palaces.length !== 12 || !Array.isArray(value.daXians) || typeof value.wuxingJuName !== 'string' ||
      !int(value.mingGongBranch, 0, 11) || !int(value.shenGongBranch, 0, 11) || !int(value.ziweiPos, 0, 11) ||
      !int(value.wuxingJu, 2, 6) || !int(value.currentDaXianIndex, -1, 11) ||
      typeof value.currentAge !== 'number' || !Number.isFinite(value.currentAge)) return false;
  const lunar = value.lunarInfo;
  if (!int(lunar.lunarYear, 1899, 2051) || !int(lunar.lunarMonth, -12, 12) || lunar.lunarMonth === 0 ||
      !int(lunar.lunarDay, 1, 30) || !int(lunar.yearStem, 0, 9) || !int(lunar.yearBranch, 0, 11) ||
      typeof lunar.isLeapMonth !== 'boolean') return false;
  const branches = new Set<number>();
  for (const palace of value.palaces) {
    if (!object(palace) || !int(palace.branch, 0, 11) || branches.has(palace.branch) || !int(palace.stem, 0, 9) ||
        typeof palace.name !== 'string' || !Array.isArray(palace.stars)) return false;
    branches.add(palace.branch);
    for (const star of palace.stars) {
      if (!object(star) || typeof star.name !== 'string' || !['major', 'minor', 'lucky', 'sha'].includes(String(star.type)) ||
          // iztro represents an untransformed star as '' in runtime output;
          // algorithm.ts uses a TypeScript assertion and deliberately keeps that marker.
          // Accept it when saving/restoring the untouched upstream chart snapshot.
          (star.siHua !== undefined && !['', '禄', '权', '科', '忌'].includes(String(star.siHua)))) return false;
    }
  }
  return value.daXians.every(dx => object(dx) && int(dx.startAge, 0, 200) && int(dx.endAge, 0, 200) &&
    int(dx.palaceBranch, 0, 11) && typeof dx.palaceName === 'string');
}
function validRecord(value: unknown): value is SavedRecord {
  return object(value) && typeof value.id === 'string' && value.id.length > 0 && typeof value.label === 'string' &&
    validBirth(value.birthInfo) && validChart(value.chart) && sameBirth(value.birthInfo, value.chart.birthInfo) &&
    typeof value.createdAt === 'number' && Number.isFinite(value.createdAt) && value.createdAt > 0 &&
    typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) && value.updatedAt >= value.createdAt;
}
function decode(raw: string): Envelope {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('命盘数据不是有效 JSON，原数据已保留，请先备份再处理'); }
  if (!object(value) || value.version !== 1) throw new Error('命盘数据版本不受支持，原数据已保留');
  if (!Array.isArray(value.records) || !value.records.every(validRecord)) throw new Error('命盘数据校验失败，原数据已保留');
  const ids = value.records.map(record => record.id);
  if (new Set(ids).size !== ids.length) throw new Error('命盘数据包含重复编号，原数据已保留');
  return { version: 1, records: value.records };
}
function storageOrThrow(storage?: RecordStorage): RecordStorage {
  if (storage) return storage;
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch { /* iOS private/restricted storage can throw on access. */ }
  throw new Error('此浏览器无法使用本地存储，请在 Safari 普通模式打开并允许网站数据');
}
function read(storage: RecordStorage): SavedRecord[] {
  let raw: string | null;
  try { raw = storage.getItem(RECORDS_KEY); } catch { throw new Error('无法读取本地命盘，请检查 Safari 网站数据权限'); }
  return raw === null ? [] : decode(raw).records;
}
function write(storage: RecordStorage, records: SavedRecord[]): void {
  const raw = JSON.stringify({ version: 1, records } satisfies Envelope);
  // localStorage.setItem is atomic: a quota failure leaves the previous value intact.
  try {
    storage.setItem(RECORDS_KEY, raw);
    if (storage.getItem(RECORDS_KEY) !== raw) throw new Error('write verification failed');
  } catch { throw new Error('保存失败：本地空间不足或网站数据被限制。请导出备份后重试，当前记录尚未确认保存'); }
}
function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
function uniqueId(records: SavedRecord[]) {
  let id = newId();
  while (records.some(record => record.id === id)) id = newId();
  return id;
}

/** Snapshot + original engine input; no network, silent eviction or deduplication. */
export function saveRecord(info: BirthInfo, chart: ZiweiChart, storage?: RecordStorage): SavedRecord {
  if (!validBirth(info) || !validChart(chart) || !sameBirth(info, chart.birthInfo)) throw new Error('命盘与出生信息不一致，未保存');
  const target = storageOrThrow(storage);
  const records = read(target);
  const now = Date.now();
  const record: SavedRecord = JSON.parse(JSON.stringify({
    id: uniqueId(records),
    label: [info.name || '未命名命盘', `${info.year}-${String(info.month).padStart(2, '0')}-${String(info.day).padStart(2, '0')}`,
      info.gender === 'male' ? '男' : '女', info.city || info.province || ''].filter(Boolean).join(' · '),
    birthInfo: info, chart, createdAt: now, updatedAt: now,
  }));
  write(target, [record, ...records]);
  return record;
}
export function listRecords(storage?: RecordStorage): SavedRecord[] {
  return read(storageOrThrow(storage));
}
export function deleteRecord(id: string, storage?: RecordStorage): void {
  const target = storageOrThrow(storage);
  const records = read(target);
  write(target, records.filter(record => record.id !== id));
}
export function exportRecords(storage?: RecordStorage): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), records: listRecords(storage) }, null, 2);
}
/** Import is one atomic append; new IDs preserve records even when the same backup is imported twice. */
export function importRecords(json: string, storage?: RecordStorage): number {
  if (json.length > 20 * 1024 * 1024) throw new Error('备份文件超过 20 MB，请拆分后导入');
  const incoming = decode(json).records;
  const target = storageOrThrow(storage);
  const records = read(target);
  for (const record of incoming) records.unshift({ ...record, id: uniqueId(records) });
  write(target, records);
  return incoming.length;
}
