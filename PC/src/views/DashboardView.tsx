import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  BookCheck,
  Award,
  Bell,
  ChevronRight,
  MapPin,
  User,
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  AlertTriangle,
  UtensilsCrossed,
} from 'lucide-react';
import type {
  DashboardLayout,
  DashboardWidgetsConfig,
  GradesOverviewDTO,
  HomeworkDTO,
  NavTab,
  NewsItemDTO,
  StudentProfile,
  TimetableItemDTO,
} from '@shared/types';
import {
  formatDateFull,
  formatDateRelative,
  formatDurationMinutes,
  formatGradeNumber,
  formatTime,
  getGradeColorClass,
  getGreeting,
  isSameDay,
  normalizeHexColor,
  stripHtmlToPreview,
} from '@/utils/format';
import {
  computeDayBreaks,
  evaluateDayAutoAdvance,
  getLessonTemporalState,
  isWeekend,
} from '@/utils/schoolTime';
import { RightToDisconnectNote } from '../components/RightToDisconnectNote';

interface DashboardViewProps {
  profile: StudentProfile;
  timetableItems: TimetableItemDTO[];
  homework: HomeworkDTO[];
  grades: GradesOverviewDTO | null;
  news: NewsItemDTO[];
  loading: boolean;
  messagingDisabled?: boolean;
  layout?: DashboardLayout;
  widgets?: DashboardWidgetsConfig;
  showBreaks?: boolean;
  onNavigate: (tab: NavTab) => void;
  onToggleHomework: (id: string, done: boolean) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  profile,
  timetableItems,
  homework,
  grades,
  news,
  loading,
  layout = 'bento',
  widgets = {
    showKpis: true,
    showTimetable: true,
    showHomework: true,
    showGrades: true,
    showNews: true,
  },
  showBreaks = true,
  onNavigate,
  onToggleHomework,
}) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const todayLessons = useMemo(() => {
    const today = timetableItems.filter((item) => isSameDay(new Date(item.startDate), now));
    return today.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [timetableItems, now]);

  // Smart active day: if today's classes are finished (e.g. 15h30 >= 15h30) or it's the weekend,
  // automatically show the next school day (jumping Friday -> Monday, skipping Sat/Sun)!
  const nextActiveDay = useMemo(() => {
    const adv = evaluateDayAutoAdvance(timetableItems, now);
    if (!adv.shouldAdvance && todayLessons.length > 0) {
      return { label: "Aujourd'hui", subtitle: 'Vos cours de la journée', items: todayLessons };
    }

    const targetItems = timetableItems
      .filter((i) => isSameDay(new Date(i.startDate), adv.targetDate))
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    if (targetItems.length > 0) {
      const lbl = formatDateRelative(adv.targetDate.toISOString());
      return {
        label: lbl.charAt(0).toUpperCase() + lbl.slice(1),
        subtitle: adv.label || 'Prochaine journée de cours',
        items: targetItems,
      };
    }

    // Fallback: first upcoming non-weekend day in loaded timetable
    const upcoming = timetableItems.filter((item) => {
      const d = new Date(item.startDate);
      return !isWeekend(d) && new Date(item.endDate).getTime() > now.getTime();
    });
    if (upcoming.length > 0) {
      const firstDate = new Date(upcoming[0].startDate);
      const sameDayItems = upcoming
        .filter((i) => isSameDay(new Date(i.startDate), firstDate))
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      const lbl = formatDateRelative(firstDate.toISOString());
      return {
        label: lbl.charAt(0).toUpperCase() + lbl.slice(1),
        subtitle: adv.label || 'Prochaine journée de cours',
        items: sameDayItems,
      };
    }

    const lbl = formatDateRelative(adv.targetDate.toISOString());
    return {
      label: adv.shouldAdvance ? lbl.charAt(0).toUpperCase() + lbl.slice(1) : "Aujourd'hui",
      subtitle: adv.label || 'Vos cours de la journée',
      items: [],
    };
  }, [timetableItems, todayLessons, now]);

  const activeDayTimeline = useMemo(() => {
    const breaks = showBreaks ? computeDayBreaks(nextActiveDay.items) : [];
    type Row =
      | { kind: 'lesson'; sortKey: number; item: TimetableItemDTO }
      | { kind: 'break'; sortKey: number; brk: (typeof breaks)[number] };
    const rows: Row[] = [
      ...nextActiveDay.items.map((item) => ({
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
  }, [nextActiveDay.items, showBreaks]);

  const currentOrNextLesson = useMemo(() => {
    const active = timetableItems.filter((c) => !c.canceled);
    const current = active.find((c) => {
      const s = new Date(c.startDate).getTime();
      const e = new Date(c.endDate).getTime();
      return now.getTime() >= s && now.getTime() <= e;
    });
    if (current) {
      const s = new Date(current.startDate).getTime();
      const e = new Date(current.endDate).getTime();
      const pct = Math.max(0, Math.min(100, ((now.getTime() - s) / (e - s)) * 100));
      const minsLeft = Math.max(1, Math.ceil((e - now.getTime()) / 60_000));
      return { mode: 'now' as const, item: current, progress: pct, minsLeft };
    }
    const next = active.find((c) => new Date(c.startDate).getTime() > now.getTime());
    if (next) {
      const diffMins = Math.ceil((new Date(next.startDate).getTime() - now.getTime()) / 60_000);
      return { mode: 'next' as const, item: next, diffMins };
    }
    return null;
  }, [timetableItems, now]);

  const upcomingHomework = useMemo(() => {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return homework
      .filter((h) => new Date(h.deadline).getTime() >= startOfToday)
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      })
      .slice(0, 6);
  }, [homework, now]);

  const undoneCount = useMemo(
    () =>
      homework.filter(
        (h) =>
          !h.done &&
          new Date(h.deadline).getTime() >=
            new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      ).length,
    [homework, now]
  );

  const unreadNewsCount = useMemo(() => news.filter((n) => !n.read).length, [news]);
  const recentGrades = useMemo(() => (grades?.grades ?? []).slice(0, 5), [grades]);
  const recentNews = useMemo(() => news.slice(0, 4), [news]);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6 animate-fade-in">
      {/* Header Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12.5px] font-medium text-accent uppercase tracking-[0.1em] mb-1">
            {formatDateFull(now.toISOString())}
          </p>
          <h1 className="text-2xl lg:text-[28px] font-bold tracking-tight text-white">
            {getGreeting()}, {profile.firstName}
          </h1>
        </div>

        {/* Live Current / Next Course Spotlight Pill */}
        {currentOrNextLesson && (
          <button
            onClick={() => onNavigate('timetable')}
            className="group px-4 py-2.5 rounded-2xl bg-[#111118] hover:bg-[#161620] border border-white/[0.08] flex items-center gap-3.5 text-left transition-all shadow-card max-w-md"
          >
            <div
              className="w-2.5 h-10 rounded-full shrink-0"
              style={{
                backgroundColor: normalizeHexColor(currentOrNextLesson.item.backgroundColor),
              }}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
                {currentOrNextLesson.mode === 'now' ? (
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    En cours · {currentOrNextLesson.minsLeft} min restantes
                  </span>
                ) : (
                  <span className="text-accent flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Prochain cours · {formatTime(currentOrNextLesson.item.startDate)}
                  </span>
                )}
              </div>
              <div className="text-[14px] font-semibold text-white truncate mt-0.5">
                {currentOrNextLesson.item.title}
              </div>
              <div className="text-[11.5px] text-zinc-400 truncate">
                {currentOrNextLesson.item.classrooms.join(', ') || 'Salle non précisée'}
                {currentOrNextLesson.item.teachers[0]
                  ? ` · ${currentOrNextLesson.item.teachers[0]}`
                  : ''}
              </div>
              {currentOrNextLesson.mode === 'now' && (
                <div className="w-48 h-1 rounded-full bg-white/[0.08] mt-1.5 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all"
                    style={{ width: `${currentOrNextLesson.progress}%` }}
                  />
                </div>
              )}
            </div>
          </button>
        )}
      </div>

      {/* Droit à la déconnexion banner (only during legal hours / weekends / public & school holidays) */}
      <RightToDisconnectNote holidays={profile.holidays} />

      {/* KPI Quick Strip */}
      {widgets.showKpis && (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          onClick={() => onNavigate('timetable')}
          className="p-4 rounded-2xl bg-[#0F0F15] hover:bg-[#14141C] border border-white/[0.06] text-left transition-all group"
        >
          <div className="flex items-center justify-between text-zinc-400 mb-3">
            <span className="text-[12px] font-medium">Cours ({nextActiveDay.label})</span>
            <CalendarDays className="w-4 h-4 text-zinc-500 group-hover:text-accent transition-colors" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums">
            {nextActiveDay.items.filter((i) => !i.canceled).length}
          </div>
          <div className="text-[11.5px] text-zinc-500 mt-1">
            {nextActiveDay.items.some((i) => i.canceled)
              ? `${nextActiveDay.items.filter((i) => i.canceled).length} cours annulé(s)`
              : nextActiveDay.items.length > 0
              ? `${formatTime(nextActiveDay.items[0].startDate)} – ${formatTime(
                  nextActiveDay.items[nextActiveDay.items.length - 1].endDate
                )}`
              : 'Aucun cours prévu'}
          </div>
        </button>

        <button
          onClick={() => onNavigate('homework')}
          className="p-4 rounded-2xl bg-[#0F0F15] hover:bg-[#14141C] border border-white/[0.06] text-left transition-all group"
        >
          <div className="flex items-center justify-between text-zinc-400 mb-3">
            <span className="text-[12px] font-medium">Devoirs à faire</span>
            <BookCheck className="w-4 h-4 text-zinc-500 group-hover:text-accent transition-colors" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums">{undoneCount}</div>
          <div className="text-[11.5px] text-zinc-500 mt-1">
            {undoneCount === 0 ? 'Tout est à jour !' : 'Pour les prochains jours'}
          </div>
        </button>

        <button
          onClick={() => onNavigate('grades')}
          className="p-4 rounded-2xl bg-[#0F0F15] hover:bg-[#14141C] border border-white/[0.06] text-left transition-all group"
        >
          <div className="flex items-center justify-between text-zinc-400 mb-3">
            <span className="text-[12px] font-medium">Moyenne générale</span>
            <Award className="w-4 h-4 text-zinc-500 group-hover:text-accent transition-colors" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums">
            {grades?.overallAverage !== undefined ? (
              <>
                <span className={getGradeColorClass(grades.overallAverage)}>
                  {formatGradeNumber(grades.overallAverage)}
                </span>
                <span className="text-sm font-normal text-zinc-500"> /20</span>
              </>
            ) : (
              '—'
            )}
          </div>
          <div className="text-[11.5px] text-zinc-500 mt-1">
            {grades?.classAverage !== undefined
              ? `Classe : ${formatGradeNumber(grades.classAverage)}/20`
              : grades?.periodName || 'Période en cours'}
          </div>
        </button>

        <button
          onClick={() => onNavigate('messages')}
          className={`p-4 rounded-2xl border text-left transition-all group ${
            unreadNewsCount > 0
              ? 'bg-accent/[0.07] hover:bg-accent/[0.11] border-accent/35'
              : 'bg-[#0F0F15] hover:bg-[#14141C] border-white/[0.06]'
          }`}
        >
          <div className="flex items-center justify-between text-zinc-400 mb-3">
            <span className="text-[12px] font-medium">Infos & Annonces</span>
            <div className="flex items-center gap-1.5">
              {unreadNewsCount > 0 && (
                <span className="min-w-[20px] h-[20px] px-1.5 rounded-full bg-accent text-black text-[10.5px] font-bold flex items-center justify-center tabular-nums shadow-glow">
                  {unreadNewsCount > 99 ? '99+' : unreadNewsCount}
                </span>
              )}
              <Bell
                className={`w-4 h-4 transition-colors ${
                  unreadNewsCount > 0 ? 'text-accent' : 'text-zinc-500 group-hover:text-accent'
                }`}
              />
            </div>
          </div>
          <div
            className={`text-2xl font-bold tabular-nums ${
              unreadNewsCount > 0 ? 'text-accent' : 'text-white'
            }`}
          >
            {unreadNewsCount}
          </div>
          <div className="text-[11.5px] text-zinc-500 mt-1">
            {unreadNewsCount > 0 ? 'Non lue(s)' : `${news.length} au total`}
          </div>
        </button>
      </div>
      )}

      {/* Main Bento / Stacked Grid */}
      <div
        className={`grid gap-5 ${
          layout === 'stacked' ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-12'
        }`}
      >
        {/* Column 1: Timetable Snapshot */}
        {widgets.showTimetable && (
        <section
          className={`${
            layout === 'stacked'
              ? ''
              : widgets.showHomework || widgets.showGrades || widgets.showNews
              ? 'xl:col-span-5'
              : 'xl:col-span-12'
          } rounded-2xl bg-[#0D0D12] border border-white/[0.06] p-5 flex flex-col`}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-white">
                Emploi du temps · {nextActiveDay.label}
              </h2>
              <p className="text-[12px] text-zinc-500">{nextActiveDay.subtitle}</p>
            </div>
            <button
              onClick={() => onNavigate('timetable')}
              className="text-[12px] font-medium text-zinc-400 hover:text-accent flex items-center gap-1 transition-colors"
            >
              Semaine <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading && nextActiveDay.items.length === 0 ? (
            <div className="space-y-2.5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-white/[0.03] animate-pulse" />
              ))}
            </div>
          ) : nextActiveDay.items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
              <Sparkles className="w-8 h-8 text-zinc-700 mb-2" />
              <p className="text-sm font-medium text-zinc-300">Aucun cours prévu</p>
              <p className="text-xs text-zinc-500 mt-1">Profitez de votre temps libre !</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeDayTimeline.map((row) => {
                if (row.kind === 'break') {
                  const isLunch = row.brk.kind === 'lunch';
                  return (
                    <div
                      key={row.brk.id}
                      className={`px-3 py-2 rounded-xl border border-dashed flex items-center justify-between text-xs ${
                        isLunch
                          ? 'bg-amber-500/[0.07] border-amber-400/30 text-amber-300'
                          : 'bg-white/[0.02] border-white/[0.08] text-zinc-400'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2 font-semibold">
                        <UtensilsCrossed className="w-3.5 h-3.5" />
                        {isLunch ? 'Pause déjeuner' : 'Pause'}
                      </span>
                      <span className="tabular-nums text-[11px] opacity-85">
                        {formatTime(row.brk.startDate.toISOString())} –{' '}
                        {formatTime(row.brk.endDate.toISOString())} ·{' '}
                        {formatDurationMinutes(row.brk.durationMinutes)}
                      </span>
                    </div>
                  );
                }

                const item = row.item;
                const color = normalizeHexColor(item.backgroundColor);
                const temporal = getLessonTemporalState(item, now);
                const isCurrent = temporal.state === 'current';
                const isPast = temporal.state === 'past';

                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border transition-all flex items-center gap-3.5 ${
                      item.canceled
                        ? 'bg-rose-500/[0.05] border-rose-500/20 opacity-75'
                        : isCurrent
                        ? 'bg-accent/[0.12] border-accent/50 shadow-glow'
                        : isPast
                        ? 'bg-[#0F0F14]/70 border-white/[0.04] opacity-55'
                        : 'bg-[#13131A] border-white/[0.06] hover:border-white/[0.12]'
                    }`}
                  >
                    <div className="w-12 text-right shrink-0 tabular-nums">
                      <div
                        className={`text-[12.5px] font-bold ${
                          isPast ? 'text-zinc-500' : 'text-zinc-100'
                        }`}
                      >
                        {formatTime(item.startDate)}
                      </div>
                      <div className="text-[11px] text-zinc-500">{formatTime(item.endDate)}</div>
                    </div>
                    <div
                      className="w-1 self-stretch rounded-full shrink-0"
                      style={{
                        backgroundColor: item.canceled
                          ? '#f43f5e'
                          : isPast
                          ? '#52525b'
                          : color,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[13.5px] font-semibold truncate ${
                            item.canceled
                              ? 'line-through text-zinc-400'
                              : isPast
                              ? 'text-zinc-400'
                              : 'text-white'
                          }`}
                        >
                          {item.title}
                        </span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 shrink-0 inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            En cours
                          </span>
                        )}
                        {item.canceled && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300 shrink-0">
                            {item.status || 'Annulé'}
                          </span>
                        )}
                        {!item.canceled && item.status && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 shrink-0">
                            {item.status}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11.5px] text-zinc-400">
                        {item.classrooms.length > 0 && (
                          <span className="inline-flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-zinc-500" />
                            {item.classrooms.join(', ')}
                          </span>
                        )}
                        {item.teachers.length > 0 && (
                          <span className="inline-flex items-center gap-1 truncate">
                            <User className="w-3 h-3 text-zinc-500" />
                            {item.teachers[0]}
                          </span>
                        )}
                      </div>
                      {isCurrent && (
                        <div className="w-full h-1 rounded-full bg-black/40 mt-2 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${temporal.progressPct}%`, backgroundColor: color }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        )}

        {/* Column 2: Homework + Recent Grades + News */}
        {(widgets.showHomework || widgets.showGrades || widgets.showNews || profile.isDemo) && (
        <div
          className={`${
            layout === 'stacked'
              ? ''
              : widgets.showTimetable
              ? 'xl:col-span-7'
              : 'xl:col-span-12'
          } space-y-5`}
        >
          {/* Homework Card */}
          {widgets.showHomework && (
          <section className="rounded-2xl bg-[#0D0D12] border border-white/[0.06] p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[15px] font-semibold text-white">Prochains devoirs</h2>
                <p className="text-[12px] text-zinc-500">Cochez directement ce qui est terminé</p>
              </div>
              <button
                onClick={() => onNavigate('homework')}
                className="text-[12px] font-medium text-zinc-400 hover:text-accent flex items-center gap-1 transition-colors"
              >
                Tout voir <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {upcomingHomework.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-500">
                Aucun devoir à venir pour le moment.
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingHomework.map((hw) => {
                  const color = normalizeHexColor(hw.backgroundColor);
                  return (
                    <div
                      key={hw.id}
                      className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                        hw.done
                          ? 'bg-white/[0.015] border-white/[0.04] opacity-60'
                          : 'bg-[#13131A] border-white/[0.06] hover:border-white/[0.12]'
                      }`}
                    >
                      <button
                        onClick={() => onToggleHomework(hw.id, !hw.done)}
                        className="mt-0.5 text-zinc-400 hover:text-accent transition-colors shrink-0"
                        title={hw.done ? 'Marquer non fait' : 'Marquer fait'}
                      >
                        {hw.done ? (
                          <CheckCircle2 className="w-[18px] h-[18px] text-emerald-400" />
                        ) : (
                          <Circle className="w-[18px] h-[18px]" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span
                              className={`text-[13px] font-semibold truncate ${
                                hw.done ? 'line-through text-zinc-400' : 'text-white'
                              }`}
                            >
                              {hw.subject}
                            </span>
                          </div>
                          <span className="text-[11px] font-medium text-zinc-400 shrink-0">
                            {formatDateRelative(hw.deadline)}
                          </span>
                        </div>
                        <p className="text-[12.5px] text-zinc-400 mt-1 line-clamp-2">
                          {stripHtmlToPreview(hw.description, 150)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          )}

          {/* Bottom Split: Recent Grades & Recent News */}
          {(widgets.showGrades || widgets.showNews) && (
          <div
            className={`grid gap-5 ${
              widgets.showGrades && widgets.showNews ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
            }`}
          >
            {/* Recent Grades */}
            {widgets.showGrades && (
            <section className="rounded-2xl bg-[#0D0D12] border border-white/[0.06] p-5">
              <div className="flex items-center justify-between mb-3.5">
                <h2 className="text-[14.5px] font-semibold text-white">Dernières notes</h2>
                <button
                  onClick={() => onNavigate('grades')}
                  className="text-[12px] text-zinc-400 hover:text-accent flex items-center gap-0.5"
                >
                  Notes <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              {recentGrades.length === 0 ? (
                <p className="text-xs text-zinc-500 py-6 text-center">
                  Aucune note sur cette période.
                </p>
              ) : (
                <div className="space-y-2">
                  {recentGrades.map((g) => {
                    const normalized20 = g.outOf > 0 ? (g.value.points / g.outOf) * 20 : 0;
                    return (
                      <div
                        key={g.id}
                        className="px-3 py-2.5 rounded-xl bg-[#13131A] border border-white/[0.05] flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-zinc-100 truncate">
                            {g.subject}
                          </div>
                          <div className="text-[11px] text-zinc-500 truncate">
                            {g.comment || formatDateRelative(g.date)}
                          </div>
                        </div>
                        <div className="text-right shrink-0 tabular-nums">
                          <span
                            className={`text-[14px] font-bold ${
                              g.value.kind === 0
                                ? getGradeColorClass(normalized20)
                                : 'text-zinc-400'
                            }`}
                          >
                            {g.value.label}
                          </span>
                          {g.value.kind === 0 && (
                            <span className="text-[11px] text-zinc-500">/{g.outOf}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            )}

            {/* Recent News */}
            {widgets.showNews && (
            <section className="rounded-2xl bg-[#0D0D12] border border-white/[0.06] p-5">
              <div className="flex items-center justify-between mb-3.5">
                <h2 className="text-[14.5px] font-semibold text-white">Informations récentes</h2>
                <button
                  onClick={() => onNavigate('messages')}
                  className="text-[12px] text-zinc-400 hover:text-accent flex items-center gap-0.5"
                >
                  Ouvrir <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              {recentNews.length === 0 ? (
                <p className="text-xs text-zinc-500 py-6 text-center">Aucune actualité.</p>
              ) : (
                <div className="space-y-2">
                  {recentNews.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => onNavigate('messages')}
                      className="w-full text-left px-3 py-2.5 rounded-xl bg-[#13131A] hover:bg-[#191922] border border-white/[0.05] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
                        <span className="text-[13px] font-medium text-zinc-100 truncate">
                          {n.title}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[11px] text-zinc-500">
                        <span className="truncate">{n.author}</span>
                        <span className="shrink-0 ml-2">{formatDateRelative(n.creationDate)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
            )}
          </div>
          )}

          {profile.isDemo && (
            <div className="p-3.5 rounded-xl bg-amber-500/[0.07] border border-amber-500/20 flex items-center gap-3 text-xs text-amber-200/90">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Vous utilisez actuellement le <strong>Mode Démo</strong> (serveur officiel Index-Éducation). Déconnectez-vous pour lier votre compte établissement / ENT.
              </span>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
};
