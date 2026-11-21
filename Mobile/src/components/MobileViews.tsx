import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  User,
  Users,
  CheckCircle2,
  Circle,
  Paperclip,
  ExternalLink,
  Clock,
  BookOpen,
  X,
  Loader2,
  Sun,
  Moon,
  Calculator,
  Plus,
  Trash2,
  Send,
  Bell,
  MessageSquare,
  Check,
  Palette,
  RefreshCw,
  LogOut,
  DownloadCloud,
  Sparkles,
  AlertCircle,
  UtensilsCrossed,
  Coffee,
  MoonStar,
} from 'lucide-react';
import type {
  AccentTheme,
  AttendanceDTO,
  DiscussionSummaryDTO,
  DiscussionThreadDTO,
  GradesOverviewDTO,
  HomeworkDTO,
  LessonDetailsDTO,
  MealDTO,
  MenuDayDTO,
  MobileSettings,
  MobileTab,
  NewsItemDTO,
  PeriodDTO,
  StudentProfile,
  TimetableItemDTO,
  TimetableResponse,
} from '@/types';
import { mobilePronote } from '@/services/pronote';
import { getAppVersion, openExternalUrl } from '@/services/updater';
import {
  formatDateFull,
  formatDateRelative,
  formatDateShort,
  formatDurationMinutes,
  formatGradeNumber,
  formatTime,
  getGradeColorClass,
  isSameDay,
  normalizeHexColor,
  sanitizeHtml,
  stripHtml,
  toDateKey,
} from '@/utils/format';
import {
  computeDayBreaks,
  evaluateDayAutoAdvance,
  getInitialSchoolDate,
  getLessonTemporalState,
  getMondayOfWeek,
  getNextSchoolDay,
  getRightToDisconnectInfo,
  isWeekend,
} from '@/utils/schoolTime';

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(139, 116, 255, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(139, 116, 255, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const MobileRightToDisconnectNote: React.FC<{
  serverDisabled?: boolean;
  onlyWhenActive?: boolean;
}> = ({ serverDisabled = false, onlyWhenActive = false }) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const info = getRightToDisconnectInfo(now, serverDisabled);
  if (onlyWhenActive && !info.active) return null;

  if (info.active) {
    return (
      <div className="rounded-2xl bg-indigo-500/[0.09] border border-indigo-400/25 p-3 flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0 mt-0.5">
          <MoonStar className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0 text-[11.5px] leading-relaxed">
          <div className="font-semibold text-indigo-200">{info.title}</div>
          <p className="text-indigo-200/75 mt-0.5">{info.description}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white/[0.025] border border-white/[0.06] px-3 py-2 flex items-start gap-2 text-[11px] text-zinc-400 leading-relaxed">
      <MoonStar className="w-3.5 h-3.5 text-indigo-400/80 shrink-0 mt-0.5" />
      <span>{info.description}</span>
    </div>
  );
};

/* ================= DASHBOARD ================= */
export const MobileDashboard: React.FC<{
  profile: StudentProfile;
  timetableItems: TimetableItemDTO[];
  homework: HomeworkDTO[];
  grades: GradesOverviewDTO | null;
  news: NewsItemDTO[];
  messagingDisabled?: boolean;
  onNavigate: (tab: MobileTab) => void;
  onToggleHomework: (id: string, done: boolean) => void;
}> = ({
  profile,
  timetableItems,
  homework,
  grades,
  news,
  messagingDisabled = false,
  onNavigate,
  onToggleHomework,
}) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const displayDay = useMemo(() => {
    const adv = evaluateDayAutoAdvance(timetableItems, now);
    const todayItems = timetableItems
      .filter((i) => isSameDay(new Date(i.startDate), now))
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    if (!adv.shouldAdvance && todayItems.length > 0) {
      return { title: "Cours aujourd'hui", subtitle: null as string | null, items: todayItems };
    }

    const targetItems = timetableItems
      .filter((i) => isSameDay(new Date(i.startDate), adv.targetDate))
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    if (targetItems.length > 0) {
      const dayLbl = formatDateRelative(adv.targetDate.toISOString());
      return {
        title: `Cours · ${dayLbl.charAt(0).toUpperCase() + dayLbl.slice(1)}`,
        subtitle: adv.label,
        items: targetItems,
      };
    }

    const upcoming = timetableItems.filter((item) => {
      const d = new Date(item.startDate);
      return !isWeekend(d) && new Date(item.endDate).getTime() > now.getTime();
    });
    if (upcoming.length > 0) {
      const firstDate = new Date(upcoming[0].startDate);
      const dayLbl = formatDateRelative(firstDate.toISOString());
      return {
        title: `Cours · ${dayLbl.charAt(0).toUpperCase() + dayLbl.slice(1)}`,
        subtitle: adv.label,
        items: upcoming
          .filter((i) => isSameDay(new Date(i.startDate), firstDate))
          .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
      };
    }

    const dayLbl = formatDateRelative(adv.targetDate.toISOString());
    return {
      title: adv.shouldAdvance
        ? `Cours · ${dayLbl.charAt(0).toUpperCase() + dayLbl.slice(1)}`
        : "Cours aujourd'hui",
      subtitle: adv.label,
      items: [],
    };
  }, [timetableItems, now]);

  const displayTimeline = useMemo(() => {
    const breaks = computeDayBreaks(displayDay.items);
    type Row =
      | { kind: 'lesson'; sortKey: number; item: TimetableItemDTO }
      | { kind: 'break'; sortKey: number; brk: (typeof breaks)[number] };
    const rows: Row[] = [
      ...displayDay.items.map((item) => ({
        kind: 'lesson' as const,
        sortKey: new Date(item.startDate).getTime(),
        item,
      })),
      ...breaks.map((brk) => ({
        kind: 'break' as const,
        sortKey: brk.startDate.getTime(),
        brk,
      })),
    ];
    return rows.sort((a, b) => a.sortKey - b.sortKey);
  }, [displayDay.items]);

  const nextLesson = useMemo(() => {
    const active = timetableItems.filter((c) => !c.canceled);
    const current = active.find(
      (c) =>
        now.getTime() >= new Date(c.startDate).getTime() &&
        now.getTime() < new Date(c.endDate).getTime()
    );
    if (current) {
      const t = getLessonTemporalState(current, now);
      return {
        isLive: true,
        label: `En cours · ${t.minsLeft} min restantes`,
        progress: t.progressPct,
        item: current,
      };
    }
    const upcoming = active.find(
      (c) => !isWeekend(new Date(c.startDate)) && new Date(c.startDate).getTime() > now.getTime()
    );
    return upcoming
      ? {
          isLive: false,
          label: `Prochain · ${formatDateRelative(upcoming.startDate)} ${formatTime(
            upcoming.startDate
          )}`,
          progress: 0,
          item: upcoming,
        }
      : null;
  }, [timetableItems, now]);

  const urgentHw = useMemo(() => {
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return homework
      .filter((h) => !h.done && new Date(h.deadline).getTime() >= startToday)
      .slice(0, 4);
  }, [homework, now]);

  return (
    <div className="p-4 space-y-4">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-accent">
          {formatDateFull(now.toISOString())}
        </div>
        <h1 className="text-xl font-bold text-white mt-0.5">Salut, {profile.firstName}</h1>
      </div>

      {/* Droit à la déconnexion banner (only when active) */}
      <MobileRightToDisconnectNote serverDisabled={messagingDisabled} onlyWhenActive />

      {/* Live Next Class */}
      {nextLesson && (
        <button
          onClick={() => onNavigate('timetable')}
          className={`w-full p-3.5 rounded-2xl border flex items-center gap-3 text-left ${
            nextLesson.isLive
              ? 'bg-accent/[0.11] border-accent/45 shadow-glow'
              : 'bg-[#111119] border-white/[0.08]'
          }`}
        >
          <div
            className="w-1.5 h-12 rounded-full shrink-0"
            style={{ backgroundColor: normalizeHexColor(nextLesson.item.backgroundColor) }}
          />
          <div className="min-w-0 flex-1">
            <div
              className={`text-[10.5px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                nextLesson.isLive ? 'text-emerald-300' : 'text-accent'
              }`}
            >
              {nextLesson.isLive && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
              {nextLesson.label}
            </div>
            <div className="text-sm font-bold text-white truncate">{nextLesson.item.title}</div>
            <div className="text-xs text-zinc-400 truncate">
              {nextLesson.item.classrooms.join(', ') || 'Salle non précisée'}
              {nextLesson.item.teachers[0] ? ` · ${nextLesson.item.teachers[0]}` : ''}
            </div>
            {nextLesson.isLive && (
              <div className="w-full h-1 rounded-full bg-black/40 mt-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{ width: `${nextLesson.progress}%` }}
                />
              </div>
            )}
          </div>
        </button>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-2.5">
        <button
          onClick={() => onNavigate('grades')}
          className="p-3 rounded-2xl bg-[#0F0F16] border border-white/[0.06] text-left"
        >
          <div className="text-[10.5px] text-zinc-400">Moyenne</div>
          <div
            className={`text-lg font-extrabold mt-0.5 tabular-nums ${
              grades?.overallAverage !== undefined
                ? getGradeColorClass(grades.overallAverage)
                : 'text-white'
            }`}
          >
            {formatGradeNumber(grades?.overallAverage)}
          </div>
        </button>
        <button
          onClick={() => onNavigate('homework')}
          className="p-3 rounded-2xl bg-[#0F0F16] border border-white/[0.06] text-left"
        >
          <div className="text-[10.5px] text-zinc-400">Devoirs</div>
          <div className="text-lg font-extrabold text-white mt-0.5 tabular-nums">
            {urgentHw.length}
          </div>
        </button>
        <button
          onClick={() => onNavigate('messages')}
          className="p-3 rounded-2xl bg-[#0F0F16] border border-white/[0.06] text-left"
        >
          <div className="text-[10.5px] text-zinc-400">Infos</div>
          <div className="text-lg font-extrabold text-white mt-0.5 tabular-nums">
            {news.filter((n) => !n.read).length}
          </div>
        </button>
      </div>

      {/* Smart Day Classes (auto-advances to tomorrow / Monday once today ends!) */}
      <section className="rounded-2xl bg-[#0D0D13] border border-white/[0.06] p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-white">{displayDay.title}</h2>
            {displayDay.subtitle && (
              <div className="text-[10.5px] text-emerald-300/85 mt-0.5">{displayDay.subtitle}</div>
            )}
          </div>
          <button onClick={() => onNavigate('timetable')} className="text-xs text-accent shrink-0">
            Semaine
          </button>
        </div>
        {displayDay.items.length === 0 ? (
          <p className="text-xs text-zinc-500 py-3 text-center">Aucun cours prévu.</p>
        ) : (
          displayTimeline.map((row) => {
            if (row.kind === 'break') {
              const isLunch = row.brk.kind === 'lunch';
              return (
                <div
                  key={row.brk.id}
                  className={`px-3 py-2 rounded-xl border border-dashed flex items-center justify-between text-[11px] ${
                    isLunch
                      ? 'bg-amber-500/[0.08] border-amber-400/30 text-amber-300'
                      : 'bg-white/[0.02] border-white/[0.08] text-zinc-400'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    {isLunch ? (
                      <UtensilsCrossed className="w-3.5 h-3.5" />
                    ) : (
                      <Coffee className="w-3 h-3" />
                    )}
                    {isLunch ? 'Pause déjeuner' : 'Pause'}
                  </span>
                  <span className="tabular-nums opacity-85">
                    {formatTime(row.brk.startDate.toISOString())} –{' '}
                    {formatTime(row.brk.endDate.toISOString())}
                  </span>
                </div>
              );
            }

            const c = row.item;
            const color = normalizeHexColor(c.backgroundColor);
            const temporal = getLessonTemporalState(c, now);
            const isCurrent = temporal.state === 'current';
            const isPast = temporal.state === 'past';

            return (
              <div
                key={c.id}
                className={`p-2.5 rounded-xl border flex items-center gap-3 ${
                  c.canceled
                    ? 'bg-rose-500/[0.05] border-rose-500/20 opacity-70'
                    : isCurrent
                    ? 'bg-accent/[0.13] border-accent/50'
                    : isPast
                    ? 'bg-[#0F0F14]/70 border-white/[0.04] opacity-55'
                    : 'bg-[#14141D] border-white/[0.06]'
                }`}
              >
                <div className="text-[11px] w-11 text-right tabular-nums shrink-0 leading-tight">
                  <div className={`font-bold ${isPast ? 'text-zinc-500' : 'text-zinc-100'}`}>
                    {formatTime(c.startDate)}
                  </div>
                  <div className="text-[10px] text-zinc-500">{formatTime(c.endDate)}</div>
                </div>
                <div
                  className="w-1 h-8 rounded-full shrink-0"
                  style={{
                    backgroundColor: c.canceled ? '#f43f5e' : isPast ? '#52525b' : color,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`text-xs font-semibold truncate ${
                        c.canceled
                          ? 'line-through text-zinc-500'
                          : isPast
                          ? 'text-zinc-400'
                          : 'text-white'
                      }`}
                    >
                      {c.title}
                    </div>
                    {isCurrent && (
                      <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-bold shrink-0">
                        EN COURS
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate">
                    {c.canceled ? c.status || 'Annulé' : c.classrooms.join(', ')}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Homework */}
      <section className="rounded-2xl bg-[#0D0D13] border border-white/[0.06] p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Devoirs à faire</h2>
          <button onClick={() => onNavigate('homework')} className="text-xs text-accent">
            Tout voir
          </button>
        </div>
        {urgentHw.length === 0 ? (
          <p className="text-xs text-zinc-500 py-3 text-center">Tout est à jour !</p>
        ) : (
          urgentHw.map((hw) => (
            <div
              key={hw.id}
              className="p-2.5 rounded-xl bg-[#14141D] border border-white/[0.05] flex items-start gap-2.5"
            >
              <button onClick={() => onToggleHomework(hw.id, !hw.done)} className="mt-0.5 text-zinc-400">
                {hw.done ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2 text-xs">
                  <span className="font-semibold text-white truncate">{hw.subject}</span>
                  <span className="text-[10.5px] text-zinc-500 shrink-0">
                    {formatDateRelative(hw.deadline)}
                  </span>
                </div>
                <p className="text-[11.5px] text-zinc-400 line-clamp-2 mt-0.5">
                  {stripHtml(hw.description)}
                </p>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
};

/* ================= TIMETABLE + COURSE DETAIL BOTTOM SHEET (PRONOTE STYLE) ================= */
export const MobileTimetable: React.FC<{
  timetable: TimetableResponse | null;
  homework: HomeworkDTO[];
  selectedDate: Date;
  loading: boolean;
  autoAdvanceNote?: string | null;
  onChangeDate: (d: Date) => void;
  onToggleHomework: (id: string, done: boolean) => void;
}> = ({
  timetable,
  homework,
  selectedDate,
  loading,
  autoAdvanceNote,
  onChangeDate,
  onToggleHomework,
}) => {
  const [now, setNow] = useState(() => new Date());
  const [selectedItem, setSelectedItem] = useState<TimetableItemDTO | null>(null);
  const [detailsCache, setDetailsCache] = useState<Record<string, LessonDetailsDTO | null>>({});
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const effectiveDate = useMemo(
    () => (isWeekend(selectedDate) ? getNextSchoolDay(selectedDate) : selectedDate),
    [selectedDate]
  );

  const monday = useMemo(() => getMondayOfWeek(effectiveDate), [effectiveDate]);

  // Strictly Monday -> Friday (no Saturday / Sunday!)
  const weekDays = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d;
      }),
    [monday]
  );

  const dayItems = useMemo(
    () =>
      (timetable?.items ?? [])
        .filter((item) => isSameDay(new Date(item.startDate), effectiveDate))
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
    [timetable, effectiveDate]
  );

  const timelineRows = useMemo(() => {
    const breaks = computeDayBreaks(dayItems);
    type Row =
      | { kind: 'lesson'; sortKey: number; item: TimetableItemDTO }
      | { kind: 'break'; sortKey: number; brk: (typeof breaks)[number] };
    const rows: Row[] = [
      ...dayItems.map((item) => ({
        kind: 'lesson' as const,
        sortKey: new Date(item.startDate).getTime(),
        item,
      })),
      ...breaks.map((brk) => ({
        kind: 'break' as const,
        sortKey: brk.startDate.getTime(),
        brk,
      })),
    ];
    return rows.sort((a, b) => a.sortKey - b.sortKey);
  }, [dayItems]);

  useEffect(() => {
    const resId = selectedItem?.lessonResourceID;
    if (!resId || resId in detailsCache) return;
    let cancelled = false;
    setLoadingDetails(true);
    mobilePronote
      .getLessonDetails(resId)
      .then((res) => {
        if (!cancelled) setDetailsCache((p) => ({ ...p, [resId]: res }));
      })
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedItem?.lessonResourceID, detailsCache]);

  const details = selectedItem?.lessonResourceID ? detailsCache[selectedItem.lessonResourceID] : null;
  const shiftWeek = (delta: number) => {
    const next = new Date(effectiveDate);
    next.setDate(next.getDate() + delta * 7);
    onChangeDate(next);
  };

  return (
    <div className="p-4 space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-lg font-bold text-white truncate">Emploi du temps</h1>
          {timetable?.weekFrequency && (
            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-accent/15 text-accent shrink-0">
              {timetable.weekFrequency}
            </span>
          )}
          {loading && <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" />}
        </div>
        <div className="flex items-center gap-1 bg-[#0F0F16] border border-white/[0.07] rounded-xl p-1 shrink-0">
          <button onClick={() => shiftWeek(-1)} className="p-1 text-zinc-400">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onChangeDate(getInitialSchoolDate(new Date()))}
            className="px-2 text-[11px] font-medium text-zinc-200"
          >
            Auj.
          </button>
          <button onClick={() => shiftWeek(1)} className="p-1 text-zinc-400">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {autoAdvanceNote && (
        <div className="px-3 py-1.5 rounded-xl bg-emerald-500/12 border border-emerald-500/25 text-[11px] text-emerald-300 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            {autoAdvanceNote}
          </span>
          {!isWeekend(now) && !isSameDay(effectiveDate, now) && (
            <button
              onClick={() => onChangeDate(new Date())}
              className="underline underline-offset-2 font-semibold text-emerald-200 shrink-0"
            >
              Voir auj.
            </button>
          )}
        </div>
      )}

      {/* 5-day Mon-Fri Picker (No Sat / Sun!) */}
      <div className="grid grid-cols-5 gap-1.5">
        {weekDays.map((d, idx) => {
          const active = isSameDay(d, effectiveDate);
          const isToday = isSameDay(d, now);
          const labels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
          return (
            <button
              key={d.toISOString()}
              onClick={() => onChangeDate(d)}
              className={`py-2 rounded-xl border text-center transition-all relative ${
                active
                  ? 'bg-accent text-black border-accent font-bold shadow-glow'
                  : isToday
                  ? 'bg-accent/10 border-accent/35 text-accent font-semibold'
                  : 'bg-[#0E0E15] border-white/[0.06] text-zinc-400'
              }`}
            >
              <div className="text-[10.5px]">{labels[idx]}</div>
              <div className="text-xs font-bold mt-0.5 tabular-nums">{d.getDate()}</div>
            </button>
          );
        })}
      </div>

      {/* Selected Day Header */}
      <div className="flex items-center justify-between px-0.5 text-[11.5px] text-zinc-400">
        <span className="capitalize font-semibold text-zinc-200">
          {formatDateFull(effectiveDate.toISOString())}
        </span>
        <span className="tabular-nums">
          {dayItems.filter((i) => !i.canceled).length} cours
        </span>
      </div>

      {/* PRONOTE-Style Vertical Timeline with Lunch Break + Active Highlight + Past Grayout */}
      <div className="space-y-2.5">
        {dayItems.length === 0 ? (
          <div className="rounded-2xl bg-[#0D0D13] border border-white/[0.06] py-12 text-center text-xs text-zinc-500">
            Aucun cours ce jour.
          </div>
        ) : (
          timelineRows.map((row) => {
            if (row.kind === 'break') {
              const isLunch = row.brk.kind === 'lunch';
              const isPastBreak = now.getTime() >= row.brk.endDate.getTime();
              const isNowBreak =
                now.getTime() >= row.brk.startDate.getTime() &&
                now.getTime() < row.brk.endDate.getTime();

              return (
                <div
                  key={row.brk.id}
                  style={{
                    backgroundImage: isLunch
                      ? 'repeating-linear-gradient(-45deg, rgba(251,191,36,0.09) 0px, rgba(251,191,36,0.09) 6px, rgba(251,191,36,0.02) 6px, rgba(251,191,36,0.02) 12px)'
                      : 'repeating-linear-gradient(-45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 6px, transparent 6px, transparent 12px)',
                  }}
                  className={`rounded-2xl border border-dashed px-3.5 py-2.5 flex items-center gap-3 ${
                    isLunch
                      ? isNowBreak
                        ? 'border-amber-400/65 ring-1 ring-amber-400/30'
                        : isPastBreak
                        ? 'border-amber-400/20 opacity-55'
                        : 'border-amber-400/40'
                      : isPastBreak
                      ? 'border-white/[0.05] opacity-45'
                      : 'border-white/[0.1]'
                  }`}
                >
                  <div className="w-12 text-right shrink-0 tabular-nums leading-tight">
                    <div
                      className={`text-[11px] font-bold ${
                        isLunch ? 'text-amber-300' : 'text-zinc-400'
                      }`}
                    >
                      {formatTime(row.brk.startDate.toISOString())}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {formatTime(row.brk.endDate.toISOString())}
                    </div>
                  </div>
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                      isLunch
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                        : 'bg-white/[0.05] text-zinc-400'
                    }`}
                  >
                    {isLunch ? (
                      <UtensilsCrossed className="w-3.5 h-3.5" />
                    ) : (
                      <Coffee className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-xs font-bold ${
                        isLunch ? 'text-amber-200' : 'text-zinc-300'
                      }`}
                    >
                      {isLunch ? 'Pause déjeuner' : 'Pause / Permanence'}
                    </div>
                    <div className="text-[11px] text-zinc-400 tabular-nums">
                      Durée : {formatDurationMinutes(row.brk.durationMinutes)}
                    </div>
                  </div>
                </div>
              );
            }

            const item = row.item;
            const rawColor = normalizeHexColor(item.backgroundColor);
            const temporal = getLessonTemporalState(item, now);
            const isCurrent = temporal.state === 'current';
            const isPast = temporal.state === 'past';
            const durationMins = Math.max(
              15,
              Math.round(
                (new Date(item.endDate).getTime() - new Date(item.startDate).getTime()) / 60_000
              )
            );
            const barColor = item.canceled ? '#f43f5e' : isPast ? '#52525b' : rawColor;

            return (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                style={
                  isCurrent
                    ? {
                        backgroundColor: hexToRgba(rawColor, 0.16),
                        borderColor: hexToRgba(rawColor, 0.6),
                        boxShadow: `0 0 22px -8px ${hexToRgba(rawColor, 0.7)}`,
                      }
                    : undefined
                }
                className={`w-full p-3.5 rounded-2xl border text-left flex items-stretch gap-3 active:scale-[0.99] transition-all ${
                  item.canceled
                    ? 'bg-rose-500/[0.05] border-rose-500/20 opacity-75'
                    : isCurrent
                    ? 'ring-1 ring-white/15'
                    : isPast
                    ? 'bg-[#0E0E13]/80 border-white/[0.04] opacity-55'
                    : 'bg-[#11111A] border-white/[0.08]'
                }`}
              >
                {/* Crisp Start -> End Time Gutter */}
                <div className="w-12 flex flex-col justify-between items-end shrink-0 tabular-nums py-0.5">
                  <div
                    className={`text-xs font-extrabold leading-none ${
                      isCurrent ? 'text-white' : isPast ? 'text-zinc-500' : 'text-zinc-100'
                    }`}
                  >
                    {formatTime(item.startDate)}
                  </div>
                  <div className="text-[9.5px] text-zinc-500 my-1">
                    {formatDurationMinutes(durationMins)}
                  </div>
                  <div
                    className={`text-[11px] font-semibold leading-none ${
                      isPast ? 'text-zinc-600' : 'text-zinc-400'
                    }`}
                  >
                    {formatTime(item.endDate)}
                  </div>
                </div>

                {/* Subject Color Strip */}
                <div
                  className="w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: barColor }}
                />

                {/* Course Content */}
                <div className="min-w-0 flex-1 flex flex-col justify-between gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`text-[14px] font-bold truncate ${
                          item.canceled
                            ? 'line-through text-zinc-400'
                            : isPast
                            ? 'text-zinc-400'
                            : 'text-white'
                        }`}
                      >
                        {item.title}
                      </span>
                      {item.lessonResourceID && !item.canceled && !isCurrent && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            isPast ? 'bg-zinc-600' : 'bg-accent'
                          }`}
                        />
                      )}
                      {item.test && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold shrink-0 ${
                            isPast
                              ? 'bg-zinc-800 text-zinc-500'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          DS
                        </span>
                      )}
                    </div>

                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/40 text-[9.5px] font-extrabold shrink-0 inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        EN COURS
                      </span>
                    )}
                  </div>

                  <div className={`text-xs truncate ${isPast ? 'text-zinc-500' : 'text-zinc-300'}`}>
                    {item.canceled || item.status ? (
                      <span
                        className={
                          item.canceled
                            ? 'text-rose-300 font-semibold'
                            : isPast
                            ? 'text-zinc-500'
                            : 'text-amber-300 font-medium'
                        }
                      >
                        {item.status || 'Cours annulé'}
                        {item.classrooms.length > 0 ? ' · ' : ''}
                      </span>
                    ) : null}
                    {item.classrooms.length > 0 && `Salle ${item.classrooms.join(', ')}`}
                  </div>

                  {item.teachers[0] && (
                    <div className={`text-[11px] truncate ${isPast ? 'text-zinc-600' : 'text-zinc-400'}`}>
                      {item.teachers[0]}
                    </div>
                  )}

                  {isCurrent && (
                    <div className="pt-1 space-y-1">
                      <div className="w-full h-1.5 rounded-full bg-black/40 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${temporal.progressPct}%`,
                            backgroundColor: rawColor,
                          }}
                        />
                      </div>
                      <div className="text-[10px] text-emerald-200/80 font-medium">
                        Encore {temporal.minsLeft} min
                      </div>
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Bottom Sheet Course Details */}
      {selectedItem && (
        <div
          onClick={() => setSelectedItem(null)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[82vh] rounded-t-3xl bg-[#101018] border-t border-white/[0.12] flex flex-col overflow-hidden safe-bottom"
          >
            <div
              className="h-1.5 w-full"
              style={{
                backgroundColor: selectedItem.canceled
                  ? '#f43f5e'
                  : normalizeHexColor(selectedItem.backgroundColor),
              }}
            />
            <div className="p-4 border-b border-white/[0.06] flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-white">{selectedItem.title}</h2>
                <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-accent" />
                  {formatTime(selectedItem.startDate)} – {formatTime(selectedItem.endDate)}
                </p>
              </div>
              <button onClick={() => setSelectedItem(null)} className="p-1.5 text-zinc-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {(selectedItem.canceled || selectedItem.status) && (
                <div className="px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/25 text-rose-200 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {selectedItem.status || 'Cours annulé'}
                </div>
              )}
              <div className="space-y-2 text-zinc-300">
                {selectedItem.teachers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-zinc-500" />
                    {selectedItem.teachers.join(', ')}
                  </div>
                )}
                {selectedItem.classrooms.length > 0 && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-zinc-500" />
                    Salle {selectedItem.classrooms.join(', ')}
                  </div>
                )}
                {selectedItem.groups.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-zinc-500" />
                    {selectedItem.groups.join(', ')}
                  </div>
                )}
              </div>

              {selectedItem.lessonResourceID && (
                <div className="pt-3 border-t border-white/[0.06] space-y-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-accent">
                    <BookOpen className="w-3.5 h-3.5" /> Contenu de la séance
                    {loadingDetails && <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" />}
                  </div>
                  {details && details.contents.length > 0 ? (
                    details.contents.map((c) => (
                      <div key={c.id} className="p-3 rounded-xl bg-[#161622] border border-white/[0.06] space-y-1.5">
                        {c.categoryLabel && (
                          <span className="inline-block px-2 py-0.5 rounded bg-accent/15 text-accent text-[10px] font-semibold">
                            {c.categoryLabel}
                          </span>
                        )}
                        {c.title && <div className="font-semibold text-white">{c.title}</div>}
                        {c.description && (
                          <div
                            className="pronote-html"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(c.description) }}
                          />
                        )}
                        {c.files.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {c.files.map((f) => (
                              <button
                                key={f.id}
                                onClick={() => openExternalUrl(f.url)}
                                className="px-2.5 py-1 rounded-lg bg-white/[0.06] text-[11px] text-zinc-200 inline-flex items-center gap-1"
                              >
                                <Paperclip className="w-3 h-3 text-accent" />
                                {f.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  ) : !loadingDetails ? (
                    <p className="text-zinc-500">Aucun contenu renseigné pour ce cours.</p>
                  ) : null}

                  {(details?.assignments.length ?? 0) > 0 && (
                    <div className="space-y-2 pt-2">
                      <div className="text-[11px] font-bold uppercase text-emerald-400">
                        Devoirs liés
                      </div>
                      {details!.assignments.map((a) => {
                        const live = homework.find((h) => h.id === a.id) ?? a;
                        return (
                          <div key={live.id} className="p-2.5 rounded-xl bg-[#161622] flex items-start gap-2">
                            <button onClick={() => onToggleHomework(live.id, !live.done)}>
                              {live.done ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Circle className="w-4 h-4 text-zinc-400" />
                              )}
                            </button>
                            <div
                              className="pronote-html flex-1"
                              dangerouslySetInnerHTML={{ __html: sanitizeHtml(live.description) }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ================= HOMEWORK ================= */
export const MobileHomework: React.FC<{
  homework: HomeworkDTO[];
  onToggleDone: (id: string, done: boolean) => void;
}> = ({ homework, onToggleDone }) => {
  const [filter, setFilter] = useState<'todo' | 'done' | 'all'>('todo');
  const grouped = useMemo(() => {
    const filtered = homework.filter((h) =>
      filter === 'todo' ? !h.done : filter === 'done' ? h.done : true
    );
    const map = new Map<string, { deadline: string; items: HomeworkDTO[] }>();
    for (const h of filtered) {
      const k = toDateKey(h.deadline);
      if (!map.has(k)) map.set(k, { deadline: h.deadline, items: [] });
      map.get(k)!.items.push(h);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [homework, filter]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">Devoirs</h1>
        <div className="p-1 rounded-xl bg-[#0D0D13] border border-white/[0.06] flex gap-1 text-[11px]">
          {(['todo', 'done', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-lg font-semibold ${
                filter === f ? 'bg-accent text-black' : 'text-zinc-400'
              }`}
            >
              {f === 'todo' ? 'À faire' : f === 'done' ? 'Faits' : 'Tous'}
            </button>
          ))}
        </div>
      </div>

      <MobileRightToDisconnectNote />

      {grouped.length === 0 ? (
        <div className="rounded-2xl bg-[#0D0D13] border border-white/[0.06] py-14 text-center text-xs text-zinc-500">
          Aucun devoir dans cette catégorie.
        </div>
      ) : (
        grouped.map((g) => (
          <div key={g.deadline} className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-accent">
              Pour {formatDateRelative(g.deadline)}
            </div>
            {g.items.map((hw) => (
              <div
                key={hw.id}
                className={`p-3.5 rounded-2xl border space-y-2 ${
                  hw.done ? 'bg-[#0B0B10] border-white/[0.04] opacity-60' : 'bg-[#101018] border-white/[0.07]'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <button onClick={() => onToggleDone(hw.id, !hw.done)} className="mt-0.5 shrink-0">
                    {hw.done ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-zinc-500" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: normalizeHexColor(hw.backgroundColor) }}
                      />
                      <span className={`text-sm font-bold ${hw.done ? 'line-through text-zinc-400' : 'text-white'}`}>
                        {hw.subject}
                      </span>
                    </div>
                    <div
                      className="pronote-html mt-1.5"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(hw.description) }}
                    />
                    {hw.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {hw.attachments.map((att) => (
                          <button
                            key={att.id}
                            onClick={() => openExternalUrl(att.url)}
                            className="px-2.5 py-1 rounded-lg bg-white/[0.06] text-[11px] text-zinc-200 inline-flex items-center gap-1"
                          >
                            {att.kind === 'link' ? (
                              <ExternalLink className="w-3 h-3 text-accent" />
                            ) : (
                              <Paperclip className="w-3 h-3 text-accent" />
                            )}
                            {att.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
};

/* ================= GRADES + SIMULATOR ================= */
export const MobileGrades: React.FC<{
  grades: GradesOverviewDTO | null;
  periods: PeriodDTO[];
  selectedPeriodId: string;
  onSelectPeriod: (id: string) => void;
}> = ({ grades, periods, selectedPeriodId, onSelectPeriod }) => {
  const [simOpen, setSimOpen] = useState(false);
  const [sims, setSims] = useState<Array<{ id: string; subjectId: string; subject: string; val: number; outOf: number; coef: number }>>([]);
  const [simSub, setSimSub] = useState('');
  const [simVal, setSimVal] = useState('16');
  const [simOut, setSimOut] = useState('20');

  const computed = useMemo(() => {
    const subjects = (grades?.subjectsAverages ?? []).map((sa) => {
      const real = (grades?.grades ?? []).filter((g) => g.subjectId === sa.subjectId);
      const extra = sims.filter((s) => s.subjectId === sa.subjectId);
      let avg = sa.student;
      if (extra.length > 0) {
        let sum = 0;
        let coef = 0;
        for (const g of real) {
          if (g.value.kind === 0 && g.outOf > 0) {
            sum += (g.value.points / g.outOf) * 20 * (g.coefficient || 1);
            coef += g.coefficient || 1;
          }
        }
        if (coef === 0 && sa.student !== undefined) {
          sum = sa.student;
          coef = 1;
        }
        for (const e of extra) {
          sum += (e.val / e.outOf) * 20 * e.coef;
          coef += e.coef;
        }
        avg = coef > 0 ? sum / coef : sa.student;
      }
      return { ...sa, real, avg };
    });

    const avgs = subjects.map((s) => s.avg).filter((v): v is number => v !== undefined);
    const overall =
      sims.length > 0 && avgs.length > 0
        ? avgs.reduce((a, b) => a + b, 0) / avgs.length
        : grades?.overallAverage;
    return { subjects, overall };
  }, [grades, sims]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-white">Notes</h1>
        <div className="flex items-center gap-2">
          {periods.length > 0 && (
            <select
              value={selectedPeriodId}
              onChange={(e) => {
                setSims([]);
                onSelectPeriod(e.target.value);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-[#0F0F16] border border-white/[0.08] text-xs text-white"
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setSimOpen((v) => !v)}
            className={`p-2 rounded-xl border ${
              simOpen || sims.length > 0
                ? 'bg-accent/20 border-accent/40 text-accent'
                : 'bg-[#0F0F16] border-white/[0.08] text-zinc-300'
            }`}
          >
            <Calculator className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Overall Card */}
      <MobileRightToDisconnectNote />

      <div className="p-4 rounded-2xl bg-[#0E0E15] border border-white/[0.07] flex items-center justify-between">
        <div>
          <div className="text-xs text-zinc-400">
            {sims.length > 0 ? 'Moyenne simulée' : 'Moyenne générale'}
          </div>
          <div className="text-3xl font-extrabold tabular-nums mt-0.5">
            <span
              className={
                computed.overall !== undefined ? getGradeColorClass(computed.overall) : 'text-white'
              }
            >
              {formatGradeNumber(computed.overall)}
            </span>
            <span className="text-sm text-zinc-500 font-normal"> /20</span>
          </div>
        </div>
        <div className="text-right text-xs text-zinc-400">
          <div>Classe : {formatGradeNumber(grades?.classAverage)}/20</div>
          <div className="text-zinc-500 mt-0.5">{grades?.grades.length ?? 0} notes</div>
        </div>
      </div>

      {simOpen && (
        <div className="p-3.5 rounded-2xl bg-[#11111C] border border-accent/30 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-accent flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Simulateur de note
            </span>
            {sims.length > 0 && (
              <button onClick={() => setSims([])} className="text-rose-400">
                Effacer
              </button>
            )}
          </div>
          <select
            value={simSub || computed.subjects[0]?.subjectId || ''}
            onChange={(e) => setSimSub(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-[#09090F] border border-white/[0.08] text-xs text-white"
          >
            {computed.subjects.map((s) => (
              <option key={s.subjectId} value={s.subjectId}>
                {s.subject}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              value={simVal}
              onChange={(e) => setSimVal(e.target.value)}
              placeholder="Note"
              className="w-20 px-2 py-2 rounded-xl bg-[#09090F] border border-white/[0.08] text-xs text-center text-white"
            />
            <input
              value={simOut}
              onChange={(e) => setSimOut(e.target.value)}
              placeholder="/20"
              className="w-20 px-2 py-2 rounded-xl bg-[#09090F] border border-white/[0.08] text-xs text-center text-white"
            />
            <button
              onClick={() => {
                const sub =
                  computed.subjects.find((s) => s.subjectId === simSub) || computed.subjects[0];
                const v = parseFloat(simVal.replace(',', '.'));
                const o = parseFloat(simOut.replace(',', '.'));
                if (!sub || Number.isNaN(v) || Number.isNaN(o) || o <= 0) return;
                setSims((p) => [
                  ...p,
                  { id: `${Date.now()}`, subjectId: sub.subjectId, subject: sub.subject, val: v, outOf: o, coef: 1 },
                ]);
              }}
              className="flex-1 rounded-xl bg-accent text-black text-xs font-bold flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Ajouter
            </button>
          </div>
          {sims.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sims.map((s) => (
                <span key={s.id} className="px-2 py-1 rounded-lg bg-accent/15 text-[11px] text-white inline-flex items-center gap-1.5">
                  {s.subject}: {s.val}/{s.outOf}
                  <button onClick={() => setSims((p) => p.filter((x) => x.id !== s.id))}>
                    <Trash2 className="w-3 h-3 text-rose-400" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Subjects */}
      <div className="space-y-2.5">
        {computed.subjects.map((sa) => (
          <div key={sa.subjectId} className="rounded-2xl bg-[#0D0D14] border border-white/[0.06] overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: normalizeHexColor(sa.backgroundColor) }}
                />
                <span className="text-sm font-semibold text-white truncate">{sa.subject}</span>
              </div>
              <div className="text-sm font-bold tabular-nums shrink-0">
                <span className={sa.avg !== undefined ? getGradeColorClass(sa.avg) : 'text-zinc-400'}>
                  {formatGradeNumber(sa.avg)}
                </span>
                <span className="text-xs text-zinc-500">/{sa.outOf}</span>
              </div>
            </div>
            {sa.real.length > 0 && (
              <div className="border-t border-white/[0.05] divide-y divide-white/[0.04] bg-[#09090E]">
                {sa.real.map((g) => (
                  <div key={g.id} className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="text-zinc-200 truncate">{g.comment || 'Évaluation'}</div>
                      <div className="text-[10.5px] text-zinc-500">
                        {formatDateShort(g.date)} · Coeff {g.coefficient}
                        {g.average !== undefined ? ` · Classe ${formatGradeNumber(g.average)}` : ''}
                      </div>
                    </div>
                    <div className="font-bold tabular-nums shrink-0">
                      <span
                        className={
                          g.value.kind === 0
                            ? getGradeColorClass((g.value.points / (g.outOf || 20)) * 20)
                            : 'text-zinc-400'
                        }
                      >
                        {g.value.label}
                      </span>
                      {g.value.kind === 0 && <span className="text-[10.5px] text-zinc-500">/{g.outOf}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ================= ATTENDANCE ================= */
export const MobileAttendance: React.FC<{
  attendance: AttendanceDTO | null;
  periods: PeriodDTO[];
  selectedPeriodId: string;
  onSelectPeriod: (id: string) => void;
}> = ({ attendance, periods, selectedPeriodId, onSelectPeriod }) => (
  <div className="p-4 space-y-4">
    <div className="flex items-center justify-between">
      <h1 className="text-lg font-bold text-white">Vie scolaire</h1>
      {periods.length > 0 && (
        <select
          value={selectedPeriodId}
          onChange={(e) => onSelectPeriod(e.target.value)}
          className="px-2.5 py-1.5 rounded-xl bg-[#0F0F16] border border-white/[0.08] text-xs text-white"
        >
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
    </div>

    <div className="grid grid-cols-2 gap-2.5 text-xs">
      <div className="p-3.5 rounded-2xl bg-[#0E0E15] border border-white/[0.06]">
        <div className="text-zinc-400">Absences</div>
        <div className="text-xl font-bold text-rose-400 mt-1">{attendance?.absences.length ?? 0}</div>
      </div>
      <div className="p-3.5 rounded-2xl bg-[#0E0E15] border border-white/[0.06]">
        <div className="text-zinc-400">Retards</div>
        <div className="text-xl font-bold text-amber-400 mt-1">{attendance?.delays.length ?? 0}</div>
      </div>
    </div>

    {(attendance?.absences ?? []).map((a) => (
      <div key={a.id} className="p-3.5 rounded-2xl bg-[#0E0E15] border border-white/[0.06] text-xs space-y-1">
        <div className="flex justify-between gap-2">
          <span className="font-semibold text-white">{formatDateShort(a.startDate)}</span>
          <span className={a.justified ? 'text-emerald-400' : 'text-rose-400'}>
            {a.justified ? 'Justifiée' : 'Non justifiée'}
          </span>
        </div>
        <div className="text-zinc-400">
          {a.reason || 'Absence'} · {formatDurationMinutes(a.hoursMissed * 60 + a.minutesMissed)}
        </div>
      </div>
    ))}

    {(attendance?.delays ?? []).map((d) => (
      <div key={d.id} className="p-3.5 rounded-2xl bg-[#0E0E15] border border-white/[0.06] text-xs space-y-1">
        <div className="flex justify-between gap-2">
          <span className="font-semibold text-white">Retard · {d.minutes} min</span>
          <span className={d.justified ? 'text-emerald-400' : 'text-amber-400'}>
            {d.justified ? 'Justifié' : 'Non justifié'}
          </span>
        </div>
        <div className="text-zinc-400">{formatDateShort(d.date)} · {d.reason || d.justification || 'Non précisé'}</div>
      </div>
    ))}
  </div>
);

/* ================= INFOS, SONDAGES & DISCUSSIONS ================= */
export const MobileMessages: React.FC<{
  news: NewsItemDTO[];
  discussions: DiscussionSummaryDTO[];
  messagingDisabled?: boolean;
  onNewsDetailLoaded?: (item: NewsItemDTO) => void;
  onRefresh: () => Promise<void>;
}> = ({ news, discussions, messagingDisabled = false, onNewsDetailLoaded, onRefresh }) => {
  const [sub, setSub] = useState<'news' | 'discussions'>('news');
  const [openNews, setOpenNews] = useState<NewsItemDTO | null>(null);
  const [loadingNewsDetail, setLoadingNewsDetail] = useState(false);
  const [openDisc, setOpenDisc] = useState<DiscussionSummaryDTO | null>(null);
  const [thread, setThread] = useState<DiscussionThreadDTO | null>(null);
  const [reply, setReply] = useState('');
  const [surveyDrafts, setSurveyDrafts] = useState<Record<string, { selectedAnswers?: number[]; textInputAnswer?: string }>>({});

  useEffect(() => {
    if (!openDisc) return;
    mobilePronote.getDiscussionMessages(openDisc.id).then(setThread).catch(() => setThread(null));
  }, [openDisc?.id]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">Infos & Messages</h1>
        <div className="p-1 rounded-xl bg-[#0D0D13] border border-white/[0.06] flex gap-1 text-xs">
          <button
            onClick={() => setSub('news')}
            className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1 ${
              sub === 'news' ? 'bg-accent text-black' : 'text-zinc-400'
            }`}
          >
            <Bell className="w-3.5 h-3.5" /> Infos
          </button>
          <button
            onClick={() => setSub('discussions')}
            className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1 ${
              sub === 'discussions' ? 'bg-accent text-black' : 'text-zinc-400'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" /> Messages
          </button>
        </div>
      </div>

      <MobileRightToDisconnectNote serverDisabled={messagingDisabled} />

      {sub === 'news' ? (
        news.length === 0 ? (
          <div className="py-14 text-center text-xs text-zinc-500">Aucune info ou sondage.</div>
        ) : (
          <div className="space-y-2.5">
            {news.map((item) => (
              <button
                key={item.id}
                onClick={async () => {
                  setOpenNews(item);
                  let active = item;
                  if (item.needsDetail) {
                    setLoadingNewsDetail(true);
                    try {
                      const full = await mobilePronote.getNewsDetail(item.id);
                      if (full) {
                        active = full;
                        setOpenNews(full);
                        onNewsDetailLoaded?.(full);
                      }
                    } finally {
                      setLoadingNewsDetail(false);
                    }
                  }
                  if (!active.read) {
                    onNewsDetailLoaded?.({ ...active, read: true });
                    mobilePronote.markNewsRead(active.id).catch(() => {});
                  }
                  if (active.is === 'survey' && active.questions) {
                    const init: Record<string, { selectedAnswers?: number[]; textInputAnswer?: string }> = {};
                    for (const q of active.questions) {
                      init[q.id] = { selectedAnswers: q.selectedAnswers ?? [], textInputAnswer: q.textInputAnswer ?? '' };
                    }
                    setSurveyDrafts(init);
                  }
                }}
                className="w-full p-3.5 rounded-2xl bg-[#0F0F17] border border-white/[0.06] text-left space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {!item.read && <span className="w-2 h-2 rounded-full bg-accent shrink-0" />}
                    <span className="text-sm font-bold text-white truncate">{item.title}</span>
                  </div>
                  <span className="text-[10.5px] text-zinc-500 shrink-0">
                    {formatDateRelative(item.creationDate)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="truncate">{item.author}</span>
                  <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-[10px]">
                    {item.is === 'survey' ? 'Sondage' : item.category}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-2.5">
          {discussions.length === 0 ? (
            <div className="py-14 text-center text-xs text-zinc-500">Aucune discussion.</div>
          ) : (
            discussions.map((d) => (
              <button
                key={d.id}
                onClick={() => setOpenDisc(d)}
                className="w-full p-3.5 rounded-2xl bg-[#0F0F17] border border-white/[0.06] text-left space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-white truncate">{d.subject}</span>
                  <span className="text-[10.5px] text-zinc-500 shrink-0">{formatDateRelative(d.date)}</span>
                </div>
                <div className="text-xs text-zinc-400 truncate">{d.creator}</div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Open News / Survey Modal */}
      {openNews && (
        <div className="fixed inset-0 z-50 bg-[#060608] flex flex-col safe-top safe-bottom">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-white truncate">{openNews.title}</h2>
            <button onClick={() => setOpenNews(null)} className="p-1.5 text-zinc-400">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="text-xs text-zinc-400">
              {openNews.author} · {formatDateFull(openNews.creationDate)}
            </div>
            {loadingNewsDetail ? (
              <div className="flex items-center gap-2 text-xs text-zinc-400 py-4">
                <Loader2 className="w-4 h-4 text-accent animate-spin" />
                Chargement du message…
              </div>
            ) : openNews.is === 'information' ? (
              <>
                <div
                  className="pronote-html"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(openNews.content) }}
                />
                {openNews.needToAcknowledge && !openNews.acknowledged && (
                  <button
                    onClick={async () => {
                      await mobilePronote.acknowledgeNews(openNews.id);
                      await onRefresh();
                      setOpenNews(null);
                    }}
                    className="w-full py-2.5 rounded-xl bg-accent text-black text-xs font-bold"
                  >
                    J'ai pris connaissance
                  </button>
                )}
              </>
            ) : (
              <div className="space-y-3">
                {(openNews.questions ?? []).map((q) => {
                  const d = surveyDrafts[q.id] ?? { selectedAnswers: [], textInputAnswer: '' };
                  return (
                    <div key={q.id} className="p-3.5 rounded-xl bg-[#101018] border border-white/[0.06] space-y-2.5">
                      <div className="text-xs font-bold text-white">{q.fullTitle || q.title}</div>
                      {q.content && (
                        <div className="pronote-html" dangerouslySetInnerHTML={{ __html: sanitizeHtml(q.content) }} />
                      )}
                      {q.choices.map((c) => {
                        const sel = (d.selectedAnswers ?? []).includes(c.position);
                        return (
                          <button
                            key={c.position}
                            onClick={() =>
                              setSurveyDrafts((prev) => ({
                                ...prev,
                                [q.id]: {
                                  ...prev[q.id],
                                  selectedAnswers:
                                    q.kind === 2
                                      ? [c.position]
                                      : sel
                                      ? (prev[q.id]?.selectedAnswers ?? []).filter((x) => x !== c.position)
                                      : [...(prev[q.id]?.selectedAnswers ?? []), c.position],
                                },
                              }))
                            }
                            className={`w-full p-2.5 rounded-xl border text-left text-xs flex items-center gap-2 ${
                              sel ? 'bg-accent/15 border-accent text-white' : 'bg-[#09090E] border-white/[0.06] text-zinc-300'
                            }`}
                          >
                            <Check className={`w-3.5 h-3.5 ${sel ? 'text-accent' : 'opacity-20'}`} />
                            {c.value}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
                <button
                  onClick={async () => {
                    await mobilePronote.answerSurvey(
                      openNews.id,
                      (openNews.questions ?? []).map((q) => ({
                        questionId: q.id,
                        selectedAnswers: surveyDrafts[q.id]?.selectedAnswers,
                        textInputAnswer: surveyDrafts[q.id]?.textInputAnswer,
                      }))
                    );
                    await onRefresh();
                    setOpenNews(null);
                  }}
                  className="w-full py-2.5 rounded-xl bg-accent text-black text-xs font-bold"
                >
                  Valider mes réponses
                </button>
              </div>
            )}
            {openNews.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {openNews.attachments.map((att) => (
                  <button
                    key={att.id}
                    onClick={() => openExternalUrl(att.url)}
                    className="px-3 py-1.5 rounded-xl bg-white/[0.06] text-xs text-zinc-200 inline-flex items-center gap-1.5"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-accent" />
                    {att.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Open Discussion Thread */}
      {openDisc && (
        <div className="fixed inset-0 z-50 bg-[#060608] flex flex-col safe-top safe-bottom">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-white truncate">{openDisc.subject}</h2>
            <button onClick={() => setOpenDisc(null)} className="p-1.5 text-zinc-400">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {(thread?.messages ?? []).map((m) => (
              <div
                key={m.id}
                className={`p-3 rounded-2xl border max-w-[88%] ${
                  m.isSelf ? 'ml-auto bg-accent/15 border-accent/25' : 'bg-[#12121B] border-white/[0.06]'
                }`}
              >
                <div className="text-[10.5px] text-zinc-400 mb-1">{m.authorName}</div>
                <div className="pronote-html" dangerouslySetInnerHTML={{ __html: sanitizeHtml(m.content) }} />
              </div>
            ))}
          </div>
          {thread?.canReply && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!reply.trim()) return;
                await mobilePronote.sendDiscussionReply(openDisc.id, reply.trim());
                setReply('');
                setThread(await mobilePronote.getDiscussionMessages(openDisc.id));
              }}
              className="p-3 border-t border-white/[0.06] flex gap-2"
            >
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Répondre…"
                className="flex-1 px-3 py-2 rounded-xl bg-[#13131C] border border-white/[0.08] text-xs text-white"
              />
              <button type="submit" className="px-3.5 rounded-xl bg-accent text-black">
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

/* ================= MENUS (MIDI vs SOIR INTERNAT) ================= */
const MobileMealCard: React.FC<{ kind: 'lunch' | 'dinner'; meal?: MealDTO }> = ({ kind, meal }) => {
  const isLunch = kind === 'lunch';
  const courses = meal
    ? [
        { label: 'Entrée', items: meal.entry },
        { label: 'Plat', items: meal.main },
        { label: 'Accompagnement', items: meal.side },
        { label: 'Fromage', items: meal.fromage },
        { label: 'Dessert', items: meal.dessert },
      ].filter((c) => c.items.length > 0)
    : [];
  return (
    <div
      className={`p-3.5 rounded-2xl border space-y-2.5 ${
        isLunch
          ? 'bg-amber-500/[0.05] border-amber-500/20'
          : 'bg-accent/[0.06] border-accent/25'
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-bold text-white">
        {isLunch ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-accent" />}
        <span>{isLunch ? 'Midi (Déjeuner)' : 'Soir · Internat (Dîner)'}</span>
      </div>
      {courses.length === 0 ? (
        <div className="text-xs text-zinc-500">Aucun menu renseigné.</div>
      ) : (
        courses.map((c) => (
          <div key={c.label} className="text-xs">
            <div className="text-[10px] uppercase text-zinc-500 font-semibold">{c.label}</div>
            {c.items.map((f, i) => (
              <div key={i} className="text-zinc-100">
                {f.name}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
};

export const MobileMenus: React.FC<{
  menus: MenuDayDTO[];
  selectedDate: Date;
  onChangeDate: (d: Date) => void;
}> = ({ menus, selectedDate, onChangeDate }) => {
  const [filter, setFilter] = useState<'both' | 'lunch' | 'dinner'>('both');
  const hasDinner = menus.some((d) => Boolean(d.dinner));

  const shift = (delta: number) => {
    const n = new Date(selectedDate);
    n.setDate(n.getDate() + delta * 7);
    onChangeDate(n);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">Cantine</h1>
        <div className="flex items-center gap-1 bg-[#0F0F16] border border-white/[0.07] rounded-xl p-1">
          <button onClick={() => shift(-1)} className="p-1 text-zinc-400">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => onChangeDate(new Date())} className="px-2 text-[11px] text-zinc-200">
            Sem.
          </button>
          <button onClick={() => shift(1)} className="p-1 text-zinc-400">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#0D0D13] border border-white/[0.06] text-xs">
        <button
          onClick={() => setFilter('both')}
          className={`py-1.5 rounded-lg font-semibold ${filter === 'both' ? 'bg-accent text-black' : 'text-zinc-400'}`}
        >
          Midi & Soir
        </button>
        <button
          onClick={() => setFilter('lunch')}
          className={`py-1.5 rounded-lg font-semibold ${filter === 'lunch' ? 'bg-amber-400 text-black' : 'text-zinc-400'}`}
        >
          Midi
        </button>
        <button
          onClick={() => setFilter('dinner')}
          className={`py-1.5 rounded-lg font-semibold ${filter === 'dinner' ? 'bg-accent text-black' : 'text-zinc-400'}`}
        >
          Soir (Internat)
        </button>
      </div>

      {menus.length === 0 ? (
        <div className="py-14 text-center text-xs text-zinc-500">Aucun menu cette semaine.</div>
      ) : (
        menus.map((day) => (
          <div key={day.date} className="space-y-2.5">
            <div className="text-xs font-bold text-zinc-300">{formatDateFull(day.date)}</div>
            {(filter === 'both' || filter === 'lunch') && <MobileMealCard kind="lunch" meal={day.lunch} />}
            {((filter === 'both' && hasDinner) || filter === 'dinner') && (
              <MobileMealCard kind="dinner" meal={day.dinner} />
            )}
          </div>
        ))
      )}
    </div>
  );
};

/* ================= SETTINGS ================= */
export const MobileSettingsView: React.FC<{
  profile: StudentProfile;
  settings: MobileSettings;
  checkingUpdate: boolean;
  updateMsg: string | null;
  onUpdateSettings: (next: MobileSettings) => void;
  onCheckUpdate: () => void;
  onLogout: () => void;
}> = ({ profile, settings, checkingUpdate, updateMsg, onUpdateSettings, onCheckUpdate, onLogout }) => {
  const accents: Array<{ id: AccentTheme; label: string; hex: string }> = [
    { id: 'violet', label: 'Violet', hex: '#8B74FF' },
    { id: 'emerald', label: 'Émeraude', hex: '#10B981' },
    { id: 'cyan', label: 'Cyan', hex: '#22D3EE' },
    { id: 'mono', label: 'Blanc', hex: '#F4F4F5' },
  ];

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-bold text-white">Paramètres</h1>

      <div className="p-4 rounded-2xl bg-[#0D0D14] border border-white/[0.06] space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-white">
          <Palette className="w-4 h-4 text-accent" /> Couleur d'accentuation
        </div>
        <div className="grid grid-cols-4 gap-2">
          {accents.map((a) => (
            <button
              key={a.id}
              onClick={() => onUpdateSettings({ accent: a.id })}
              className={`p-2.5 rounded-xl border text-center ${
                settings.accent === a.id
                  ? 'border-accent bg-white/[0.06]'
                  : 'border-white/[0.06] bg-[#12121A]'
              }`}
            >
              <span className="block w-5 h-5 rounded-full mx-auto mb-1" style={{ backgroundColor: a.hex }} />
              <span className="text-[10.5px] text-zinc-200">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-[#0D0D14] border border-white/[0.06] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <DownloadCloud className="w-4 h-4 text-accent" /> Noctis Android v{getAppVersion()}
          </div>
          <button
            onClick={onCheckUpdate}
            disabled={checkingUpdate}
            className="px-3 py-1.5 rounded-xl bg-accent/15 text-accent text-xs font-semibold inline-flex items-center gap-1"
          >
            {checkingUpdate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Vérifier
          </button>
        </div>
        {updateMsg && <div className="text-xs text-emerald-300">{updateMsg}</div>}
      </div>

      <div className="p-4 rounded-2xl bg-[#0D0D14] border border-white/[0.06] space-y-3">
        <div className="text-xs text-white font-semibold">{profile.name} · {profile.className}</div>
        <div className="text-[11px] text-zinc-400">{profile.establishmentName}</div>
        <button
          onClick={onLogout}
          className="w-full py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" /> Se déconnecter
        </button>
      </div>
    </div>
  );
};
