import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  MapPin,
  User,
  Users,
  Video,
  X,
  AlertCircle,
  Loader2,
  BookOpen,
  Paperclip,
  ExternalLink,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  UtensilsCrossed,
  Coffee,
  Sparkles,
} from 'lucide-react';
import type {
  HomeworkDTO,
  LessonDetailsDTO,
  TimetableItemDTO,
  TimetableResponse,
} from '@shared/types';
import {
  formatDateFull,
  formatDateRelative,
  formatDurationMinutes,
  formatTime,
  isSameDay,
  normalizeHexColor,
  sanitizeHtml,
} from '@/utils/format';
import {
  computeDayBreaks,
  getInitialSchoolDate,
  getLessonTemporalState,
  getMondayOfWeek,
  getNextSchoolDay,
  getPrevSchoolDay,
  isWeekend,
} from '@/utils/schoolTime';

interface TimetableViewProps {
  timetable: TimetableResponse | null;
  homework: HomeworkDTO[];
  selectedDate: Date;
  loading: boolean;
  autoAdvanceNote?: string | null;
  onChangeDate: (date: Date) => void;
  onToggleHomework: (id: string, done: boolean) => void;
}

interface PopoverState {
  item: TimetableItemDTO;
  rect: { top: number; left: number; right: number; bottom: number; width: number; height: number };
}

const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
const HOUR_HEIGHT = 74;
const POPOVER_WIDTH = 390;

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

