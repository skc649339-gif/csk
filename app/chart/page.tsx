'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import BirthForm from '@/components/BirthForm';
import ChartBoard from '@/components/ChartBoard';
import ChartSummary from '@/components/ChartSummary';
import InsightPanel from '@/components/InsightPanel';
import StarDetailPanel from '@/components/StarDetailPanel';
import { useTheme } from '@/components/ThemeProvider';
import { generateChart, setBrightnessSchool, type LunarMonthPolicy, type SchoolBrightnessKind } from '@/lib/ziwei/algorithm';
import { saveRecord, listRecords, deleteRecord, exportRecords, importRecords, type SavedRecord } from '@/lib/ziwei/records';
import type { BirthInfo, ZiweiChart, Palace, Star } from '@/lib/ziwei/types';
import { solarToCalendarInput } from '@/lib/ziwei/calendar-input';

const ACTIVE_KEY = 'ziwei-active-record-v1';
function birthLunarLabel(chart: ZiweiChart): string {
  try {
    const date = chart.birthInfo.origInput || chart.birthInfo;
    const lunar = solarToCalendarInput(date, 'lunar');
    return `${lunar.year}年${lunar.leapMonth ? '闰' : ''}${lunar.month}月${lunar.day}日`;
  } catch { return '超出出生农历显示范围'; }
}

