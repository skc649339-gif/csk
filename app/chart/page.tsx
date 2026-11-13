'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import BirthForm from '@/components/BirthForm';
import ChartBoard from '@/components/ChartBoard';
import ChartSummary from '@/components/ChartSummary';
import InsightPanel from '@/components/InsightPanel';
import PlainLanguageReading, { ReadingPreview } from '@/components/PlainLanguageReading';
import StarDetailPanel from '@/components/StarDetailPanel';
import ChartRenderBoundary from '@/components/ChartRenderBoundary';
import { useTheme } from '@/components/ThemeProvider';
import { generateChart, setBrightnessSchool, type LunarMonthPolicy, type SchoolBrightnessKind } from '@/lib/ziwei/algorithm';
import { saveRecordCoordinated, inspectRecords, deleteRecordCoordinated, exportRecords, exportRawRecords, importRecordsCoordinated, RECORDS_KEY, CURRENT_RECORDS_KEY, type SavedRecord, type RecordWriteResult } from '@/lib/ziwei/records';
import type { BirthInfo, ZiweiChart, Palace, Star } from '@/lib/ziwei/types';
import { solarToCalendarInput } from '@/lib/ziwei/calendar-input';

const LEGACY_ACTIVE_KEY = 'ziwei-active-record-v1';
const ACTIVE_KEY = 'ziwei-active-record-v2';
function birthLunarLabel(chart: ZiweiChart): string {
  try {
    const date = chart.birthInfo.origInput || chart.birthInfo;
    const lunar = solarToCalendarInput(date, 'lunar');
    return `${lunar.year}年${lunar.leapMonth ? '闰' : ''}${lunar.month}月${lunar.day}日`;
  } catch { return '超出出生农历显示范围'; }
}

