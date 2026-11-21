import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  BookCheck,
  Award,
  MoreHorizontal,
  Clock3,
  MessageSquareText,
  UtensilsCrossed,
  Settings,
  Loader2,
  X,
} from 'lucide-react';
import type {
  AppSettings,
  AttendanceDTO,
  DiscussionSummaryDTO,
  GradesOverviewDTO,
  HomeworkDTO,
  MenuDayDTO,
  NavTab,
  NewsItemDTO,
  StudentProfile,
  TimetableResponse,
} from '@shared/types';
import { Sidebar } from '../../PC/src/components/Sidebar';
import { DashboardView } from '../../PC/src/views/DashboardView';
import { TimetableView } from '../../PC/src/views/TimetableView';
import { HomeworkView } from '../../PC/src/views/HomeworkView';
import { applyThemeToDocument, DEFAULT_APP_SETTINGS } from '@/utils/theme';
import {
  evaluateDayAutoAdvance,
  getInitialSchoolDate,
  getWeekKey,
  isWeekend,
} from '@/utils/schoolTime';
import { WebTopBar } from './components/WebTopBar';
import { WebLoginView } from './components/WebLoginView';

const GradesView = lazy(() =>
  import('../../PC/src/views/GradesView').then((m) => ({ default: m.GradesView }))
);
const AttendanceView = lazy(() =>
  import('../../PC/src/views/AttendanceView').then((m) => ({ default: m.AttendanceView }))
);
const MessagesView = lazy(() =>
  import('../../PC/src/views/MessagesView').then((m) => ({ default: m.MessagesView }))
);
const MenusView = lazy(() =>
  import('../../PC/src/views/MenusView').then((m) => ({ default: m.MenusView }))
);
const SettingsView = lazy(() =>
  import('../../PC/src/views/SettingsView').then((m) => ({ default: m.SettingsView }))
);

