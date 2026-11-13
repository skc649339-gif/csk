import type { BirthInfo, ZiweiChart } from './types';
import { validateBirth, validateChart, validateRecord, sameBirth } from './record-validation';

export const RECORDS_KEY = 'ziwei-personal-records-v1';
export const CURRENT_RECORDS_KEY = 'ziwei-personal-records-v2';
export const RECORD_WRITE_LOCK = `${CURRENT_RECORDS_KEY}:write`;
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
interface CurrentEnvelope { version: 2; records: SavedRecord[]; hiddenLegacyIds: string[] }
const emptyCurrent = (): CurrentEnvelope => ({ version: 2, records: [], hiddenLegacyIds: [] });

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
function readRaw(storage: RecordStorage, key = RECORDS_KEY): string | null {
  try { return storage.getItem(key); } catch { throw new Error('无法读取本地命盘，请检查 Safari 网站数据权限'); }
}
function read(storage: RecordStorage): SavedRecord[] {
  const raw = readRaw(storage);
  return raw === null ? [] : decode(raw).records;
}

export interface RecordInspection { records: SavedRecord[]; recoveryMessage: string | null; legacyIds?: string[] }
/** Read-only recovery view. Never rewrite, migrate, delete or silently repair stored bytes. */
export function inspectRecords(storage?: RecordStorage): RecordInspection {
  const target = storageOrThrow(storage);
  if (!storage && typeof window !== 'undefined') return inspectBrowserRecords(target);
  return inspectLegacy(readRaw(target));
}

function inspectLegacy(raw: string | null): RecordInspection {
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
  const target = storageOrThrow(storage);
  const raw = readRaw(target);
  if (!storage && typeof window !== 'undefined') {
    const current = readRaw(target, CURRENT_RECORDS_KEY);
    if (current !== null && raw === null) return current;
    if (current !== null) return JSON.stringify({
      format: 'csk-local-records-recovery',
      values: { [RECORDS_KEY]: raw, [CURRENT_RECORDS_KEY]: current },
    }, null, 2);
  }
  if (raw === null) throw new Error('没有本地命盘数据可导出');
  return raw;
}
export interface RecordWriteResult {
  verification: 'verified' | 'unverified';
  /** Snapshot submitted by this operation; unverified reads never roll it back. */
  records: SavedRecord[];
  legacyIds?: string[];
  warning?: string;
}
function write(storage: RecordStorage, records: SavedRecord[]): RecordWriteResult {
  const raw = JSON.stringify({ version: 1, records } satisfies Envelope);
  // localStorage.setItem is atomic: a quota failure leaves the previous value intact.
  try {
    storage.setItem(RECORDS_KEY, raw);
  } catch { throw new Error('保存失败：本地空间不足或网站数据被限制，本次未写入，已有记录保持原样'); }
  // setItem returned successfully: the atomic commit already happened. A read
  // failure or a concurrent writer must not turn it into an "unsaved" error.
  try {
    if (storage.getItem(RECORDS_KEY) === raw) return { verification: 'verified', records };
  } catch { /* Preserve the committed snapshot; offer a read-only resync. */ }
  return {
    verification: 'unverified', records,
    warning: '写入已经提交，但读回暂未通过核验。列表显示本次提交的快照；请勿重复操作，先重新读取已保存记录。',
  };
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

function saveToStorage(info: BirthInfo, chart: ZiweiChart, target: RecordStorage): RecordWriteResult & { record: SavedRecord } {
  const records = read(target);
  const record = createRecord(info, chart, uniqueId(records));
  return { ...write(target, [record, ...records]), record };
}
function createRecord(info: BirthInfo, chart: ZiweiChart, id: string): SavedRecord {
  validateBirth(info, '出生信息'); validateChart(chart, '命盘');
  if (!sameBirth(info, chart.birthInfo)) throw new Error('命盘与出生信息不一致，未保存');
  const now = Date.now();
  return JSON.parse(JSON.stringify({
    id,
    label: [info.name || '未命名命盘', `${info.year}-${String(info.month).padStart(2, '0')}-${String(info.day).padStart(2, '0')}`,
      info.gender === 'male' ? '男' : '女', info.city || info.province || ''].filter(Boolean).join(' · '),
    birthInfo: info, chart, createdAt: now, updatedAt: now,
  }));
}
/** Synchronous writes are retained only for explicit non-browser storage adapters. */
function synchronousStorage(storage?: RecordStorage): RecordStorage {
  if (typeof window !== 'undefined') throw new Error('此页面不允许未协调的同步写入，请更新页面后使用安全保存、删除或导入；原记录未改动');
  if (!storage) throw new Error('同步写入需要显式的隔离存储；浏览器请使用安全写入入口');
  return storage;
}
/** Snapshot + original engine input; isolated non-browser adapter compatibility. */
export function saveRecordWithResult(info: BirthInfo, chart: ZiweiChart, storage?: RecordStorage): RecordWriteResult & { record: SavedRecord } {
  return saveToStorage(info, chart, synchronousStorage(storage));
}
/** Compatible scalar API: a completed commit is successful even if its readback is unavailable. */
export function saveRecord(info: BirthInfo, chart: ZiweiChart, storage?: RecordStorage): SavedRecord {
  return saveRecordWithResult(info, chart, storage).record;
}
export function listRecords(storage?: RecordStorage): SavedRecord[] {
  const target = storageOrThrow(storage);
  if (storage || typeof window === 'undefined') return read(target);
  const result = inspectBrowserRecords(target);
  if (result.recoveryMessage) throw new Error(result.recoveryMessage);
  return result.records;
}
export function deleteRecordWithResult(id: string, storage?: RecordStorage): RecordWriteResult {
  return deleteFromStorage(id, synchronousStorage(storage));
}
function deleteFromStorage(id: string, target: RecordStorage): RecordWriteResult {
  const records = read(target);
  return write(target, records.filter(record => record.id !== id));
}
export function deleteRecord(id: string, storage?: RecordStorage): void {
  deleteRecordWithResult(id, storage);
}
export function exportRecords(storage?: RecordStorage): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), records: listRecords(storage) }, null, 2);
}
/** Import is one atomic append; new IDs preserve records even when the same backup is imported twice. */
export function importRecordsWithResult(json: string, storage?: RecordStorage): RecordWriteResult & { count: number } {
  return importToStorage(json, synchronousStorage(storage));
}
function importToStorage(json: string, target: RecordStorage): RecordWriteResult & { count: number } {
  const incoming = parseBackup(json);
  const records = read(target);
  for (const record of incoming) records.unshift({ ...record, id: uniqueId(records) });
  return { ...write(target, records), count: incoming.length };
}
function parseBackup(json: string): SavedRecord[] {
  if (json.length > 20 * 1024 * 1024) throw new Error('备份文件超过 20 MB，请拆分后导入');
  return decode(json).records;
}
export function importRecords(json: string, storage?: RecordStorage): number {
  return importRecordsWithResult(json, storage).count;
}

