import type { BirthInfo, ZiweiChart } from './types';
import { validateBirth, validateChart, validateRecord, sameBirth } from './record-validation';

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
function parseEnvelope(raw: string): { version: 1; records: unknown[] } {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('命盘数据不是有效 JSON，原数据已保留，请先备份再处理'); }
  if (!object(value) || value.version !== 1) throw new Error('命盘数据版本不受支持，原数据已保留');
  if (!Array.isArray(value.records)) throw new Error('命盘数据校验失败：记录列表应为数组，原数据已保留');
  if (value.exportedAt !== undefined && typeof value.exportedAt !== 'string') throw new Error('命盘数据校验失败：导出时间应为文字，原数据已保留');
  return { version: 1, records: value.records };
}
function decode(raw: string): Envelope {
  const value = parseEnvelope(raw);
  value.records.forEach((record, index) => validateRecord(record, `第 ${index + 1} 条记录`));
  const records = value.records as SavedRecord[];
  const ids = records.map(record => record.id);
  if (new Set(ids).size !== ids.length) throw new Error('命盘数据包含重复编号，原数据已保留');
  return { version: 1, records };
}
function storageOrThrow(storage?: RecordStorage): RecordStorage {
  if (storage) return storage;
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch { /* iOS private/restricted storage can throw on access. */ }
  throw new Error('此浏览器无法使用本地存储，请在 Safari 普通模式打开并允许网站数据');
}
function readRaw(storage: RecordStorage): string | null {
  try { return storage.getItem(RECORDS_KEY); } catch { throw new Error('无法读取本地命盘，请检查 Safari 网站数据权限'); }
}
function read(storage: RecordStorage): SavedRecord[] {
  const raw = readRaw(storage);
  return raw === null ? [] : decode(raw).records;
}

export interface RecordInspection { records: SavedRecord[]; recoveryMessage: string | null }
/** Read-only recovery view. Never rewrite, migrate, delete or silently repair stored bytes. */
export function inspectRecords(storage?: RecordStorage): RecordInspection {
  const raw = readRaw(storageOrThrow(storage));
  if (raw === null) return { records: [], recoveryMessage: null };
  try {
    const envelope = parseEnvelope(raw), candidates: SavedRecord[] = [], errors: string[] = [];
    envelope.records.forEach((record, index) => {
      try { validateRecord(record, `第 ${index + 1} 条记录`); candidates.push(record); }
      catch (error) { errors.push(error instanceof Error ? error.message : '记录格式异常'); }
    });
    const counts = new Map<string, number>();
    candidates.forEach(record => counts.set(record.id, (counts.get(record.id) || 0) + 1));
    const records = candidates.filter(record => counts.get(record.id) === 1);
    const invalid = envelope.records.length - records.length;
    return { records, recoveryMessage: invalid ? `有 ${invalid} 条记录暂时无法显示。${errors[0] || '命盘编号重复，原数据已保留'}。当前仅查看，请先导出原始数据。` : null };
  } catch (error) {
    return { records: [], recoveryMessage: `${error instanceof Error ? error.message : '本地数据格式异常'}。当前仅查看，请先导出原始数据。` };
  }
}
/** Exports the exact stored string, including damaged data, without requiring it to decode. */
export function exportRawRecords(storage?: RecordStorage): string {
  const raw = readRaw(storageOrThrow(storage));
  if (raw === null) throw new Error('没有本地命盘数据可导出');
  return raw;
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
  validateBirth(info, '出生信息'); validateChart(chart, '命盘');
  if (!sameBirth(info, chart.birthInfo)) throw new Error('命盘与出生信息不一致，未保存');
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
