'use client';
import { useEffect, useMemo, useState } from 'react';
import type { BirthInfo } from '@/lib/ziwei/types';
import { SHICHEN } from '@/lib/ziwei/constants';
import { useTheme } from '@/components/ThemeProvider';
import { PROVINCES } from '@/lib/ziwei/cities';
import { formToBirthInfo, calcTrueSolarBranch } from '@/lib/ziwei/share';
import { calendarInputToSolar, solarToCalendarInput, type CalendarKind } from '@/lib/ziwei/calendar-input';
import { LUNAR_YEAR_MIN, LUNAR_YEAR_MAX, leapMonthOfLunarYear } from '@/lib/ziwei/lunar-solar';
import { SOLAR_INPUT_MAX, SOLAR_RANGE_LABEL } from '@/lib/ziwei/date-range';
import { isChinaDST } from '@/lib/ziwei/dst-cn';

export interface BirthFormState {
  name: string; year: string; month: string; day: string;
  clockHour: string; clockMinute: string; unknownTime: boolean;
  province: string; city: string; longitude: number; gender: 'male' | 'female';
}
interface BirthFormProps {
  onSubmit: (info: BirthInfo) => void; loading?: boolean; initialData?: Partial<BirthFormState>;
  onFormSave?: (data: BirthFormState) => void; hideSubmit?: boolean;
}