function decodeCurrent(raw: string | null): CurrentEnvelope {
  if (raw === null) return emptyCurrent();
  const value: unknown = JSON.parse(raw);
  if (!object(value) || value.version !== 2 || !Array.isArray(value.hiddenLegacyIds)
    || value.hiddenLegacyIds.some(id => typeof id !== 'string' || !id)
    || new Set(value.hiddenLegacyIds).size !== value.hiddenLegacyIds.length) {
    throw new Error('新版命盘数据格式异常');
  }
  return {
    version: 2,
    records: decode(JSON.stringify({ version: 1, records: value.records })).records,
    hiddenLegacyIds: value.hiddenLegacyIds,
  };
}

function mergeRecords(current: CurrentEnvelope, legacy: RecordInspection): RecordInspection {
  const own = new Map(current.records.map(record => [record.id, record]));
  const hidden = new Set(current.hiddenLegacyIds);
  const visible = legacy.records.filter(record => !hidden.has(record.id));
  const conflict = visible.some(record => {
    const match = own.get(record.id);
    return match && JSON.stringify(match) !== JSON.stringify(record);
  });
  return {
    records: [...current.records, ...visible.filter(record => !own.has(record.id))],
    legacyIds: visible.map(record => record.id),
    recoveryMessage: legacy.recoveryMessage || (conflict ? '新旧存储有同编号、内容不同的命盘。当前仅查看；请导出两份原始数据。' : null),
  };
}

function inspectBrowserRecords(storage: RecordStorage): RecordInspection {
  let legacy: RecordInspection;
  try { legacy = inspectLegacy(readRaw(storage)); }
  catch { legacy = { records: [], recoveryMessage: '暂时无法读取旧版命盘，当前仅查看。请重新读取。' }; }
  // Do not resynchronize an unverified V2 commit against a partial view after a V2 read failure.
  const raw = readRaw(storage, CURRENT_RECORDS_KEY);
  let current: CurrentEnvelope;
  try { current = decodeCurrent(raw); }
  catch { return { ...mergeRecords(emptyCurrent(), legacy), recoveryMessage: '新版命盘数据格式异常，当前仅查看；请导出原始数据。' }; }
  return mergeRecords(current, legacy);
}