export default function App() {
  const [booting, setBooting] = useState(true);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    ...DEFAULT_APP_SETTINGS,
    notificationsEnabled: false,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [messagingDisabled, setMessagingDisabled] = useState(false);

  const [timetableDate, setTimetableDate] = useState(() => getInitialSchoolDate());
  const [autoAdvanceNote, setAutoAdvanceNote] = useState<string | null>(() =>
    isWeekend(new Date()) ? 'Week-end · Affichage de lundi' : null
  );
  const hasAutoAdvancedRef = useRef(false);

  const [timetable, setTimetable] = useState<TimetableResponse | null>(null);
  const [loadingTimetable, setLoadingTimetable] = useState(false);
  const [homework, setHomework] = useState<HomeworkDTO[]>([]);
  const [loadingHomework, setLoadingHomework] = useState(false);
  const [gradePeriodId, setGradePeriodId] = useState('');
  const [grades, setGrades] = useState<GradesOverviewDTO | null>(null);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [attPeriodId, setAttPeriodId] = useState('');
  const [attendance, setAttendance] = useState<AttendanceDTO | null>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [news, setNews] = useState<NewsItemDTO[]>([]);
  const [discussions, setDiscussions] = useState<DiscussionSummaryDTO[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [menusDate, setMenusDate] = useState(() => getInitialSchoolDate());
  const [menus, setMenus] = useState<MenuDayDTO[]>([]);
  const [loadingMenus, setLoadingMenus] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setSettings(await window.pronoteAPI.system.getSettings());
      } catch {
        // default
      }
      try {
        const restored = await window.pronoteAPI.auth.restoreSession();
        if (restored.ok && restored.profile) {
          handleAuthenticated(restored.profile);
        }
      } finally {
        setBooting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyThemeToDocument(settings);
  }, [settings]);

  const fetchTimetableFor = useCallback(async (date: Date, allowAutoAdvance = false) => {
    setLoadingTimetable(true);
    try {
      const data = await window.pronoteAPI.data.getTimetable(date.toISOString());
      setTimetable(data);
      if (allowAutoAdvance && !hasAutoAdvancedRef.current) {
        hasAutoAdvancedRef.current = true;
        const adv = evaluateDayAutoAdvance(data.items, new Date());
        if (adv.shouldAdvance) {
          setTimetableDate(adv.targetDate);
          setAutoAdvanceNote(adv.label);
          if (getWeekKey(adv.targetDate) !== getWeekKey(date)) {
            const nextWeek = await window.pronoteAPI.data.getTimetable(adv.targetDate.toISOString());
            setTimetable(nextWeek);
          }
        }
      }
    } finally {
      setLoadingTimetable(false);
    }
  }, []);

  const fetchHomework = useCallback(async () => {
    setLoadingHomework(true);
    try {
      const from = new Date();
      from.setDate(from.getDate() - 3);
      const to = new Date();
      to.setDate(to.getDate() + 28);
      setHomework(await window.pronoteAPI.data.getHomework(from.toISOString(), to.toISOString()));
    } finally {
      setLoadingHomework(false);
    }
  }, []);

  const fetchGrades = useCallback(async (pid?: string) => {
    setLoadingGrades(true);
    try {
      setGrades(await window.pronoteAPI.data.getGrades(pid || undefined));
    } finally {
      setLoadingGrades(false);
    }
  }, []);

  const fetchAttendance = useCallback(async (pid?: string) => {
    setLoadingAttendance(true);
    try {
      setAttendance(await window.pronoteAPI.data.getAttendance(pid || undefined));
    } finally {
      setLoadingAttendance(false);
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    setLoadingMessages(true);
    try {
      const [n, d] = await Promise.all([
        window.pronoteAPI.data.getNews().catch(() => []),
        window.pronoteAPI.data.getDiscussions().catch(() => []),
      ]);
      setNews(n);
      setDiscussions(d);
      window.pronoteAPI.data
        .getMessagingDisabled()
        .then(setMessagingDisabled)
        .catch(() => {});
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const fetchMenus = useCallback(async (date?: Date) => {
    setLoadingMenus(true);
    try {
      setMenus(await window.pronoteAPI.data.getMenus((date ?? new Date()).toISOString()));
    } finally {
      setLoadingMenus(false);
    }
  }, []);

  const refreshAll = useCallback(
    async (allowAutoAdvance = false) => {
      if (!profile) return;
      setRefreshing(true);
      // Wave 1: Visible Dashboard essentials first
      await Promise.allSettled([
        fetchTimetableFor(timetableDate, allowAutoAdvance),
        fetchHomework(),
        fetchGrades(gradePeriodId),
      ]);
      // Wave 2: Secondary tabs right after
      await Promise.allSettled([
        fetchMessages(),
        fetchAttendance(attPeriodId),
        fetchMenus(menusDate),
      ]);
      setRefreshing(false);
    },
    [
      profile,
      timetableDate,
      gradePeriodId,
      attPeriodId,
      menusDate,
      fetchTimetableFor,
      fetchHomework,
      fetchGrades,
      fetchAttendance,
      fetchMessages,
      fetchMenus,
    ]
  );

  useEffect(() => {
    if (profile) refreshAll(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const handleAuthenticated = (p: StudentProfile) => {
    hasAutoAdvancedRef.current = false;
    setTimetableDate(getInitialSchoolDate());
    setAutoAdvanceNote(isWeekend(new Date()) ? 'Week-end · Affichage de lundi' : null);
    setActiveTab('dashboard');
    setGradePeriodId(p.gradePeriods.find((x) => x.isDefault)?.id || p.gradePeriods[0]?.id || '');
    setAttPeriodId(p.attendancePeriods.find((x) => x.isDefault)?.id || p.attendancePeriods[0]?.id || '');
    setProfile(p);
  };

  const handleLogout = async () => {
    await window.pronoteAPI.auth.logout();
    setProfile(null);
    setTimetable(null);
    setHomework([]);
    setGrades(null);
    setAttendance(null);
    setNews([]);
    setDiscussions([]);
    setMenus([]);
    setMessagingDisabled(false);
    hasAutoAdvancedRef.current = false;
  };

  const handleToggleHomework = async (id: string, done: boolean) => {
    setHomework((prev) => prev.map((h) => (h.id === id ? { ...h, done } : h)));
    try {
      await window.pronoteAPI.data.setHomeworkDone(id, done);
    } catch {
      setHomework((prev) => prev.map((h) => (h.id === id ? { ...h, done: !done } : h)));
    }
  };

  const handleMarkNewsRead = useCallback(async (id: string) => {
    setNews((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    window.pronoteAPI.data.markNewsRead(id).catch(() => {});
  }, []);

  const handleNewsDetailLoaded = useCallback((updated: NewsItemDTO) => {
    setNews((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  }, []);

  const undoneCount = useMemo(() => homework.filter((h) => !h.done).length, [homework]);
  const unreadCount = useMemo(
    () => news.filter((n) => !n.read).length + discussions.reduce((s, d) => s + d.numberOfMessagesUnread, 0),
    [news, discussions]
  );

  return (
    <div className="h-[100dvh] w-screen flex flex-col bg-[#060608] text-zinc-100 overflow-hidden">
      <WebTopBar
        profile={profile}
        refreshing={refreshing}
        onRefresh={profile ? () => refreshAll(false) : undefined}
      />

      {booting ? (
        <div className="flex-1 flex flex-col items-center justify-center obsidian-glow gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent/90 to-accent/30 border border-white/15 flex items-center justify-center shadow-glow">
            <span className="text-xl font-extrabold text-white">N</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
            <span>Reconnexion à ton espace…</span>
          </div>
        </div>
      ) : !profile ? (
        <WebLoginView onAuthenticated={handleAuthenticated} />
      ) : (
        <div
          className={`flex-1 min-h-0 flex flex-col overflow-hidden ${
            settings.sidebarPosition === 'right' ? 'md:flex-row-reverse' : 'md:flex-row'
          }`}
        >
          {/* Desktop Sidebar */}
          <div className="hidden md:flex shrink-0">
            <Sidebar
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              profile={profile}
              undoneHomeworkCount={undoneCount}
              unreadMessagesCount={unreadCount}
              compact={Boolean(settings.sidebarCompact)}
              position={settings.sidebarPosition || 'left'}
              onLogout={handleLogout}
            />
          </div>

          <main className="flex-1 min-w-0 min-h-0 overflow-y-auto obsidian-glow bg-[#07070A]">
            <Suspense
              fallback={
                <div className="h-full flex items-center justify-center text-xs text-zinc-500 gap-2">
                  <Loader2 className="w-4 h-4 text-accent animate-spin" />
                  <span>Chargement…</span>
                </div>
              }
            >
            {activeTab === 'dashboard' && (
              <DashboardView
                profile={profile}
                timetableItems={timetable?.items ?? []}
                homework={homework}
                grades={grades}
                news={news}
                loading={refreshing}
                messagingDisabled={messagingDisabled}
                layout={settings.dashboardLayout || 'bento'}
                widgets={settings.dashboardWidgets}
                showBreaks={settings.showBreaks !== false}
                onNavigate={setActiveTab}
                onToggleHomework={handleToggleHomework}
              />
            )}
            {activeTab === 'timetable' && (
              <TimetableView
                timetable={timetable}
                homework={homework}
                selectedDate={timetableDate}
                loading={loadingTimetable}
                autoAdvanceNote={autoAdvanceNote}
                defaultViewMode={
                  typeof window !== 'undefined' && window.innerWidth < 768
                    ? 'day'
                    : settings.defaultTimetableView || 'week'
                }
                courseCardStyle={settings.courseCardStyle || 'left'}
                showBreaks={settings.showBreaks !== false}
                onChangeDate={(d) => {
                  hasAutoAdvancedRef.current = true;
                  setAutoAdvanceNote(null);
                  setTimetableDate(d);
                  fetchTimetableFor(d, false);
                }}
                onToggleHomework={handleToggleHomework}
              />
            )}
            {activeTab === 'homework' && (
              <HomeworkView
                homework={homework}
                loading={loadingHomework}
                onToggleDone={handleToggleHomework}
              />
            )}
            {activeTab === 'grades' && (
              <GradesView
                grades={grades}
                periods={profile.gradePeriods}
                selectedPeriodId={gradePeriodId}
                loading={loadingGrades}
                onSelectPeriod={(id) => {
                  setGradePeriodId(id);
                  fetchGrades(id);
                }}
              />
            )}
            {activeTab === 'attendance' && (
              <AttendanceView
                attendance={attendance}
                periods={profile.attendancePeriods}
                selectedPeriodId={attPeriodId}
                loading={loadingAttendance}
                onSelectPeriod={(id) => {
                  setAttPeriodId(id);
                  fetchAttendance(id);
                }}
              />
            )}
            {activeTab === 'messages' && (
              <MessagesView
                news={news}
                discussions={discussions}
                loading={loadingMessages}
                messagingDisabled={messagingDisabled}
                onMarkNewsRead={handleMarkNewsRead}
                onNewsDetailLoaded={handleNewsDetailLoaded}
                onRefreshAllMessages={fetchMessages}
              />
            )}
            {activeTab === 'menus' && (
              <MenusView
                menus={menus}
                selectedDate={menusDate}
                loading={loadingMenus}
                onChangeDate={(d) => {
                  setMenusDate(d);
                  fetchMenus(d);
                }}
              />
            )}
            {activeTab === 'settings' && (
              <SettingsView
                profile={profile}
                settings={settings}
                appVersion="Web 1.2.0"
                checkingUpdate={false}
                updateFeedback="Tu utilises Noctis Web (toujours à jour). Pour la connexion ENT intégrée et le mode hors ligne, télécharge Noctis PC ou Android."
                onCheckUpdates={() => {
                  window.location.href = './download.html';
                }}
                onUpdateSettings={async (p) => {
                  const next = await window.pronoteAPI.system.saveSettings(p);
                  setSettings(next);
                }}
                onLogout={handleLogout}
              />
            )}
            </Suspense>
          </main>

          {/* Mobile / iPhone Bottom Nav Bar */}
          <nav
            style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
            className="md:hidden shrink-0 bg-[#09090D] border-t border-white/[0.06] grid grid-cols-5 px-2 pt-2"
          >
            {(
              [
                { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
                { id: 'timetable', label: 'Cours', icon: CalendarDays },
                { id: 'homework', label: 'Devoirs', icon: BookCheck },
                { id: 'grades', label: 'Notes', icon: Award },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setMobileMoreOpen(false);
                    setActiveTab(item.id);
                  }}
                  className={`flex flex-col items-center gap-1 py-0.5 text-[10.5px] font-medium ${
                    active ? 'text-accent' : 'text-zinc-500'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <button
              onClick={() => setMobileMoreOpen(true)}
              className={`flex flex-col items-center gap-1 py-0.5 text-[10.5px] font-medium ${
                ['attendance', 'messages', 'menus', 'settings'].includes(activeTab)
                  ? 'text-accent'
                  : 'text-zinc-500'
              }`}
            >
              <MoreHorizontal className="w-5 h-5" />
              <span>Plus</span>
            </button>
          </nav>

          {/* Mobile "Plus" Drawer */}
          {mobileMoreOpen && (
            <div
              onClick={() => setMobileMoreOpen(false)}
              className="md:hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
                className="w-full rounded-t-3xl bg-[#101018] border-t border-white/10 p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Plus d'espaces</span>
                  <button onClick={() => setMobileMoreOpen(false)} className="text-zinc-400">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {(
                    [
                      { id: 'messages', label: 'Infos & Messages', icon: MessageSquareText },
                      { id: 'menus', label: 'Cantine (Midi/Soir)', icon: UtensilsCrossed },
                      { id: 'attendance', label: 'Vie scolaire', icon: Clock3 },
                      { id: 'settings', label: 'Paramètres', icon: Settings },
                    ] as const
                  ).map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id);
                          setMobileMoreOpen(false);
                        }}
                        className="p-3.5 rounded-2xl bg-[#161622] border border-white/[0.06] flex items-center gap-2.5 text-left"
                      >
                        <Icon className="w-5 h-5 text-accent shrink-0" />
                        <span className="text-xs font-semibold text-white">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