export default function ChartPage() {
  const { theme, toggle } = useTheme();
  const [tab, setTab] = useState<'chart' | 'reading' | 'records' | 'learn'>('chart');
  const [chart, setChart] = useState<ZiweiChart | null>(null);
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);
  const [star, setStar] = useState<Star | null>(null);
  const [records, setRecords] = useState<SavedRecord[]>([]);
  const [legacyIds, setLegacyIds] = useState<string[]>([]);
  const [storageIssue, setStorageIssue] = useState<string | null>(null);
  const [commitWarning, setCommitWarning] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [writing, setWriting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [brightness, setBrightness] = useState<SchoolBrightnessKind>('default');
  const [leapMonth, setLeapMonth] = useState<LunarMonthPolicy>('split');
  const detailRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const importInFlight = useRef(false);
  const writeInFlight = useRef(false);
  const needsVerification = useRef(false);

  useEffect(() => {
    try {
      const inspection = inspectRecords(), all = inspection.records;
      setRecords(all); setLegacyIds(inspection.legacyIds || []); setStorageIssue(inspection.recoveryMessage);
      if (inspection.recoveryMessage) setTab('records');
      const activeId = localStorage.getItem(ACTIVE_KEY) ?? localStorage.getItem(LEGACY_ACTIVE_KEY);
      const active = all.find(record => record.id === activeId);
      if (active) { setChart(active.chart); setSavedId(active.id); }
    } catch (e) { setError(e instanceof Error ? e.message : '无法读取本地命盘'); }
  }, []);
  useEffect(() => {
    const refresh = () => {
      try {
        const inspection = inspectRecords();
        setRecords(inspection.records); setLegacyIds(inspection.legacyIds || []); setStorageIssue(inspection.recoveryMessage);
        setSavedId(current => current && !inspection.records.some(record => record.id === current) ? null : current);
      } catch (e) { setError(e instanceof Error ? e.message : '其他窗口已更新记录，但当前无法重新读取，请先导出备份'); }
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key === RECORDS_KEY || event.key === CURRENT_RECORDS_KEY || event.key === null) refresh();
    };
    window.addEventListener('storage', storageChanged);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    return () => {
      window.removeEventListener('storage', storageChanged);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
    };
  }, []);
  function resetNotice() { setMessage(''); setError(''); }
  function changingChartBlocked() {
    if (!writeInFlight.current && !importInFlight.current) return false;
    setError('正在完成本地写入，请等待当前操作结束后再切换命盘。'); return true;
  }
  function writesBlocked() {
    if (storageIssue) { setError('本地有异常数据，当前仅查看；请先导出原始数据。'); return true; }
    if (needsVerification.current) { setError('上次写入已经提交，请先重新读取，不要重复导入或保存。'); return true; }
    if (importInFlight.current) { setError('正在读取备份，请等待当前操作完成，不要重复导入。'); return true; }
    if (writeInFlight.current) { setError('正在等待或完成安全写入，请不要重复保存、删除或导入。'); return true; }
    return false;
  }
  function acceptCommit(result: RecordWriteResult) {
    setRecords(result.records);
    setLegacyIds(result.legacyIds || []);
    needsVerification.current = result.verification === 'unverified';
    setCommitWarning(result.warning || null);
  }
  function resyncRecords() {
    if (changingChartBlocked()) return;
    resetNotice();
    try {
      const inspection = inspectRecords();
      setRecords(inspection.records); setLegacyIds(inspection.legacyIds || []); setStorageIssue(inspection.recoveryMessage);
      needsVerification.current = !!inspection.recoveryMessage;
      setCommitWarning(null);
      setMessage(inspection.recoveryMessage ? '已只读重新检查；异常原始内容仍保留，请先导出。' : '已重新读取已保存记录；之前的写入已经提交，无需再次导入。');
    } catch (e) { setError(`写入已经提交，但仍无法重新读取。请勿重复操作。${e instanceof Error ? e.message : ''}`); }
  }
  function generate(info: BirthInfo) {
    if (changingChartBlocked()) return;
    resetNotice();
    try {
      setBrightnessSchool(brightness);
      const result = generateChart(info, { leapMonth });
      setChart(result); setSavedId(null); setSelectedPalace(null); setStar(null);
      try { if (!storageIssue && !needsVerification.current) localStorage.setItem(ACTIVE_KEY, ''); } catch { /* 保存时再报告存储权限 */ }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { setError(e instanceof Error ? e.message : '排盘失败，请检查日期与时辰'); }
    finally { setBrightnessSchool('default'); }
  }
  async function save() {
    if (!chart) return;
    resetNotice();
    if (writesBlocked()) return;
    writeInFlight.current = true; setWriting(true);
    try {
      const result = await saveRecordCoordinated(chart.birthInfo, chart);
      acceptCommit(result); setSavedId(result.record.id);
      let notice = result.verification === 'verified' ? '已保存到这台设备，并已读回核验。重新打开后可在「我的命盘」查看。' : '保存操作已提交，但尚未完成读回核验；请先重新读取，不要重复保存。';
      if (result.verification === 'verified') {
        try { localStorage.setItem(ACTIVE_KEY, result.record.id); }
        catch { notice += ' 命盘已提交，但下次启动位置未能更新。'; }
      }
      setMessage(notice);
      try { void navigator.storage?.persist?.().catch(() => false); } catch { /* Commit does not depend on this optional request. */ }
    } catch (e) { setError(e instanceof Error ? e.message : '保存失败，请导出备份'); }
    finally { writeInFlight.current = false; setWriting(false); }
  }
  function openRecord(record: SavedRecord) {
    if (changingChartBlocked()) return;
    setChart(record.chart); setSavedId(record.id); setSelectedPalace(null); setStar(null); setTab('chart'); resetNotice();
    setMessage(`已打开保存于 ${new Date(record.updatedAt).toLocaleDateString('zh-CN')} 的命盘快照。年龄与当前大限按保存时显示；可查看全部大限与流年。`);
    try { if (!storageIssue && !needsVerification.current) localStorage.setItem(ACTIVE_KEY, record.id); } catch { setError('命盘已打开，但无法保存下次启动位置。'); }
  }
  async function remove(id: string) {
    resetNotice();
    if (writesBlocked()) return;
    writeInFlight.current = true; setWriting(true);
    try {
      const result = await deleteRecordCoordinated(id);
      acceptCommit(result); setDeleteId(null);
      let notice = result.verification === 'verified'
        ? (result.hiddenInV2 ? '已从新版列表移除这条旧命盘。旧版仍保留原记录。' : '已删除这条命盘记录，并已读回核验。')
        : '删除操作已提交，但尚未完成读回核验；请先重新读取，不要重复删除。';
      if (savedId === id) {
        setSavedId(null);
        if (result.verification === 'verified') {
          try { localStorage.setItem(ACTIVE_KEY, ''); }
          catch { notice += ' 删除已提交，但下次启动位置未能更新。'; }
        }
      }
      setMessage(notice);
    } catch (e) { setError(e instanceof Error ? e.message : '删除失败'); }
    finally { writeInFlight.current = false; setWriting(false); }
  }
  function backup(forceRaw = false) {
    resetNotice();
    try {
      const raw = forceRaw || !!storageIssue;
      const url = URL.createObjectURL(new Blob([raw ? exportRawRecords() : exportRecords()], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `紫微命盘${raw ? '原始数据' : '备份'}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage('已生成备份文件，请在 Safari 下载或分享菜单中存到「文件」。');
    } catch (e) { setError(e instanceof Error ? e.message : '导出失败'); }
  }
  async function restore(file?: File) {
    if (!file) return;
    resetNotice();
    if (writesBlocked()) return;
    importInFlight.current = true; writeInFlight.current = true; setImporting(true); setWriting(true);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('备份文件超过 20 MB，请检查文件。');
      const json = await file.text();
      const result = await importRecordsCoordinated(json);
      acceptCommit(result); setError('');
      setMessage(result.verification === 'verified' ? `已导入 ${result.count} 条记录并已读回核验，现有命盘保持保留。` : `导入操作已提交 ${result.count} 条，尚未完成读回核验；请先重新读取，不要再次导入。`);
    } catch (e) { setError(e instanceof Error ? e.message : '导入失败'); }
    finally {
      importInFlight.current = false; writeInFlight.current = false; setImporting(false); setWriting(false);
      if (uploadRef.current) uploadRef.current.value = '';
    }
  }
  return <main className="personal-app">
    <header className="app-header"><div><span className="app-eyebrow">个人命盘 · 本地珍藏</span><h1>紫微斗数<span className="app-seal" aria-hidden="true">紫</span></h1></div><button className="app-button quiet" onClick={toggle} aria-label={theme === 'dark' ? '切换浅色模式' : '切换深色模式'}>{theme === 'dark' ? '☀ 浅色' : '☾ 深色'}</button></header>
    <nav className="app-tabs" aria-label="主导航">{([['chart', '起盘看盘'], ['reading', '白话解读'], ['records', `我的命盘${records.length ? ` · ${records.length}` : ''}`], ['learn', '学习与帮助']] as const).map(([value, label]) => <button key={value} aria-current={tab === value ? 'page' : undefined} onClick={() => { setTab(value); resetNotice(); }}>{label}</button>)}</nav>
    {tab === 'reading' && (chart ? <ChartRenderBoundary key={`reading-${savedId || 'unsaved'}`} canExport={records.length > 0 || !!storageIssue} onExport={() => backup(true)} onReturn={() => setTab('records')}><PlainLanguageReading key={`${savedId || 'unsaved'}-${chart.birthInfo.year}-${chart.birthInfo.month}-${chart.birthInfo.day}-${chart.birthInfo.hour}`} chart={chart} onBack={() => setTab('chart')} /></ChartRenderBoundary> : <section className="app-empty"><h2>先打开一张命盘</h2><p>白话解读使用命盘实际数据，不需要再次输入出生资料。可新建命盘，或从「我的命盘」打开历史快照。</p><button type="button" className="app-button" onClick={() => setTab('chart')}>去起盘看盘</button></section>)}
    {error && <p role="alert" className="app-notice error" style={{ overflowWrap: 'anywhere' }}>{error}</p>}{message && <p role="status" className="app-notice">{message}</p>}
    {commitWarning && <section className="app-notice" aria-label="写入核验" role="status" style={{ overflowWrap: 'anywhere' }}>
      <h2>操作已提交，等待读回核验</h2><p>{commitWarning}</p>
      <button type="button" className="app-button quiet" onClick={resyncRecords}>重新读取已保存记录</button>
    </section>}
    {storageIssue && <section className="app-notice error" aria-label="本地数据恢复" style={{ overflowWrap: 'anywhere' }}>
      <h2>本地记录需要检查</h2><p>{storageIssue}</p>
      <p>原始数据未自动修改。下方正常记录仍可查看；保存、导入和删除暂时停用，以免覆盖异常内容。</p>
      <button type="button" className="app-button quiet" onClick={() => backup(true)}>导出原始数据</button>
    </section>}
    {tab === 'chart' && !chart && <section className="app-form-wrap"><div className="app-intro"><span className="app-eyebrow">一张命盘，从此刻开始</span><h2>输入生辰，安星立盘</h2><p>沿用原项目排盘引擎。出生资料只在本机处理，点击保存后留在这台设备。</p></div>
      <details className="app-settings"><summary>排盘口径</summary><div className="app-settings-fields"><label>星曜亮度<select value={brightness} onChange={e => setBrightness(e.target.value as SchoolBrightnessKind)}><option value="default">斗数全书（原项目默认）</option><option value="XD2">现代修正 v2</option><option value="QS">斗数全书 QS</option></select></label><label>闰月归属<select value={leapMonth} onChange={e => setLeapMonth(e.target.value as LunarMonthPolicy)}><option value="split">月中分界（默认）</option><option value="prev-month">归本月</option><option value="next-month">归下月</option><option value="origin-month">保留闰月</option></select></label><p>时辰及晚子时换日沿用原表单的经度校正口径。暂未接入均时差或海外时区；不详时辰只能生成参考盘。</p></div></details>
      <BirthForm onSubmit={generate} /></section>}
    {tab === 'chart' && chart && <ChartRenderBoundary key={savedId || 'unsaved'} canExport={records.length > 0 || !!storageIssue} onExport={() => backup(true)} onReturn={() => { setChart(null); setSelectedPalace(null); setStar(null); setTab('records'); resetNotice(); }}><section><div className="app-toolbar"><button className="app-button quiet" onClick={() => { if (changingChartBlocked()) return; setChart(null); setSelectedPalace(null); setSavedId(null); resetNotice(); try { if (!storageIssue && !needsVerification.current) localStorage.setItem(ACTIVE_KEY, ''); } catch {} }}>← 新建命盘</button><button className="app-button" onClick={save} disabled={!!storageIssue || !!commitWarning || importing || writing}>{savedId ? '另存为新记录' : '保存命盘'}</button></div>
      {savedId && <p className="app-notice">{commitWarning ? '待核验快照' : '已保存快照'} · {new Date(records.find(r => r.id === savedId)?.updatedAt || Date.now()).toLocaleDateString('zh-CN')}。年龄与当前大限为保存时的数据；全部大限与流年仍可切换。</p>}<div className="app-birth-caption"><strong>{chart.birthInfo.name || '未命名命盘'}</strong><span>{chart.birthInfo.gender === 'male' ? '男' : '女'} · {chart.birthInfo.city || chart.birthInfo.province || '未指定出生地'}</span>{chart.birthInfo.origInput && <span>出生钟表：{chart.birthInfo.origInput.year}-{chart.birthInfo.origInput.month}-{chart.birthInfo.origInput.day} {String(chart.birthInfo.origInput.clockHour).padStart(2, '0')}:{String(chart.birthInfo.origInput.clockMinute).padStart(2, '0')}（UTC+8）</span>}<span>出生农历：{birthLunarLabel(chart)}</span><span>排盘日：{chart.birthInfo.year}-{chart.birthInfo.month}-{chart.birthInfo.day} · {chart.wuxingJuName}</span></div>
      <ReadingPreview chart={chart} onOpen={() => { setTab('reading'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} /><div className="app-chart-layout"><div><p className="app-chart-hint">完整盘可横向滑动。点宫位看说明，点主星看释义。</p><div className="app-board-scroll"><ChartBoard key={`${chart.birthInfo.year}-${chart.birthInfo.month}-${chart.birthInfo.day}-${chart.birthInfo.hour}-${savedId}`} chart={chart} selectedPalaceBranch={selectedPalace?.branch ?? null} onPalaceSelect={p => { setSelectedPalace(p); setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }} onStarSelect={(s, p) => { setStar(s); setSelectedPalace(p); setTimeout(() => document.getElementById('star-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }} /></div><div className="app-palace-list" aria-label="十二宫快捷查看">{chart.palaces.map(p => <button key={p.branch} onClick={() => { setSelectedPalace(p); setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }}>{p.name}<small>{p.stars.filter(s => s.type === 'major').map(s => s.name).join(' · ') || '空宫'}</small></button>)}</div></div><div ref={detailRef} className="app-detail"><InsightPanel chart={chart} selectedPalace={selectedPalace} /><ChartSummary chart={chart} /></div></div><div id="star-details" className="app-star-details"><StarDetailPanel star={star} palaceName={selectedPalace?.name} onClose={() => setStar(null)} /></div></section></ChartRenderBoundary>}
    {tab === 'records' && <section className="app-library"><div className="app-section-heading"><div><span className="app-eyebrow">只保存在这台设备</span><h2>我的命盘</h2></div><span>{records.length} 份记录</span></div><p className="app-muted">建议先添加主屏幕，再在独立窗口保存。Safari 与主屏幕 App 的存储可能分开；定期导出备份可在本地转移记录。</p><div className="app-toolbar"><button className="app-button quiet" onClick={() => backup()}>{storageIssue ? '导出原始备份' : '导出本地备份'}</button><button className="app-button quiet" disabled={!!storageIssue || !!commitWarning || importing || writing} onClick={() => uploadRef.current?.click()}>导入备份</button><input ref={uploadRef} disabled={!!storageIssue || !!commitWarning || importing || writing} type="file" accept="application/json,.json" aria-label="导入命盘备份" className="sr-only" onChange={e => void restore(e.target.files?.[0])} /></div>{records.length === 0 && !storageIssue && <div className="app-empty"><span>✧</span><h3>还没有珍藏的命盘</h3><p>起盘后点击「保存命盘」，便可在这里再次打开。</p><button className="app-button" onClick={() => { if (changingChartBlocked()) return; setChart(null); setTab('chart'); }}>新建第一张命盘</button></div>}<div className="app-records">{records.map(record => <article key={record.id} className="app-record"><button className="app-record-open" onClick={() => openRecord(record)}><strong>{record.label}</strong><span>{new Date(record.updatedAt).toLocaleString('zh-CN')} 保存 · {record.chart.wuxingJuName}</span></button>{deleteId === record.id ? <div className="app-delete-confirm"><span>{legacyIds.includes(record.id) ? '只从新版列表移除这条旧命盘？旧版仍保留原记录。' : '删除这条记录？'}</span><button className="app-button danger" disabled={!!storageIssue || !!commitWarning || importing || writing} onClick={() => remove(record.id)}>确认删除</button><button className="app-button quiet" onClick={() => setDeleteId(null)}>取消</button></div> : <button className="app-button quiet" disabled={!!storageIssue || !!commitWarning || importing || writing} aria-label={`删除 ${record.label}`} onClick={() => setDeleteId(record.id)}>删除</button>}</article>)}</div></section>}
    {tab === 'learn' && <section className="app-help"><span className="app-eyebrow">由原典出发</span><h2>学习与使用</h2><div className="app-links"><Link href="/library/">古籍原典与全文检索 →</Link><Link href="/knowledge/">十四主星知识 →</Link><Link href="/heming/">双盘对照 →</Link><Link href="/preview/">原项目样本预览 →</Link></div><details open><summary>在 iPhone 安装</summary><p>用 Safari 打开部署后的 HTTPS 地址，点「分享」→「添加到主屏幕」→「添加」。如有「作为网页 App 打开」选项，请开启。返回主屏幕，点「紫微斗数」。</p></details><details><summary>离线使用与资料备份</summary><p>首次联网打开后，等页面底部显示核心缓存就绪。以后可在离线时排盘和读取本地记录；古籍章节需先访问。系统清理网站数据或删除 App 可能清除命盘，请定期导出 JSON 到「文件」。更新不会自动刷新正在输入的页面。</p></details><details><summary>本版保留与限制</summary><p>排盘、星曜、四化、格局及古籍沿用原项目。AI 解读、商业版断语库与服务器接口未在上游开源，本版新增本地规则白话解读，并保留星曜说明和古籍检索。白话解读使用实际命盘快照，提供依据和规则出处；完整流年推断尚未支持。双盘对照不提供 AI 评分；不生成新的未经验证算法。</p></details><p className="app-muted">本地说明为传统文化资料。倪师原话资料按上游 CC BY-NC-SA 4.0 标记；代码为 MIT，古籍为公版。详见交付的 LICENSE_AUDIT.md。</p></section>}
    <footer className="app-footer"><span>紫微斗数 · iPhone 自用版</span><Link href="/privacy/">本地隐私</Link><Link href="/terms/">来源与许可</Link></footer>
  </main>;
}
