import type { HolidayDTO, TimetableItemDTO } from '@/types';
import { isSameDay } from './format';

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getMondayOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function getWeekKey(date: Date): string {
  const m = getMondayOfWeek(date);
  const y = m.getFullYear();
  const mo = String(m.getMonth() + 1).padStart(2, '0');
  const da = String(m.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export function getNextSchoolDay(from: Date): Date {
  const d = startOfDay(from);
  const day = d.getDay();
  if (day === 5) d.setDate(d.getDate() + 3);
  else if (day === 6) d.setDate(d.getDate() + 2);
  else d.setDate(d.getDate() + 1);
  return d;
}

export function getPrevSchoolDay(from: Date): Date {
  const d = startOfDay(from);
  const day = d.getDay();
  if (day === 1) d.setDate(d.getDate() - 3);
  else if (day === 0) d.setDate(d.getDate() - 2);
  else d.setDate(d.getDate() - 1);
  return d;
}

export function getInitialSchoolDate(now = new Date()): Date {
  if (isWeekend(now)) return getNextSchoolDay(now);
  return startOfDay(now);
}

export interface AutoAdvanceResult {
  shouldAdvance: boolean;
  targetDate: Date;
  label: string | null;
}

export function evaluateDayAutoAdvance(
  weekItems: TimetableItemDTO[],
  now = new Date()
): AutoAdvanceResult {
  if (isWeekend(now)) {
    const monday = getNextSchoolDay(now);
    return {
      shouldAdvance: true,
      targetDate: monday,
      label: 'Week-end · Affichage de lundi',
    };
  }

  const todayActive = weekItems.filter(
    (item) => !item.canceled && isSameDay(new Date(item.startDate), now)
  );

  if (todayActive.length > 0) {
    const lastEndMs = Math.max(...todayActive.map((c) => new Date(c.endDate).getTime()));
    if (now.getTime() >= lastEndMs) {
      const nextDay = getNextSchoolDay(now);
      const dayName = nextDay.toLocaleDateString('fr-FR', { weekday: 'long' });
      return {
        shouldAdvance: true,
        targetDate: nextDay,
        label: `Journée terminée · Affichage de ${dayName}`,
      };
    }
  } else if (weekItems.length > 0 && now.getHours() >= 14) {
    const nextDay = getNextSchoolDay(now);
    const dayName = nextDay.toLocaleDateString('fr-FR', { weekday: 'long' });
    return {
      shouldAdvance: true,
      targetDate: nextDay,
      label: `Pas de cours aujourd'hui · Affichage de ${dayName}`,
    };
  }

  return {
    shouldAdvance: false,
    targetDate: startOfDay(now),
    label: null,
  };
}

export interface LessonTemporalState {
  state: 'canceled' | 'current' | 'past' | 'upcoming';
  progressPct: number;
  minsLeft: number;
}

export function getLessonTemporalState(
  item: TimetableItemDTO,
  now = new Date()
): LessonTemporalState {
  if (item.canceled) {
    return { state: 'canceled', progressPct: 0, minsLeft: 0 };
  }
  const startMs = new Date(item.startDate).getTime();
  const endMs = new Date(item.endDate).getTime();
  const nowMs = now.getTime();

  if (nowMs >= startMs && nowMs < endMs) {
    const total = Math.max(1, endMs - startMs);
    const pct = Math.max(0, Math.min(100, ((nowMs - startMs) / total) * 100));
    const minsLeft = Math.max(1, Math.ceil((endMs - nowMs) / 60_000));
    return { state: 'current', progressPct: pct, minsLeft };
  }
  if (nowMs >= endMs) {
    return { state: 'past', progressPct: 100, minsLeft: 0 };
  }
  return { state: 'upcoming', progressPct: 0, minsLeft: 0 };
}

export interface DayBreakSlot {
  id: string;
  kind: 'lunch' | 'free';
  startDate: Date;
  endDate: Date;
  durationMinutes: number;
}

export function computeDayBreaks(dayItems: TimetableItemDTO[]): DayBreakSlot[] {
  const active = dayItems
    .filter((i) => !i.canceled)
    .map((i) => ({
      start: new Date(i.startDate).getTime(),
      end: new Date(i.endDate).getTime(),
    }))
    .filter((x) => x.end > x.start)
    .sort((a, b) => a.start - b.start);

  if (active.length < 2) return [];

  const merged: Array<{ start: number; end: number }> = [active[0]];
  for (let i = 1; i < active.length; i++) {
    const prev = merged[merged.length - 1];
    if (active[i].start <= prev.end) {
      prev.end = Math.max(prev.end, active[i].end);
    } else {
      merged.push({ ...active[i] });
    }
  }

  const rawGaps: Array<{ start: Date; end: Date; durationMinutes: number }> = [];
  for (let i = 0; i < merged.length - 1; i++) {
    const gStart = new Date(merged[i].end);
    const gEnd = new Date(merged[i + 1].start);
    const durationMinutes = Math.round((gEnd.getTime() - gStart.getTime()) / 60_000);
    if (durationMinutes >= 35) {
      rawGaps.push({ start: gStart, end: gEnd, durationMinutes });
    }
  }

  if (rawGaps.length === 0) return [];

  let lunchIdx = -1;
  let bestLunchDuration = -1;
  rawGaps.forEach((g, idx) => {
    const sMin = g.start.getHours() * 60 + g.start.getMinutes();
    const eMin = g.end.getHours() * 60 + g.end.getMinutes();
    const overlapsMidday =
      sMin >= 10 * 60 + 45 && sMin <= 14 * 60 + 15 && eMin >= 11 * 60 + 45 && eMin <= 15 * 60 + 30;
    if (overlapsMidday && g.durationMinutes > bestLunchDuration) {
      bestLunchDuration = g.durationMinutes;
      lunchIdx = idx;
    }
  });

  const slots: DayBreakSlot[] = [];
  rawGaps.forEach((g, idx) => {
    if (idx === lunchIdx) {
      slots.push({
        id: `lunch-${g.start.getTime()}`,
        kind: 'lunch',
        startDate: g.start,
        endDate: g.end,
        durationMinutes: g.durationMinutes,
      });
    } else if (g.durationMinutes >= 45) {
      slots.push({
        id: `free-${g.start.getTime()}`,
        kind: 'free',
        startDate: g.start,
        endDate: g.end,
        durationMinutes: g.durationMinutes,
      });
    }
  });

  return slots;
}

export interface RightToDisconnectInfo {
  active: boolean;
  reason: 'night' | 'weekend' | 'public_holiday' | 'school_holiday' | null;
  windowKey: string;
  holidayName?: string;
}

function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function isFrenchPublicHoliday(date: Date): boolean {
  const y = date.getFullYear();
  const mo = date.getMonth() + 1;
  const da = date.getDate();

  const fixed: Array<[number, number]> = [
    [1, 1],
    [5, 1],
    [5, 8],
    [7, 14],
    [8, 15],
    [11, 1],
    [11, 11],
    [12, 25],
  ];
  if (fixed.some(([m, d]) => m === mo && d === da)) return true;

  const easter = getEasterSunday(y);
  const addDays = (base: Date, offset: number) => {
    const res = new Date(base);
    res.setDate(base.getDate() + offset);
    return res;
  };
  const movable = [
    addDays(easter, 1),
    addDays(easter, 39),
    addDays(easter, 50),
  ];
  return movable.some((h) => isSameDay(h, date));
}

export function findActiveSchoolHoliday(
  date: Date,
  holidays?: HolidayDTO[]
): HolidayDTO | null {
  if (!holidays || holidays.length === 0) return null;
  const dayStartMs = startOfDay(date).getTime();
  for (const h of holidays) {
    const s = new Date(h.startDate);
    const e = new Date(h.endDate);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) continue;
    const sDay = startOfDay(s).getTime();
    const eDay = startOfDay(e).getTime();
    if (dayStartMs >= sDay && dayStartMs <= eDay) {
      return h;
    }
  }
  return null;
}

export function getRightToDisconnectInfo(
  now = new Date(),
  holidays?: HolidayDTO[]
): RightToDisconnectInfo {
  const day = now.getDay();
  const hour = now.getHours();
  const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

  const activeHoliday = findActiveSchoolHoliday(now, holidays);
  if (activeHoliday) {
    return {
      active: true,
      reason: 'school_holiday',
      windowKey: `school_holiday:${activeHoliday.startDate}`,
      holidayName: activeHoliday.name,
    };
  }

  if (isFrenchPublicHoliday(now)) {
    return {
      active: true,
      reason: 'public_holiday',
      windowKey: `public_holiday:${dateKey}`,
    };
  }

  if (day === 6 || day === 0) {
    return {
      active: true,
      reason: 'weekend',
      windowKey: `weekend:${getWeekKey(now)}`,
    };
  }

  if (hour >= 20 || hour < 7) {
    const nightAnchor = new Date(now);
    if (hour < 7) nightAnchor.setDate(nightAnchor.getDate() - 1);
    const nightKey = `${nightAnchor.getFullYear()}-${nightAnchor.getMonth() + 1}-${nightAnchor.getDate()}`;
    return {
      active: true,
      reason: 'night',
      windowKey: `night:${nightKey}`,
    };
  }

  return {
    active: false,
    reason: null,
    windowKey: '',
  };
}

export function formatLastSync(iso?: string | null): string {
  if (!iso) return 'inconnue';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'inconnue';
  const now = new Date();
  const timeStr = `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
  if (isSameDay(d, now)) return `aujourd'hui à ${timeStr}`;
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (isSameDay(d, yest)) return `hier à ${timeStr}`;
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${timeStr}`;
}