export const TimetableView: React.FC<TimetableViewProps> = ({
  timetable,
  homework,
  selectedDate,
  loading,
  autoAdvanceNote,
  onChangeDate,
  onToggleHomework,
}) => {
  const [now, setNow] = useState(() => new Date());
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [viewMode, setViewMode] = useState<'week' | 'day'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'day' : 'week'
  );
  const [lessonCache, setLessonCache] = useState<Record<string, LessonDetailsDTO | null>>({});
  const [loadingDetails, setLoadingDetails] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Tick every 30s so active/past courses and current time line stay live
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Close popover on Escape or outside click
  useEffect(() => {
    if (!popover) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopover(null);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement | null;
        if (!target?.closest('[data-timetable-card="true"]')) {
          setPopover(null);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [popover]);

  // Fetch rich lesson content & linked assignments when clicking a course
  useEffect(() => {
    const resId = popover?.item.lessonResourceID;
    if (!resId) {
      setLoadingDetails(false);
      return;
    }
    if (resId in lessonCache) {
      setLoadingDetails(false);
      return;
    }

    let cancelled = false;
    setLoadingDetails(true);
    window.pronoteAPI.data
      .getLessonDetails(resId)
      .then((details) => {
        if (!cancelled) {
          setLessonCache((prev) => ({ ...prev, [resId]: details }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLessonCache((prev) => ({ ...prev, [resId]: null }));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });

    return () => {
      cancelled = true;
    };
  }, [popover?.item.lessonResourceID, lessonCache]);

  const effectiveDate = useMemo(
    () => (isWeekend(selectedDate) ? getNextSchoolDay(selectedDate) : selectedDate),
    [selectedDate]
  );

  const monday = useMemo(() => getMondayOfWeek(effectiveDate), [effectiveDate]);

  // Always Monday -> Friday (no Saturday / Sunday clutter!)
  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }, (_, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      return d;
    });
  }, [monday]);

  const { startHour, endHour } = useMemo(() => {
    let minH = 8;
    let maxH = 18;
    for (const item of timetable?.items ?? []) {
      const s = new Date(item.startDate);
      const e = new Date(item.endDate);
      minH = Math.min(minH, s.getHours());
      maxH = Math.max(maxH, e.getHours() + (e.getMinutes() > 0 ? 1 : 0));
    }
    return { startHour: Math.max(7, minH), endHour: Math.min(21, maxH) };
  }, [timetable]);

  const hours = useMemo(
    () => Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i),
    [startHour, endHour]
  );

  const shiftWeek = (deltaWeeks: number) => {
    setPopover(null);
    const next = new Date(effectiveDate);
    next.setDate(next.getDate() + deltaWeeks * 7);
    onChangeDate(next);
  };

  const shiftDay = (deltaDays: number) => {
    setPopover(null);
    onChangeDate(deltaDays > 0 ? getNextSchoolDay(effectiveDate) : getPrevSchoolDay(effectiveDate));
  };

  const goToday = () => {
    setPopover(null);
    onChangeDate(getInitialSchoolDate(new Date()));
  };

  const nowMinutesFromStart = (now.getHours() - startHour) * 60 + now.getMinutes();
  const showNowLine =
    nowMinutesFromStart >= 0 && nowMinutesFromStart <= (endHour - startHour) * 60;

  const displayedDays = viewMode === 'week' ? weekDays : [effectiveDate];
  const todayVisibleInGrid = displayedDays.some((d) => isSameDay(d, now));

  const layoutDayItems = (items: TimetableItemDTO[]) => {
    const sorted = [...items].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
    const columns: TimetableItemDTO[][] = [];
    const placement = new Map<string, { col: number; totalCols: number }>();

    const groups: TimetableItemDTO[][] = [];
    for (const item of sorted) {
      const itemStart = new Date(item.startDate).getTime();
      let placedGroup = false;
      for (const grp of groups) {
        const grpEnd = Math.max(...grp.map((g) => new Date(g.endDate).getTime()));
        if (itemStart < grpEnd) {
          grp.push(item);
          placedGroup = true;
          break;
        }
      }
      if (!placedGroup) groups.push([item]);
    }

    for (const grp of groups) {
      columns.length = 0;
      for (const item of grp) {
        const start = new Date(item.startDate).getTime();
        let colIdx = columns.findIndex(
          (col) => new Date(col[col.length - 1].endDate).getTime() <= start
        );
        if (colIdx === -1) {
          colIdx = columns.length;
          columns.push([item]);
        } else {
          columns[colIdx].push(item);
        }
        placement.set(item.id, { col: colIdx, totalCols: 1 });
      }
      for (const item of grp) {
        const prev = placement.get(item.id)!;
        placement.set(item.id, { col: prev.col, totalCols: columns.length });
      }
    }

    return sorted.map((item) => ({
      item,
      ...(placement.get(item.id) ?? { col: 0, totalCols: 1 }),
    }));
  };

  const handleCardClick = (e: React.MouseEvent<HTMLButtonElement>, item: TimetableItemDTO) => {
    if (popover?.item.id === item.id) {
      setPopover(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    setPopover({
      item,
      rect: {
        top: r.top,
        left: r.left,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      },
    });
  };

  const popoverPosition = useMemo(() => {
    if (!popover) return null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(POPOVER_WIDTH, vw - 24);
    const maxHeight = Math.min(540, vh - 80);

    if (vw < 640) {
      return {
        left: Math.round((vw - width) / 2),
        top: Math.max(56, Math.round((vh - Math.min(maxHeight, 440)) / 2)),
        width,
        maxHeight: Math.min(maxHeight, vh - 96),
        side: 'right' as const,
      };
    }

    const margin = 12;
    const canPlaceRight = popover.rect.right + margin + width <= vw - 12;
    const side: 'right' | 'left' = canPlaceRight ? 'right' : 'left';
    const left =
      side === 'right'
        ? popover.rect.right + margin
        : Math.max(12, popover.rect.left - width - margin);

    const idealTop = popover.rect.top - 8;
    const top = Math.max(54, Math.min(vh - maxHeight - 16, idealTop));

    return { left, top, width, maxHeight, side };
  }, [popover]);

  const popoverDetails = popover?.item.lessonResourceID
    ? lessonCache[popover.item.lessonResourceID] ?? null
    : null;

  const relatedHomework = useMemo(() => {
    if (!popover) return [];
    const seen = new Set<string>();
    const list: HomeworkDTO[] = [];

    for (const a of popoverDetails?.assignments ?? []) {
      const liveMatch = homework.find((h) => h.id === a.id);
      const item = liveMatch ?? a;
      if (!seen.has(item.id)) {
        seen.add(item.id);
        list.push(item);
      }
    }

    const courseDay = new Date(popover.item.startDate);
    const subjectNorm = popover.item.title.trim().toLowerCase();
    for (const h of homework) {
      if (
        !seen.has(h.id) &&
        isSameDay(new Date(h.deadline), courseDay) &&
        h.subject.trim().toLowerCase() === subjectNorm
      ) {
        seen.add(h.id);
        list.push(h);
      }
    }
    return list;
  }, [popover, popoverDetails, homework]);

  return (
    <div className="h-full flex flex-col p-4 sm:p-5 lg:p-6 gap-3.5 animate-fade-in">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-bold text-white tracking-tight">Emploi du temps</h1>
          {timetable?.weekFrequency && (
            <span className="px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-accent/15 text-accent border border-accent/25">
              {timetable.weekFrequency}
            </span>
          )}
          {autoAdvanceNote && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/12 text-emerald-300 border border-emerald-500/25 inline-flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              {autoAdvanceNote}
              {!isWeekend(now) && !isSameDay(effectiveDate, now) && (
                <button
                  onClick={() => onChangeDate(new Date())}
                  className="ml-1 underline underline-offset-2 text-emerald-200 hover:text-white"
                >
                  Voir auj.
                </button>
              )}
            </span>
          )}
          {loading && <Loader2 className="w-4 h-4 text-accent animate-spin" />}
        </div>

        <div className="flex items-center gap-2.5">
          {/* Week / Day Toggle */}
          <div className="p-1 rounded-xl bg-[#0E0E14] border border-white/[0.06] flex items-center text-xs">
            <button
              onClick={() => {
                setPopover(null);
                setViewMode('week');
              }}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                viewMode === 'week'
                  ? 'bg-white/[0.1] text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Semaine
            </button>
            <button
              onClick={() => {
                setPopover(null);
                setViewMode('day');
              }}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                viewMode === 'day'
                  ? 'bg-white/[0.1] text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Jour
            </button>
          </div>

          {/* Date Controls */}
          <div className="flex items-center bg-[#0E0E14] border border-white/[0.06] rounded-xl p-1 gap-1">
            <button
              onClick={() => (viewMode === 'week' ? shiftWeek(-1) : shiftDay(-1))}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              title="Précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goToday}
              className="px-3 py-1 rounded-lg text-xs font-medium text-zinc-200 hover:bg-white/[0.06] flex items-center gap-1.5 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-accent" />
              <span>
                {viewMode === 'week'
                  ? `${monday.toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                    })} – ${weekDays[weekDays.length - 1].toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                    })}`
                  : formatDateFull(effectiveDate.toISOString())}
              </span>
            </button>
            <button
              onClick={() => (viewMode === 'week' ? shiftWeek(1) : shiftDay(1))}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              title="Suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Container */}
      <div className="flex-1 min-h-0 rounded-2xl bg-[#0B0B10] border border-white/[0.06] flex flex-col overflow-hidden">
        {/* Day Headers (Mon - Fri) */}
        <div
          className="grid border-b border-white/[0.07] bg-[#0E0E15] shrink-0 pr-[7px]"
          style={{
            gridTemplateColumns: `64px repeat(${displayedDays.length}, minmax(0, 1fr))`,
          }}
        >
          <div className="h-12 border-r border-white/[0.06] flex items-center justify-center text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            Heure
          </div>
          {displayedDays.map((day, i) => {
            const isToday = isSameDay(day, now);
            const isSelectedDay = isSameDay(day, effectiveDate);
            const weekdayName =
              viewMode === 'week'
                ? DAY_NAMES[i]
                : day.toLocaleDateString('fr-FR', { weekday: 'long' });
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => {
                  onChangeDate(day);
                  if (viewMode === 'week') setPopover(null);
                }}
                className={`h-12 px-2 flex items-center justify-center gap-2 border-r last:border-r-0 border-white/[0.05] transition-colors ${
                  isToday
                    ? 'bg-accent/[0.11]'
                    : isSelectedDay && viewMode === 'week'
                    ? 'bg-white/[0.03]'
                    : 'hover:bg-white/[0.02]'
                }`}
              >
                <span
                  className={`text-xs font-semibold capitalize ${
                    isToday ? 'text-accent' : isSelectedDay ? 'text-white' : 'text-zinc-400'
                  }`}
                >
                  {weekdayName}
                </span>
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold tabular-nums ${
                    isToday
                      ? 'bg-accent text-black shadow-glow'
                      : isSelectedDay
                      ? 'bg-white/[0.12] text-white'
                      : 'text-zinc-300'
                  }`}
                >
                  {day.getDate()}
                </span>
              </button>
            );
          })}
        </div>

        {/* Scrollable PRONOTE-style Grid */}
        <div
          className="flex-1 overflow-y-auto relative"
          onScroll={() => {
            if (popover) setPopover(null);
          }}
        >
          <div
            className="grid relative"
            style={{
              gridTemplateColumns: `64px repeat(${displayedDays.length}, minmax(0, 1fr))`,
              height: `${(endHour - startHour) * HOUR_HEIGHT + 28}px`,
            }}
          >
            {/* Enhanced Time Ruler with crisp HHh00 + :30 ticks + live current time pill */}
            <div className="relative border-r border-white/[0.06] bg-[#09090E] select-none">
              {hours.map((h) => (
                <React.Fragment key={h}>
                  <div
                    className="absolute right-2 text-[11px] font-semibold text-zinc-300 tabular-nums -translate-y-1/2 flex items-baseline"
                    style={{ top: `${(h - startHour) * HOUR_HEIGHT + 14}px` }}
                  >
                    <span>{String(h).padStart(2, '0')}h</span>
                    <span className="text-[9.5px] font-normal text-zinc-500">00</span>
                  </div>
                  {h < endHour && (
                    <div
                      className="absolute right-2 text-[9.5px] text-zinc-600 tabular-nums -translate-y-1/2"
                      style={{ top: `${(h - startHour + 0.5) * HOUR_HEIGHT + 14}px` }}
                    >
                      :30
                    </div>
                  )}
                </React.Fragment>
              ))}

              {todayVisibleInGrid && showNowLine && (
                <div
                  className="absolute right-1 z-30 -translate-y-1/2 px-1.5 py-0.5 rounded-md bg-accent text-black text-[10px] font-extrabold tabular-nums shadow-glow"
                  style={{ top: `${(nowMinutesFromStart / 60) * HOUR_HEIGHT + 14}px` }}
                >
                  {`${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(
                    2,
                    '0'
                  )}`}
                </div>
              )}
            </div>

            {/* Day Columns */}
            {displayedDays.map((day) => {
              const isToday = isSameDay(day, now);
              const dayItems = (timetable?.items ?? []).filter((item) =>
                isSameDay(new Date(item.startDate), day)
              );
              const laidOut = layoutDayItems(dayItems);
              const breaks = computeDayBreaks(dayItems);

              return (
                <div
                  key={day.toISOString()}
                  className={`relative border-r last:border-r-0 border-white/[0.05] ${
                    isToday ? 'bg-accent/[0.025]' : ''
                  }`}
                >
                  {/* Hour & Half-hour Gridlines */}
                  {hours.map((h) => (
                    <React.Fragment key={h}>
                      <div
                        className="absolute left-0 right-0 border-t border-white/[0.06]"
                        style={{ top: `${(h - startHour) * HOUR_HEIGHT + 14}px` }}
                      />
                      {h < endHour && (
                        <div
                          className="absolute left-0 right-0 border-t border-dashed border-white/[0.025]"
                          style={{ top: `${(h - startHour + 0.5) * HOUR_HEIGHT + 14}px` }}
                        />
                      )}
                    </React.Fragment>
                  ))}

                  {/* Lunch Break & Free Gaps (crystal clear visual separation!) */}
                  {breaks.map((b) => {
                    const sMin = (b.startDate.getHours() - startHour) * 60 + b.startDate.getMinutes();
                    const top = (sMin / 60) * HOUR_HEIGHT + 14 + 2;
                    const height = Math.max(26, (b.durationMinutes / 60) * HOUR_HEIGHT - 4);
                    const isLunch = b.kind === 'lunch';
                    const isPastBreak = now.getTime() >= b.endDate.getTime();
                    const isNowBreak =
                      now.getTime() >= b.startDate.getTime() && now.getTime() < b.endDate.getTime();

                    return (
                      <div
                        key={b.id}
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          backgroundImage: isLunch
                            ? 'repeating-linear-gradient(-45deg, rgba(251,191,36,0.09) 0px, rgba(251,191,36,0.09) 6px, rgba(251,191,36,0.02) 6px, rgba(251,191,36,0.02) 12px)'
                            : 'repeating-linear-gradient(-45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 6px, transparent 6px, transparent 12px)',
                        }}
                        className={`absolute left-1 right-1 z-[5] rounded-xl border border-dashed px-2.5 py-1 flex flex-col items-center justify-center text-center pointer-events-none select-none transition-opacity ${
                          isLunch
                            ? isNowBreak
                              ? 'border-amber-400/60 ring-1 ring-amber-400/30'
                              : isPastBreak
                              ? 'border-amber-400/15 opacity-55'
                              : 'border-amber-400/35'
                            : isPastBreak
                            ? 'border-white/[0.04] opacity-45'
                            : 'border-white/[0.08]'
                        }`}
                      >
                        <div
                          className={`flex items-center gap-1.5 text-[11px] font-bold ${
                            isLunch ? 'text-amber-300' : 'text-zinc-400'
                          }`}
                        >
                          {isLunch ? (
                            <UtensilsCrossed className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <Coffee className="w-3 h-3 shrink-0" />
                          )}
                          <span className="truncate">
                            {isLunch ? 'Pause déjeuner' : 'Pause'}
                          </span>
                        </div>
                        {height >= 42 && (
                          <div
                            className={`text-[10px] tabular-nums mt-0.5 ${
                              isLunch ? 'text-amber-200/75' : 'text-zinc-500'
                            }`}
                          >
                            {formatTime(b.startDate.toISOString())} –{' '}
                            {formatTime(b.endDate.toISOString())} ·{' '}
                            {formatDurationMinutes(b.durationMinutes)}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Live Current-Time Line */}
                  {isToday && showNowLine && (
                    <div
                      className="absolute left-0 right-0 z-25 pointer-events-none flex items-center"
                      style={{
                        top: `${(nowMinutesFromStart / 60) * HOUR_HEIGHT + 14}px`,
                      }}
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-accent -ml-1.5 shadow-glow ring-2 ring-accent/30" />
                      <div className="flex-1 h-[2px] bg-accent shadow-glow" />
                    </div>
                  )}

                  {/* Courses */}
                  {laidOut.map(({ item, col, totalCols }) => {
                    const start = new Date(item.startDate);
                    const end = new Date(item.endDate);
                    const startMin = (start.getHours() - startHour) * 60 + start.getMinutes();
                    const durationMin = Math.max(25, (end.getTime() - start.getTime()) / 60_000);
                    const top = (startMin / 60) * HOUR_HEIGHT + 14 + 1;
                    const height = Math.max(36, (durationMin / 60) * HOUR_HEIGHT - 4);
                    const widthPct = 100 / totalCols;
                    const leftPct = col * widthPct;
                    const rawColor = normalizeHexColor(item.backgroundColor);
                    const temporal = getLessonTemporalState(item, now);
                    const isCurrent = temporal.state === 'current';
                    const isPast = temporal.state === 'past';
                    const isSelected = popover?.item.id === item.id;

                    const leftBarColor = item.canceled
                      ? '#f43f5e'
                      : isPast
                      ? '#52525b'
                      : rawColor;

                    const cardStyle: React.CSSProperties = {
                      top: `${top}px`,
                      height: `${height}px`,
                      left: `calc(${leftPct}% + 3px)`,
                      width: `calc(${widthPct}% - 6px)`,
                      borderLeftColor: leftBarColor,
                      ...(isCurrent
                        ? {
                            backgroundColor: hexToRgba(rawColor, 0.17),
                            borderColor: hexToRgba(rawColor, 0.65),
                            borderLeftColor: rawColor,
                            boxShadow: `0 0 22px -6px ${hexToRgba(rawColor, 0.65)}`,
                          }
                        : {}),
                    };

                    return (
                      <button
                        key={item.id}
                        data-timetable-card="true"
                        onClick={(e) => handleCardClick(e, item)}
                        style={cardStyle}
                        className={`absolute rounded-xl border border-l-[4px] px-2.5 py-1.5 text-left overflow-hidden transition-all group flex flex-col justify-between ${
                          isSelected
                            ? 'z-30 ring-2 ring-accent/80 border-accent/60 bg-[#1F1F2E]'
                            : isCurrent
                            ? 'z-20 ring-1 ring-white/20'
                            : 'z-10 hover:z-30'
                        } ${
                          item.canceled
                            ? 'bg-rose-950/30 border-rose-500/25 opacity-75'
                            : isPast
                            ? 'bg-[#101015]/80 border-white/[0.04] opacity-55 hover:opacity-85'
                            : isCurrent || isSelected
                            ? ''
                            : 'bg-[#161622]/95 border-white/[0.08] hover:border-white/[0.2] hover:bg-[#1C1C2B]'
                        }`}
                      >
                        <div className="min-w-0">
                          {/* Crisp Time + Live Status Strip */}
                          <div className="flex items-center justify-between gap-1 text-[10px] tabular-nums mb-0.5">
                            <span
                              className={`font-semibold ${
                                isCurrent
                                  ? 'text-white'
                                  : isPast
                                  ? 'text-zinc-500'
                                  : 'text-zinc-400'
                              }`}
                            >
                              {formatTime(item.startDate)} – {formatTime(item.endDate)}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/40 text-[9px] font-bold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  EN COURS
                                </span>
                              )}
                              {item.lessonResourceID && !item.canceled && !isCurrent && (
                                <span
                                  title="Contenu de cours disponible"
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isPast ? 'bg-zinc-600' : 'bg-accent/80'
                                  }`}
                                />
                              )}
                              {item.test && !item.canceled && (
                                <span
                                  className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                                    isPast
                                      ? 'bg-zinc-800 text-zinc-500'
                                      : 'bg-amber-500/20 text-amber-300'
                                  }`}
                                >
                                  DS
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Subject Title */}
                          <div
                            className={`text-[12px] font-bold leading-tight truncate ${
                              item.canceled
                                ? 'line-through text-zinc-400'
                                : isPast
                                ? 'text-zinc-400'
                                : 'text-white'
                            }`}
                          >
                            {item.title}
                          </div>

                          {/* Room / Status / Teacher */}
                          {height >= 54 && (
                            <div className="mt-0.5 space-y-0.5 text-[10.5px]">
                              {item.canceled || item.status ? (
                                <div
                                  className={`font-semibold truncate ${
                                    item.canceled
                                      ? 'text-rose-300'
                                      : isPast
                                      ? 'text-zinc-500'
                                      : 'text-amber-300'
                                  }`}
                                >
                                  {item.status || 'Cours annulé'}
                                </div>
                              ) : null}
                              {item.classrooms.length > 0 && (
                                <div
                                  className={`truncate font-medium ${
                                    isCurrent
                                      ? 'text-zinc-100'
                                      : isPast
                                      ? 'text-zinc-500'
                                      : 'text-zinc-300'
                                  }`}
                                >
                                  Salle {item.classrooms.join(', ')}
                                  {height < 76 && item.teachers[0] ? ` · ${item.teachers[0]}` : ''}
                                </div>
                              )}
                              {height >= 76 && item.teachers.length > 0 && (
                                <div
                                  className={`truncate ${
                                    isPast ? 'text-zinc-600' : 'text-zinc-400'
                                  }`}
                                >
                                  {item.teachers[0]}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Live Progress Bar for Current Course */}
                        {isCurrent && (
                          <div className="w-full h-1 rounded-full bg-black/40 overflow-hidden mt-1">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${temporal.progressPct}%`,
                                backgroundColor: rawColor,
                              }}
                            />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating Side Popover anchored RIGHT NEXT TO the clicked course */}
      {popover && popoverPosition && (
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: `${popoverPosition.top}px`,
            left: `${popoverPosition.left}px`,
            width: `${popoverPosition.width}px`,
            maxHeight: `${popoverPosition.maxHeight}px`,
          }}
          className="z-50 rounded-2xl bg-[#101018]/98 border border-white/[0.13] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl flex flex-col overflow-hidden animate-slide-up"
        >
          <div
            className="h-1.5 w-full shrink-0"
            style={{
              backgroundColor: popover.item.canceled
                ? '#f43f5e'
                : normalizeHexColor(popover.item.backgroundColor),
            }}
          />

          <div className="px-4 pt-3.5 pb-3 border-b border-white/[0.06] flex items-start justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <h2 className="text-[15.5px] font-bold text-white leading-snug">
                {popover.item.title}
              </h2>
              <div className="flex items-center gap-2 text-[11.5px] text-zinc-400 mt-1 tabular-nums">
                <Clock className="w-3.5 h-3.5 text-accent shrink-0" />
                <span>
                  {formatDateRelative(popover.item.startDate)} ·{' '}
                  {formatTime(popover.item.startDate)} – {formatTime(popover.item.endDate)}
                </span>
                <span className="text-zinc-500">
                  (
                  {formatDurationMinutes(
                    Math.round(
                      (new Date(popover.item.endDate).getTime() -
                        new Date(popover.item.startDate).getTime()) /
                        60_000
                    )
                  )}
                  )
                </span>
              </div>
            </div>
            <button
              onClick={() => setPopover(null)}
              className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.07] shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {(popover.item.canceled ||
              popover.item.status ||
              popover.item.test ||
              popover.item.exempted) && (
              <div className="flex flex-wrap gap-1.5">
                {popover.item.canceled && (
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/25 inline-flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {popover.item.status || 'Cours annulé'}
                  </span>
                )}
                {!popover.item.canceled && popover.item.status && (
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/25">
                    {popover.item.status}
                  </span>
                )}
                {popover.item.test && (
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/25">
                    Devoir surveillé
                  </span>
                )}
                {popover.item.exempted && (
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/25">
                    Dispensé
                  </span>
                )}
              </div>
            )}

            <div className="space-y-2 text-[12.5px]">
              {popover.item.teachers.length > 0 && (
                <div className="flex items-center gap-2.5 text-zinc-200">
                  <User className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span>{popover.item.teachers.join(', ')}</span>
                </div>
              )}
              {popover.item.classrooms.length > 0 && (
                <div className="flex items-center gap-2.5 text-zinc-200">
                  <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span>Salle {popover.item.classrooms.join(', ')}</span>
                </div>
              )}
              {popover.item.groups.length > 0 && (
                <div className="flex items-center gap-2.5 text-zinc-300">
                  <Users className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span>{popover.item.groups.join(', ')}</span>
                </div>
              )}
              {popover.item.notes && (
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-zinc-300">
                  {popover.item.notes}
                </div>
              )}
              {popover.item.virtualClassrooms.length > 0 && (
                <div className="pt-1 space-y-1.5">
                  {popover.item.virtualClassrooms.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => window.pronoteAPI.system.openExternal(url)}
                      className="w-full px-3 py-2 rounded-xl bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Video className="w-3.5 h-3.5" />
                      Rejoindre la classe virtuelle
                    </button>
                  ))}
                </div>
              )}
            </div>

            {popover.item.lessonResourceID && (
              <div className="pt-3 border-t border-white/[0.06] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-accent">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Contenu de la séance</span>
                  </div>
                  {loadingDetails && <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />}
                </div>

                {loadingDetails ? (
                  <div className="space-y-2">
                    <div className="h-4 w-3/4 rounded bg-white/[0.05] animate-pulse" />
                    <div className="h-12 w-full rounded-xl bg-white/[0.04] animate-pulse" />
                  </div>
                ) : popoverDetails && popoverDetails.contents.length > 0 ? (
                  <div className="space-y-2.5">
                    {popoverDetails.contents.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 rounded-xl bg-[#161620] border border-white/[0.06] space-y-2"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          {c.categoryLabel && (
                            <span className="px-2 py-0.5 rounded bg-accent/15 text-accent text-[10px] font-semibold">
                              {c.categoryLabel}
                            </span>
                          )}
                          {c.themes.map((t, ti) => (
                            <span
                              key={ti}
                              className="px-2 py-0.5 rounded bg-white/[0.06] text-zinc-300 text-[10px]"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                        {c.title && (
                          <div className="text-[12.5px] font-semibold text-white leading-snug">
                            {c.title}
                          </div>
                        )}
                        {c.description && (
                          <div
                            className="pronote-html text-[12px]"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(c.description) }}
                          />
                        )}
                        {c.files.length > 0 && (
                          <div className="pt-1.5 flex flex-wrap gap-1.5">
                            {c.files.map((f) => (
                              <button
                                key={f.id}
                                onClick={() => window.pronoteAPI.system.openExternal(f.url)}
                                className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.11] border border-white/[0.08] text-[11px] text-zinc-200 inline-flex items-center gap-1.5 transition-colors"
                              >
                                {f.kind === 'link' ? (
                                  <ExternalLink className="w-3 h-3 text-accent" />
                                ) : (
                                  <Paperclip className="w-3 h-3 text-accent" />
                                )}
                                <span className="max-w-[240px] truncate">{f.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">
                    Aucun contenu renseigné par le professeur pour cette séance.
                  </p>
                )}
              </div>
            )}

            {relatedHomework.length > 0 && (
              <div className="pt-3 border-t border-white/[0.06] space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Travail à faire ({relatedHomework.length})</span>
                </div>
                <div className="space-y-2">
                  {relatedHomework.map((hw) => (
                    <div
                      key={hw.id}
                      className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${
                        hw.done
                          ? 'bg-white/[0.02] border-white/[0.04] opacity-65'
                          : 'bg-[#161620] border-white/[0.07]'
                      }`}
                    >
                      <button
                        onClick={() => onToggleHomework(hw.id, !hw.done)}
                        className="mt-0.5 text-zinc-400 hover:text-accent shrink-0"
                        title={hw.done ? 'Marquer non fait' : 'Marquer fait'}
                      >
                        {hw.done ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-zinc-400 mb-0.5">
                          Pour {formatDateRelative(hw.deadline)}
                        </div>
                        <div
                          className={`pronote-html text-[12px] ${hw.done ? 'line-through' : ''}`}
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(hw.description) }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
