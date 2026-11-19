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

interface TimetableViewProps {
  timetable: TimetableResponse | null;
  homework: HomeworkDTO[];
  selectedDate: Date;
  loading: boolean;
  onChangeDate: (date: Date) => void;
  onToggleHomework: (id: string, done: boolean) => void;
}

interface PopoverState {
  item: TimetableItemDTO;
  rect: { top: number; left: number; right: number; bottom: number; width: number; height: number };
}

const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const HOUR_HEIGHT = 68;
const POPOVER_WIDTH = 390;

export const TimetableView: React.FC<TimetableViewProps> = ({
  timetable,
  homework,
  selectedDate,
  loading,
  onChangeDate,
  onToggleHomework,
}) => {
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [viewMode, setViewMode] = useState<'week' | 'day'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'day' : 'week'
  );
  const [lessonCache, setLessonCache] = useState<Record<string, LessonDetailsDTO | null>>({});
  const [loadingDetails, setLoadingDetails] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

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

  const monday = useMemo(() => {
    const d = new Date(selectedDate);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [selectedDate]);

  const hasSaturdayClasses = useMemo(() => {
    if (!timetable) return false;
    const sat = new Date(monday);
    sat.setDate(monday.getDate() + 5);
    return timetable.items.some((i) => isSameDay(new Date(i.startDate), sat));
  }, [timetable, monday]);

  const weekDays = useMemo(() => {
    const count = hasSaturdayClasses ? 6 : 5;
    return Array.from({ length: count }, (_, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      return d;
    });
  }, [monday, hasSaturdayClasses]);

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
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + deltaWeeks * 7);
    onChangeDate(next);
  };

  const shiftDay = (deltaDays: number) => {
    setPopover(null);
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + deltaDays);
    onChangeDate(next);
  };

  const goToday = () => {
    setPopover(null);
    onChangeDate(new Date());
  };

  const now = new Date();
  const nowMinutesFromStart = (now.getHours() - startHour) * 60 + now.getMinutes();
  const showNowLine =
    nowMinutesFromStart >= 0 && nowMinutesFromStart <= (endHour - startHour) * 60;

  const displayedDays = viewMode === 'week' ? weekDays : [selectedDate];

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

  // Compute smart side-by-side floating popover position (or centered mobile sheet on phones)
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

  // Combine resource-linked assignments + homework matching same subject & day
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
    <div className="h-full flex flex-col p-5 lg:p-6 gap-4 animate-fade-in">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white tracking-tight">Emploi du temps</h1>
          {timetable?.weekFrequency && (
            <span className="px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-accent/15 text-accent border border-accent/25">
              {timetable.weekFrequency}
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
                  : formatDateFull(selectedDate.toISOString())}
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
        {/* Day Headers */}
        <div
          className="grid border-b border-white/[0.06] bg-[#0E0E14] shrink-0 pr-[7px]"
          style={{
            gridTemplateColumns: `56px repeat(${displayedDays.length}, minmax(0, 1fr))`,
          }}
        >
          <div className="h-12 border-r border-white/[0.05]" />
          {displayedDays.map((day, i) => {
            const isToday = isSameDay(day, now);
            const weekdayName =
              viewMode === 'week'
                ? DAY_NAMES[i]
                : day.toLocaleDateString('fr-FR', { weekday: 'long' });
            return (
              <div
                key={day.toISOString()}
                className={`h-12 px-3 flex items-center justify-center gap-2 border-r last:border-r-0 border-white/[0.05] ${
                  isToday ? 'bg-accent/[0.08]' : ''
                }`}
              >
                <span
                  className={`text-xs font-medium capitalize ${
                    isToday ? 'text-accent' : 'text-zinc-400'
                  }`}
                >
                  {weekdayName}
                </span>
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold tabular-nums ${
                    isToday ? 'bg-accent text-black' : 'text-zinc-200'
                  }`}
                >
                  {day.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        {/* Scrollable Grid */}
        <div
          className="flex-1 overflow-y-auto relative"
          onScroll={() => {
            if (popover) setPopover(null);
          }}
        >
          <div
            className="grid relative"
            style={{
              gridTemplateColumns: `56px repeat(${displayedDays.length}, minmax(0, 1fr))`,
              height: `${(endHour - startHour) * HOUR_HEIGHT + 24}px`,
            }}
          >
            {/* Time Ruler */}
            <div className="relative border-r border-white/[0.05] select-none">
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute right-2.5 text-[11px] text-zinc-500 tabular-nums -translate-y-1/2"
                  style={{ top: `${(h - startHour) * HOUR_HEIGHT + 12}px` }}
                >
                  {String(h).padStart(2, '0')}h
                </div>
              ))}
            </div>

            {/* Day Columns */}
            {displayedDays.map((day) => {
              const isToday = isSameDay(day, now);
              const dayItems = (timetable?.items ?? []).filter((item) =>
                isSameDay(new Date(item.startDate), day)
              );
              const laidOut = layoutDayItems(dayItems);

              return (
                <div
                  key={day.toISOString()}
                  className={`relative border-r last:border-r-0 border-white/[0.05] ${
                    isToday ? 'bg-accent/[0.025]' : ''
                  }`}
                >
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-t border-white/[0.04]"
                      style={{ top: `${(h - startHour) * HOUR_HEIGHT + 12}px` }}
                    />
                  ))}

                  {isToday && showNowLine && (
                    <div
                      className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                      style={{
                        top: `${(nowMinutesFromStart / 60) * HOUR_HEIGHT + 12}px`,
                      }}
                    >
                      <div className="w-2 h-2 rounded-full bg-accent -ml-1 shadow-glow" />
                      <div className="flex-1 h-[1.5px] bg-accent/80" />
                    </div>
                  )}

                  {laidOut.map(({ item, col, totalCols }) => {
                    const start = new Date(item.startDate);
                    const end = new Date(item.endDate);
                    const startMin = (start.getHours() - startHour) * 60 + start.getMinutes();
                    const durationMin = Math.max(25, (end.getTime() - start.getTime()) / 60_000);
                    const top = (startMin / 60) * HOUR_HEIGHT + 12;
                    const height = Math.max(32, (durationMin / 60) * HOUR_HEIGHT - 3);
                    const widthPct = 100 / totalCols;
                    const leftPct = col * widthPct;
                    const accentColor = item.canceled
                      ? '#f43f5e'
                      : normalizeHexColor(item.backgroundColor);
                    const isSelected = popover?.item.id === item.id;

                    return (
                      <button
                        key={item.id}
                        data-timetable-card="true"
                        onClick={(e) => handleCardClick(e, item)}
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          left: `calc(${leftPct}% + 3px)`,
                          width: `calc(${widthPct}% - 6px)`,
                          borderLeftColor: accentColor,
                        }}
                        className={`absolute rounded-xl border border-l-[3px] px-2.5 py-1.5 text-left overflow-hidden transition-all group ${
                          isSelected
                            ? 'z-30 ring-2 ring-accent/70 border-accent/50 bg-[#1D1D2B]'
                            : 'z-10 border-white/[0.07] hover:z-30 hover:border-white/[0.18]'
                        } ${
                          item.canceled
                            ? 'bg-rose-950/30 opacity-75'
                            : isSelected
                            ? ''
                            : 'bg-[#15151E]/95 hover:bg-[#1B1B26]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span
                            className={`text-[12px] font-semibold leading-tight line-clamp-2 ${
                              item.canceled ? 'line-through text-zinc-400' : 'text-white'
                            }`}
                          >
                            {item.title}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {item.lessonResourceID && !item.canceled && (
                              <span
                                title="Contenu de cours disponible"
                                className="w-1.5 h-1.5 rounded-full bg-accent/80 mt-1"
                              />
                            )}
                            {item.test && !item.canceled && (
                              <span className="px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                                DS
                              </span>
                            )}
                          </div>
                        </div>

                        {height >= 48 && (
                          <div className="mt-1 space-y-0.5 text-[10.5px] text-zinc-400">
                            {item.canceled || item.status ? (
                              <div
                                className={`font-medium truncate ${
                                  item.canceled ? 'text-rose-300' : 'text-amber-300'
                                }`}
                              >
                                {item.status || 'Cours annulé'}
                              </div>
                            ) : null}
                            {item.classrooms.length > 0 && (
                              <div className="truncate text-zinc-300">
                                {item.classrooms.join(', ')}
                              </div>
                            )}
                            {height >= 68 && item.teachers.length > 0 && (
                              <div className="truncate text-zinc-500">{item.teachers[0]}</div>
                            )}
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
          {/* Color Top Strip */}
          <div
            className="h-1.5 w-full shrink-0"
            style={{
              backgroundColor: popover.item.canceled
                ? '#f43f5e'
                : normalizeHexColor(popover.item.backgroundColor),
            }}
          />

          {/* Popover Header */}
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

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Status Badges */}
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

            {/* Metadata Grid */}
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

            {/* Lesson Content (Cahier de textes — contenu de séance) */}
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

            {/* Related Homework for this lesson / day */}
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