export default function ChartPage() {
  const { theme, toggle } = useTheme();
  const [tab, setTab] = useState<'chart' | 'records' | 'learn'>('chart');
  const [chart, setChart] = useState<ZiweiChart | null>(null);
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);
  const [star, setStar] = useState<Star | null>(null);
  const [records, setRecords] = useState<SavedRecord[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [brightness, setBrightness] = useState<SchoolBrightnessKind>('default');
  const [leapMonth, setLeapMonth] = useState<LunarMonthPolicy>('split');
  const detailRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const all = listRecords(); setRecords(all);
      const active = all.find(record => record.id === localStorage.getItem(ACTIVE_KEY));
      if (active) { setChart(active.chart); setSavedId(active.id); }
    } catch (e) { setError(e instanceof Error ? e.message : '无法读取本地命盘'); }
  }, []);
  function resetNotice() { setMessage(''); setError(''); }
  function generate(info: BirthInfo) {
    resetNotice();
    try {
      setBrightnessSchool(brightness);
      const result = generateChart(info, { leapMonth });
      setChart(result); setSavedId(null); setSelectedPalace(null); setStar(null);
      try { localStorage.removeItem(ACTIVE_KEY); } catch { /* 保存时再报告存储权限 */ }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { setError(e instanceof Error ? e.message : '排盘失败，请检查日期与时辰'); }
    finally { setBrightnessSchool('default'); }
  }
  function save() {
    if (!chart) return;
    resetNotice();
    try {
      const record = saveRecord(chart.birthInfo, chart);
      setRecords(listRecords()); setSavedId(record.id);
      localStorage.setItem(ACTIVE_KEY, record.id);
      setMessage('已保存到这台设备。重新打开后可在「我的命盘」查看。');
      void navigator.storage?.persist?.().catch(() => false);
    } catch (e) { setError(e instanceof Error ? e.message : '保存失败，请导出备份'); }
  }
  function openRecord(record: SavedRecord) {
    setChart(record.chart); setSavedId(record.id); setSelectedPalace(null); setStar(null); setTab('chart'); resetNotice();
    setMessage(`已打开保存于 ${new Date(record.updatedAt).toLocaleDateString('zh-CN')} 的命盘快照。年龄与当前大限按保存时显示；可查看全部大限与流年。`);
    try { localStorage.setItem(ACTIVE_KEY, record.id); } catch { setError('命盘已打开，但无法保存下次启动位置。'); }
  }
  function remove(id: string) {
    resetNotice();
    try {
      deleteRecord(id); setRecords(listRecords()); setDeleteId(null);
      if (savedId === id) { setSavedId(null); localStorage.removeItem(ACTIVE_KEY); }
      setMessage('已删除这条命盘记录。');
    } catch (e) { setError(e instanceof Error ? e.message : '删除失败'); }
  }
  function backup() {
    resetNotice();
    try {
      const url = URL.createObjectURL(new Blob([exportRecords()], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `紫微命盘备份-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage('已生成备份文件，请在 Safari 下载或分享菜单中存到「文件」。');
    } catch (e) { setError(e instanceof Error ? e.message : '导出失败'); }
  }
  async function restore(file?: File) {
    if (!file) return;
    resetNotice();
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('备份文件超过 20 MB，请检查文件。');
      const count = importRecords(await file.text()); setRecords(listRecords());
      setMessage(`已导入 ${count} 条记录，现有命盘保持保留。`);
    } catch (e) { setError(e instanceof Error ? e.message : '导入失败'); }
    if (uploadRef.current) uploadRef.current.value = '';
  }
  return <main className="personal-app">
    <header className="app-header"><div><span className="app-eyebrow">个人命盘 · 本地珍藏</span><h1>紫微斗数<span className="app-seal" aria-hidden="true">紫</span></h1></div><button className="app-button quiet" onClick={toggle} aria-label={theme === 'dark' ? '切换浅色模式' : '切换深色模式'}>{theme === 'dark' ? '☀ 浅色' : '☾ 深色'}</button></header>
    <nav className="app-tabs" aria-label="主导航">{([['chart', '起盘看盘'], ['records', `我的命盘${records.length ? ` · ${records.length}` : ''}`], ['learn', '学习与帮助']] as const).map(([value, label]) => <button key={value} aria-current={tab === value ? 'page' : undefined} onClick={() => { setTab(value); resetNotice(); }}>{label}</button>)}</nav>
    {error && <p role="alert" className="app-notice error">{error}</p>}{message && <p role="status" className="app-notice">{message}</p>}
    {tab === 'chart' && !chart && <section className="app-form-wrap"><div className="app-intro"><span className="app-eyebrow">一张命盘，从此刻开始</span><h2>输入生辰，安星立盘</h2><p>沿用原项目排盘引擎。出生资料只在本机处理，点击保存后留在这台设备。</p></div>
      <details className="app-settings"><summary>排盘口径</summary><div className="app-settings-fields"><label>星曜亮度<select value={brightness} onChange={e => setBrightness(e.target.value as SchoolBrightnessKind)}><option value="default">斗数全书（原项目默认）</option><option value="XD2">现代修正 v2</option><option value="QS">斗数全书 QS</option></select></label><label>闰月归属<select value={leapMonth} onChange={e => setLeapMonth(e.target.value as LunarMonthPolicy)}><option value="split">月中分界（默认）</option><option value="prev-month">归本月</option><option value="next-month">归下月</option><option value="origin-month">保留闰月</option></select></label><p>时辰及晚子时换日沿用原表单的经度校正口径。暂未接入均时差或海外时区；不详时辰只能生成参考盘。</p></div></details>
      <BirthForm onSubmit={generate} /></section>}
    {tab === 'chart' && chart && <section><div className="app-toolbar"><button className="app-button quiet" onClick={() => { setChart(null); setSelectedPalace(null); setSavedId(null); resetNotice(); try { localStorage.removeItem(ACTIVE_KEY); } catch {} }}>← 新建命盘</button><button className="app-button" onClick={save}>{savedId ? '另存为新记录' : '保存命盘'}</button></div>
      {savedId && <p className="app-notice">已保存快照 · {new Date(records.find(r => r.id === savedId)?.updatedAt || Date.now()).toLocaleDateString('zh-CN')}。年龄与当前大限为保存时的数据；全部大限与流年仍可切换。</p>}<div className="app-birth-caption"><strong>{chart.birthInfo.name || '未命名命盘'}</strong><span>{chart.birthInfo.gender === 'male' ? '男' : '女'} · {chart.birthInfo.city || chart.birthInfo.province || '未指定出生地'}</span>{chart.birthInfo.origInput && <span>出生钟表：{chart.birthInfo.origInput.year}-{chart.birthInfo.origInput.month}-{chart.birthInfo.origInput.day} {String(chart.birthInfo.origInput.clockHour).padStart(2, '0')}:{String(chart.birthInfo.origInput.clockMinute).padStart(2, '0')}（UTC+8）</span>}<span>出生农历：{birthLunarLabel(chart)}</span><span>排盘日：{chart.birthInfo.year}-{chart.birthInfo.month}-{chart.birthInfo.day} · {chart.wuxingJuName}</span></div>
      <div className="app-chart-layout"><div><p className="app-chart-hint">完整盘可横向滑动。点宫位看说明，点主星看释义。</p><div className="app-board-scroll"><ChartBoard key={`${chart.birthInfo.year}-${chart.birthInfo.month}-${chart.birthInfo.day}-${chart.birthInfo.hour}-${savedId}`} chart={chart} selectedPalaceBranch={selectedPalace?.branch ?? null} onPalaceSelect={p => { setSelectedPalace(p); setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }} onStarSelect={(s, p) => { setStar(s); setSelectedPalace(p); setTimeout(() => document.getElementById('star-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }} /></div><div className="app-palace-list" aria-label="十二宫快捷查看">{chart.palaces.map(p => <button key={p.branch} onClick={() => { setSelectedPalace(p); setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }}>{p.name}<small>{p.stars.filter(s => s.type === 'major').map(s => s.name).join(' · ') || '空宫'}</small></button>)}</div></div><div ref={detailRef} className="app-detail"><InsightPanel chart={chart} selectedPalace={selectedPalace} /><ChartSummary chart={chart} /></div></div><div id="star-details" className="app-star-details"><StarDetailPanel star={star} palaceName={selectedPalace?.name} onClose={() => setStar(null)} /></div></section>}
    {tab === 'records' && <section className="app-library"><div className="app-section-heading"><div><span className="app-eyebrow">只保存在这台设备</span><h2>我的命盘</h2></div><span>{records.length} 份记录</span></div><p className="app-muted">建议先添加主屏幕，再在独立窗口保存。Safari 与主屏幕 App 的存储可能分开；定期导出备份可在本地转移记录。</p><div className="app-toolbar"><button className="app-button quiet" onClick={backup}>导出本地备份</button><button className="app-button quiet" onClick={() => uploadRef.current?.click()}>导入备份</button><input ref={uploadRef} type="file" accept="application/json,.json" aria-label="导入命盘备份" className="sr-only" onChange={e => void restore(e.target.files?.[0])} /></div>{records.length === 0 && <div className="app-empty"><span>✧</span><h3>还没有珍藏的命盘</h3><p>起盘后点击「保存命盘」，便可在这里再次打开。</p><button className="app-button" onClick={() => { setChart(null); setTab('chart'); }}>新建第一张命盘</button></div>}<div className="app-records">{records.map(record => <article key={record.id} className="app-record"><button className="app-record-open" onClick={() => openRecord(record)}><strong>{record.label}</strong><span>{new Date(record.updatedAt).toLocaleString('zh-CN')} 保存 · {record.chart.wuxingJuName}</span></button>{deleteId === record.id ? <div className="app-delete-confirm"><span>删除这条记录？</span><button className="app-button danger" onClick={() => remove(record.id)}>确认删除</button><button className="app-button quiet" onClick={() => setDeleteId(null)}>取消</button></div> : <button className="app-button quiet" aria-label={`删除 ${record.label}`} onClick={() => setDeleteId(record.id)}>删除</button>}</article>)}</div></section>}
    {tab === 'learn' && <section className="app-help"><span className="app-eyebrow">由原典出发</span><h2>学习与使用</h2><div className="app-links"><Link href="/library/">古籍原典与全文检索 →</Link><Link href="/knowledge/">十四主星知识 →</Link><Link href="/heming/">双盘对照 →</Link><Link href="/preview/">原项目样本预览 →</Link></div><details open><summary>在 iPhone 安装</summary><p>用 Safari 打开部署后的 HTTPS 地址，点「分享」→「添加到主屏幕」→「添加」。如有「作为网页 App 打开」选项，请开启。返回主屏幕，点「紫微斗数」。</p></details><details><summary>离线使用与资料备份</summary><p>首次联网打开后，等页面底部显示核心缓存就绪。以后可在离线时排盘和读取本地记录；古籍章节需先访问。系统清理网站数据或删除 App 可能清除命盘，请定期导出 JSON 到「文件」。更新不会自动刷新正在输入的页面。</p></details><details><summary>本版保留与限制</summary><p>排盘、星曜、四化、格局及古籍沿用原项目。AI 解读、商业版断语库与服务器接口未在上游开源，本版提供本地星曜说明和古籍检索。双盘对照不提供 AI 评分；不生成新的未经验证算法。</p></details><p className="app-muted">本地说明为传统文化资料。倪师原话资料按上游 CC BY-NC-SA 4.0 标记；代码为 MIT，古籍为公版。详见交付的 LICENSE_AUDIT.md。</p></section>}
    <footer className="app-footer"><span>紫微斗数 · iPhone 自用版</span><Link href="/privacy/">本地隐私</Link><Link href="/terms/">来源与许可</Link></footer>
  </main>;
}