/** V1 remains a live source. Never snapshot it into V2 or write an updated list back to V1. */
function mutateCurrent<T>(storage: RecordStorage, mutate: (current: CurrentEnvelope, legacy: SavedRecord[]) => T): RecordWriteResult & T {
  const current = decodeCurrent(readRaw(storage, CURRENT_RECORDS_KEY));
  const legacy = inspectLegacy(readRaw(storage));
  const before = mergeRecords(current, legacy);
  if (before.recoveryMessage) throw new Error(before.recoveryMessage);
  const result = mutate(current, legacy.records);
  const submitted = mergeRecords(current, legacy);
  const raw = JSON.stringify(current);
  try { storage.setItem(CURRENT_RECORDS_KEY, raw); }
  catch { throw new Error('保存失败：本地空间不足或网站数据被限制，本次未写入，已有记录保持原样'); }

  try {
    if (storage.getItem(CURRENT_RECORDS_KEY) === raw) {
      // A legacy save can finish while the V2 lock is held. Refresh the read-only side after commit.
      const latest = mergeRecords(current, inspectLegacy(readRaw(storage)));
      if (!latest.recoveryMessage) return { ...result, ...latest, verification: 'verified' };
    }
  } catch { /* Retain the submitted view and require a fresh read. */ }
  return {
    ...result, ...submitted, verification: 'unverified',
    warning: '写入已经提交，但暂时无法核验完整列表。请先重新读取已保存记录，勿重复操作。',
  };
}

function currentId(current: CurrentEnvelope, legacy: SavedRecord[]): string {
  const used = new Set([...legacy.map(record => record.id), ...current.records.map(record => record.id), ...current.hiddenLegacyIds]);
  let id: string;
  do { id = `v2-${newId()}`; } while (used.has(id));
  return id;
}

/** No fallback to advisory storage locks. The browser releases the lock on completion or document termination. */
async function coordinatedWrite<T>(operation: (storage: RecordStorage) => T): Promise<T> {
  let manager: LockManager | undefined;
  try {
    if (typeof window !== 'undefined' && window.isSecureContext && typeof navigator !== 'undefined'
      && typeof AbortController !== 'undefined' && typeof navigator.locks?.request === 'function') manager = navigator.locks;
  } catch { /* A restricted context may reject even access to the lock manager. */ }
  if (!manager) {
    throw new Error('当前浏览器无法提供安全的跨页面保存，已停用保存、删除和导入；仍可查看与导出。请使用支持 Web Locks 的新版 Safari，并通过 HTTPS 打开');
  }
  const controller = new AbortController();
  let entered = false;
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await manager.request(RECORD_WRITE_LOCK, { mode: 'exclusive', signal: controller.signal }, lock => {
      if (!lock) throw new Error('未获得安全写入锁，本次未写入');
      entered = true;
      clearTimeout(timeout);
      // No await between the fresh read, transformation, commit and verification.
      return operation(storageOrThrow());
    });
  } catch (error) {
    if (entered) throw error;
    throw new Error(controller.signal.aborted
      ? '等待安全写入超时，本次未写入；请确认其他窗口已完成操作后再试，原记录未改动'
      : '无法取得安全写入权限，本次未写入；仍可查看与导出，请使用支持 Web Locks 的新版浏览器');
  } finally { clearTimeout(timeout); }
}

export async function saveRecordCoordinated(info: BirthInfo, chart: ZiweiChart): Promise<RecordWriteResult & { record: SavedRecord }> {
  // Capture caller input before waiting so a later form change cannot alter the queued operation.
  const snapshot = JSON.parse(JSON.stringify({ info, chart })) as { info: BirthInfo; chart: ZiweiChart };
  return coordinatedWrite(storage => mutateCurrent(storage, (current, legacy) => {
    const record = createRecord(snapshot.info, snapshot.chart, currentId(current, legacy));
    current.records.unshift(record);
    return { record };
  }));
}
export async function deleteRecordCoordinated(id: string): Promise<RecordWriteResult & { hiddenInV2: boolean }> {
  if (typeof id !== 'string' || !id) throw new Error('请选择需要删除的记录，本次未写入');
  return coordinatedWrite(storage => mutateCurrent(storage, (current, legacy) => {
    const hiddenInV2 = legacy.some(record => record.id === id) || current.hiddenLegacyIds.includes(id);
    current.records = current.records.filter(record => record.id !== id);
    if (hiddenInV2 && !current.hiddenLegacyIds.includes(id)) current.hiddenLegacyIds.push(id);
    return { hiddenInV2 };
  }));
}
export async function importRecordsCoordinated(json: string): Promise<RecordWriteResult & { count: number }> {
  const incoming = parseBackup(json);
  return coordinatedWrite(storage => mutateCurrent(storage, (current, legacy) => {
    // Imports remain copies, even if the same portable backup is imported twice.
    for (const record of incoming) current.records.unshift({ ...record, id: currentId(current, legacy) });
    return { count: incoming.length };
  }));
}