export default function BirthForm({ onSubmit, loading, initialData, onFormSave, hideSubmit }: BirthFormProps) {
  const { theme } = useTheme();
  const [form, setForm] = useState<BirthFormState>({
    name: initialData?.name ?? '', year: initialData?.year ?? '', month: initialData?.month ?? '', day: initialData?.day ?? '',
    clockHour: initialData?.clockHour ?? '8', clockMinute: initialData?.clockMinute ?? '0', unknownTime: initialData?.unknownTime ?? false,
    province: initialData?.province ?? '', city: initialData?.city ?? '', longitude: initialData?.longitude ?? 120, gender: initialData?.gender ?? 'male',
  });
  const [calendar, setCalendar] = useState<CalendarKind>('solar');
  const [leapMonth, setLeapMonth] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [clockBeforeAdjustment, setClockBeforeAdjustment] = useState<{ hour: string; minute: string } | null>(null);
  const year = Number(form.year), month = Number(form.month), day = Number(form.day);
  const dateResult = useMemo(() => {
    if (!form.year || !form.month || !form.day) return { solar: null, error: '请填写完整出生日期' };
    try { return { solar: calendarInputToSolar(year, month, day, calendar, leapMonth), error: '' }; }
    catch (error) { return { solar: null, error: error instanceof Error ? error.message : '日期无效' }; }
  }, [form.year, form.month, form.day, year, month, day, calendar, leapMonth]);
  const solarForm = useMemo<BirthFormState>(() => dateResult.solar ? {
    ...form, year: String(dateResult.solar.year), month: String(dateResult.solar.month), day: String(dateResult.solar.day),
  } : { ...form, year: '', month: '', day: '' }, [form, dateResult.solar]);
  // The upstream comparison page must always receive Gregorian dates.
  useEffect(() => { onFormSave?.(solarForm); }, [solarForm, onFormSave]);
  const cities = useMemo(() => PROVINCES.find(province => province.name === form.province)?.cities ?? [], [form.province]);
  const longitude = form.province ? form.longitude : 120;
  const branch = form.unknownTime ? 0 : calcTrueSolarBranch(Number(form.clockHour), Number(form.clockMinute), longitude);
  const solar = dateResult.solar, leap = leapMonthOfLunarYear(year);
  const yearMax = calendar === 'lunar' ? LUNAR_YEAR_MAX : SOLAR_INPUT_MAX.year;
  const dst = solar ? isChinaDST(solar.year, solar.month, solar.day) : false;
  const change = <K extends keyof BirthFormState>(key: K, value: BirthFormState[K]) => {
    setSubmitError(''); setForm(previous => ({ ...previous, [key]: value }));
  };
  const switchCalendar = (next: CalendarKind) => {
    if (next === calendar) return;
    if (solar) {
      try {
        const converted = solarToCalendarInput(solar, next);
        setForm(previous => ({ ...previous, year: String(converted.year), month: String(converted.month), day: String(converted.day) }));
        setLeapMonth(converted.leapMonth);
      } catch (error) { setSubmitError(error instanceof Error ? error.message : '历法转换失败'); return; }
    } else setLeapMonth(false);
    setCalendar(next); setAttempted(false); setSubmitError('');
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault(); setAttempted(true); setSubmitError('');
    if (!solar) return;
    try {
      onFormSave?.(solarForm);
      // Preserve upstream true-solar branch and day rollover rules.
      const info = formToBirthInfo(solarForm);
      if (!form.unknownTime) info.origInput = { ...solar, clockHour: Number(form.clockHour), clockMinute: Number(form.clockMinute) };
      onSubmit(info);
    } catch (error) { setSubmitError(error instanceof Error ? error.message : '起盘失败，请检查输入'); }
  };
  const input: React.CSSProperties = { width: '100%', minWidth: 0, minHeight: 46, fontSize: 16, padding: '10px 12px', borderRadius: 12, color: 'inherit', background: 'var(--t-surface, transparent)', border: '1px solid var(--t-border, #888)' };
  const row: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 };
  const label: React.CSSProperties = { display: 'block', fontSize: 14, marginBottom: 7 };
  const hint: React.CSSProperties = { fontSize: 13, lineHeight: 1.7, marginTop: 8, color: 'var(--t-muted, #8793a6)' };
  return (
    <form aria-label="出生信息" onSubmit={submit} style={{ border: '1px solid var(--t-border, #888)', borderRadius: 20, padding: 'clamp(16px,4vw,28px)', display: 'grid', gap: 20, background: 'var(--t-surface, transparent)' }}>
      <div><label htmlFor="birth-name" style={label}>姓名或备注（可选）</label><input id="birth-name" name="name" type="text" autoComplete="off" maxLength={80} placeholder="例如：我的命盘" value={form.name} onChange={event => change('name', event.target.value)} style={input} /></div>
      <fieldset style={{ minWidth: 0 }}>
        <legend style={label}>出生日期</legend>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>{(['solar', 'lunar'] as const).map(kind => <button key={kind} type="button" aria-pressed={calendar === kind} onClick={() => switchCalendar(kind)} style={{ ...input, flex: 1, borderColor: calendar === kind ? 'var(--t-gold, #b78b40)' : undefined }}>{kind === 'solar' ? '公历' : '农历'}</button>)}</div>
        <div style={row}>
          <select aria-label="出生年份" name="year" value={form.year} onChange={event => change('year', event.target.value)} style={input} required><option value="">年份</option>{Array.from({ length: yearMax - LUNAR_YEAR_MIN + 1 }, (_, index) => yearMax - index).map(value => <option key={value} value={value}>{value}年</option>)}</select>
          <select aria-label="出生月份" name="month" value={form.month} onChange={event => change('month', event.target.value)} style={input} required><option value="">月份</option>{Array.from({ length: 12 }, (_, index) => index + 1).map(value => <option key={value} value={value}>{value}月</option>)}</select>
          <select aria-label="出生日期" name="day" value={form.day} onChange={event => change('day', event.target.value)} style={input} required><option value="">日期</option>{Array.from({ length: calendar === 'solar' ? 31 : 30 }, (_, index) => index + 1).map(value => <option key={value} value={value}>{value}日</option>)}</select>
        </div>
        {calendar === 'lunar' && <><label style={{ ...hint, display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 }}><input type="checkbox" checked={leapMonth} onChange={event => setLeapMonth(event.target.checked)} style={{ width: 20, height: 20 }} />这个月份是闰月</label><p style={hint}>{form.year ? `${year} 年${leap ? `有闰${leap}月` : '无闰月'}` : '请先选择农历年份'}。不存在的闰月或日期会阻止起盘。</p></>}
        <p style={hint}>农历支持 {LUNAR_YEAR_MIN}–{LUNAR_YEAR_MAX} 年；对应公历支持 {SOLAR_RANGE_LABEL}，包含农历年末换算到次年的日期。</p>
        {solar && <p style={hint}>公历日期：{solar.year} 年 {solar.month} 月 {solar.day} 日</p>}
        {(attempted || (form.year && form.month && form.day)) && dateResult.error && <p role="alert" style={{ ...hint, color: '#d95858' }}>{dateResult.error}</p>}
      </fieldset>
      <fieldset style={{ minWidth: 0 }}>
        <legend style={label}>出生地点（可选，用于经度校正）</legend>
        <div style={{ ...row, gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
          <select aria-label="出生省份" name="province" value={form.province} onChange={event => { const province = PROVINCES.find(value => value.name === event.target.value), city = province?.cities[0]; setForm(previous => ({ ...previous, province: event.target.value, city: city?.name ?? '', longitude: city?.longitude ?? 120 })); }} style={input}><option value="">暂不填写</option>{PROVINCES.map(province => <option key={province.name} value={province.name}>{province.name}</option>)}</select>
          <select aria-label="出生城市" name="city" value={form.city} disabled={!form.province} onChange={event => { const city = cities.find(value => value.name === event.target.value); setForm(previous => ({ ...previous, city: event.target.value, longitude: city?.longitude ?? 120 })); }} style={input}><option value="">城市</option>{cities.map(city => <option key={city.name} value={city.name}>{city.name}</option>)}</select>
        </div>
        <p style={hint}>{form.province ? `${form.city} · 东经 ${longitude.toFixed(2)}° · 经度校正 ${Math.round((longitude - 120) * 4)} 分钟` : '不填写地点时，按东经 120° 处理。第一版支持国内出生地，时间按北京时间 UTC+8 标准时输入。'}</p>
      </fieldset>
      <fieldset style={{ minWidth: 0 }}>
        <legend style={label}>出生时间（北京时间 UTC+8 标准时）</legend>
        <div style={{ ...row, gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
          <select aria-label="出生小时" name="clockHour" value={form.clockHour} disabled={form.unknownTime} onChange={event => { change('clockHour', event.target.value); setClockBeforeAdjustment(null); }} style={input}>{Array.from({ length: 24 }, (_, value) => <option key={value} value={value}>{String(value).padStart(2, '0')} 时</option>)}</select>
          <select aria-label="出生分钟" name="clockMinute" value={form.clockMinute} disabled={form.unknownTime} onChange={event => { change('clockMinute', event.target.value); setClockBeforeAdjustment(null); }} style={input}>{Array.from({ length: 60 }, (_, value) => <option key={value} value={value}>{String(value).padStart(2, '0')} 分</option>)}</select>
        </div>
        <label style={{ ...hint, display: 'flex', gap: 8, alignItems: 'center', minHeight: 44 }}><input type="checkbox" checked={form.unknownTime} onChange={event => change('unknownTime', event.target.checked)} style={{ width: 20, height: 20 }} />不知道出生时间，暂用子时</label>
        <p style={hint}>{form.unknownTime ? '暂按本日子时排盘，不进行晚子时换日。时辰未知会影响命盘，请在确认后重新起盘。' : `${form.province ? '经度校正后' : '钟表时间对应'}：${SHICHEN[branch]?.name ?? ''}（${SHICHEN[branch]?.range}）。晚子时按原项目规则换日。`}</p>
        {dst && <div role="note" style={{ ...hint, border: '1px solid var(--t-border, #888)', borderRadius: 10, padding: 12 }}>原项目夏令时表提示：这一天可能实行夏令时。请核对出生证明是否已换为标准时；本应用不会自动减时。
          {clockBeforeAdjustment ? <button type="button" onClick={() => { setForm(previous => ({ ...previous, clockHour: clockBeforeAdjustment.hour, clockMinute: clockBeforeAdjustment.minute })); setClockBeforeAdjustment(null); }} style={{ ...input, marginTop: 8 }}>撤销减 1 小时</button> : <button type="button" disabled={form.unknownTime || Number(form.clockHour) === 0} onClick={() => { setClockBeforeAdjustment({ hour: form.clockHour, minute: form.clockMinute }); change('clockHour', String(Number(form.clockHour) - 1)); }} style={{ ...input, marginTop: 8 }}>我确认是夏令时读数，减 1 小时</button>}
          {Number(form.clockHour) === 0 && !clockBeforeAdjustment && <p>减时会跨日，请手动同时核对日期和时间。</p>}
        </div>}
      </fieldset>
      <fieldset><legend style={label}>性别</legend><div style={{ display: 'flex', gap: 10 }}>{(['male', 'female'] as const).map(gender => <button key={gender} type="button" aria-pressed={form.gender === gender} onClick={() => change('gender', gender)} style={{ ...input, flex: 1, borderColor: form.gender === gender ? 'var(--t-gold, #b78b40)' : undefined }}>{gender === 'male' ? '男' : '女'}</button>)}</div></fieldset>
      {submitError && <p role="alert" style={{ ...hint, color: '#d95858' }}>{submitError}</p>}
      {!hideSubmit && <button type="submit" disabled={loading} style={{ ...input, fontWeight: 700, minHeight: 50, color: theme === 'dark' ? '#191616' : '#fff', background: theme === 'dark' ? '#d4b16b' : '#936a28' }}>{loading ? '正在起盘…' : '立即起盘'}</button>}
    </form>
  );
}
