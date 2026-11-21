import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw, WifiOff } from 'lucide-react';
import type {
  AppSettings,
  AttendanceDTO,
  DiscussionSummaryDTO,
  GradesOverviewDTO,
  HomeworkDTO,
  MenuDayDTO,
  NavTab,
  NewsItemDTO,
  OfflineCacheSnapshot,
  StudentProfile,
  TimetableResponse,
  UpdateInfoDTO,
} from '@shared/types';
import {
  evaluateDayAutoAdvance,
  formatLastSync,
  getInitialSchoolDate,
  getWeekKey,
  isWeekend,
} from '@/utils/schoolTime';
import { applyThemeToDocument, DEFAULT_APP_SETTINGS } from '@/utils/theme';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { LoginView } from './components/LoginView';
import { UpdateModal } from './components/UpdateModal';
import { DashboardView } from './views/DashboardView';
import { TimetableView } from './views/TimetableView';
import { HomeworkView } from './views/HomeworkView';

const GradesView = lazy(() => import('./views/GradesView').then((m) => ({ default: m.GradesView })));
const AttendanceView = lazy(() =>
  import('./views/AttendanceView').then((m) => ({ default: m.AttendanceView }))
);
const MessagesView = lazy(() =>
  import('./views/MessagesView').then((m) => ({ default: m.MessagesView }))
);
const MenusView = lazy(() => import('./views/MenusView').then((m) => ({ default: m.MenusView })));
const SettingsView = lazy(() =>
  import('./views/SettingsView').then((m) => ({ default: m.SettingsView }))
);

const DEFAULT_SETTINGS: AppSettings = DEFAULT_APP_SETTINGS;

export default function App() {
  const [booting, setBooting] = useState(true);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Offline / sync states
  const [isOffline, setIsOffline] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [messagingDisabled, setMessagingDisabled] = useState(false);

  // Data states
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [timetableDate, setTimetableDate] = useState<Date>(() => getInitialSchoolDate());
  const [autoAdvanceNote, setAutoAdvanceNote] = useState<string | null>(() =>
    isWeekend(new Date()) ? 'Week-end · Affichage de lundi' : null
  );
  const [timetable, setTimetable] = useState<TimetableResponse | null>(null);
  const [loadingTimetable, setLoadingTimetable] = useState(false);

  const [homework, setHomework] = useState<HomeworkDTO[]>([]);
  const [loadingHomework, setLoadingHomework] = useState(false);

  const [selectedGradePeriodId, setSelectedGradePeriodId] = useState('');
  const [grades, setGrades] = useState<GradesOverviewDTO | null>(null);
  const [loadingGrades, setLoadingGrades] = useState(false);

  const [selectedAttendancePeriodId, setSelectedAttendancePeriodId] = useState('');
  const [attendance, setAttendance] = useState<AttendanceDTO | null>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  const [news, setNews] = useState<NewsItemDTO[]>([]);
  const [discussions, setDiscussions] = useState<DiscussionSummaryDTO[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [menusDate, setMenusDate] = useState<Date>(() => getInitialSchoolDate());
  const [menus, setMenus] = useState<MenuDayDTO[]>([]);
  const [loadingMenus, setLoadingMenus] = useState(false);

  const [appVersion, setAppVersion] = useState('1.0.0');
  const [availableUpdate, setAvailableUpdate] = useState<UpdateInfoDTO | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateCheckFeedback, setUpdateCheckFeedback] = useState<string | null>(null);

  const knownGradeIdsRef = useRef<Set<string> | null>(null);
  const knownCanceledIdsRef = useRef<Set<string> | null>(null);
  const hasAutoAdvancedRef = useRef(false);
  const cachedSnapRef = useRef<OfflineCacheSnapshot | null>(null);
  const timetableWeekCacheRef = useRef<Map<string, TimetableResponse>>(new Map());
  const gradesCacheRef = useRef<Map<string, GradesOverviewDTO>>(new Map());
  const attendanceCacheRef = useRef<Map<string, AttendanceDTO>>(new Map());

  useEffect(() => {
    applyThemeToDocument(settings);
  }, [settings]);

  const hydrateFromSnapshot = useCallback((snap: OfflineCacheSnapshot, targetDate: Date) => {
    cachedSnapRef.current = snap;
    setLastSyncedAt(snap.lastSyncedAt || null);
    if (snap.lastSyncedAt) setLastUpdated(new Date(snap.lastSyncedAt));
    const wkKey = getWeekKey(targetDate);
    const cachedTt = snap.timetables?.[wkKey] ?? snap.latestTimetable ?? null;
    if (cachedTt) setTimetable(cachedTt);
    if (snap.homework?.length) setHomework(snap.homework);
    if (snap.latestGrades) setGrades(snap.latestGrades);
    if (snap.latestAttendance) setAttendance(snap.latestAttendance);
    if (snap.news?.length) setNews(snap.news);
    if (snap.discussions?.length) setDiscussions(snap.discussions);
    if (snap.menus?.length) setMenus(snap.menus);
  }, []);

  // Boot: load settings & attempt encrypted session restore (with seamless offline cache fallback)
  useEffect(() => {
    (async () => {
      try {
        const savedSettings = await window.pronoteAPI.system.getSettings();
        setSettings(savedSettings);
      } catch {
        // defaults
      }

      try {
        const ver = await window.pronoteAPI.updater.getVersion();
        setAppVersion(ver);
      } catch {
        // ignore
      }

      window.pronoteAPI.updater
        .checkForUpdates()
        .then((info) => {
          if (info.updateAvailable) setAvailableUpdate(info);
        })
        .catch(() => {});

      try {
        const res = await window.pronoteAPI.auth.restoreSession();
        if (res.ok && res.profile) {
          const initDate = getInitialSchoolDate();
          setTimetableDate(initDate);
          const defGrade =
            res.profile.gradePeriods.find((p) => p.isDefault)?.id ||
            res.profile.gradePeriods[0]?.id ||
            '';
          const defAtt =
            res.profile.attendancePeriods.find((p) => p.isDefault)?.id ||
            res.profile.attendancePeriods[0]?.id ||
            '';
          setSelectedGradePeriodId(defGrade);
          setSelectedAttendancePeriodId(defAtt);

          // Pre-hydrate cached data immediately so UI feels instant even while refreshing
          const snap = await window.pronoteAPI.data.getOfflineSnapshot().catch(() => null);
          if (snap) {
            hydrateFromSnapshot(snap, initDate);
          }

          if (res.offline) {
            setIsOffline(true);
            if (res.lastSyncedAt) setLastSyncedAt(res.lastSyncedAt);
          } else {
            setIsOffline(false);
          }

          setProfile(res.profile);
        }
      } catch {
        // stay on login screen
      } finally {
        setBooting(false);
      }
    })();
  }, [hydrateFromSnapshot]);

  const fetchTimetableFor = useCallback(
    async (date: Date, silent = false, allowAutoAdvance = false): Promise<boolean> => {
      if (!silent) setLoadingTimetable(true);
      try {
        const data = await window.pronoteAPI.data.getTimetable(date.toISOString());
        timetableWeekCacheRef.current.set(getWeekKey(date), data);
        setTimetable(data);

        const canceledNow = data.items.filter((i) => i.canceled);
        if (knownCanceledIdsRef.current !== null) {
          for (const cls of canceledNow) {
            if (!knownCanceledIdsRef.current.has(cls.id)) {
              window.pronoteAPI.system.notify(
                'Cours annulé',
                `${cls.title} (${new Date(cls.startDate).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}) : ${cls.status || 'Annulé'}`
              );
            }
          }
        }
        knownCanceledIdsRef.current = new Set(canceledNow.map((c) => c.id));

        // On first load of a weekday, if today's classes are already over (e.g. >= 15h30),
        // automatically switch to tomorrow (or Monday if Friday!) and fetch next week if needed!
        if (allowAutoAdvance && !hasAutoAdvancedRef.current) {
          hasAutoAdvancedRef.current = true;
          const adv = evaluateDayAutoAdvance(data.items, new Date());
          if (adv.shouldAdvance) {
            setTimetableDate(adv.targetDate);
            setAutoAdvanceNote(adv.label);
            if (getWeekKey(adv.targetDate) !== getWeekKey(date)) {
              const nextWeekData = await window.pronoteAPI.data.getTimetable(
                adv.targetDate.toISOString()
              );
              setTimetable(nextWeekData);
            }
          }
        }
        return true;
      } catch (err) {
        console.error('Timetable fetch failed:', err);
        const snap = cachedSnapRef.current ?? (await window.pronoteAPI.data.getOfflineSnapshot().catch(() => null));
        if (snap) {
          const cached = snap.timetables?.[getWeekKey(date)] ?? snap.latestTimetable;
          if (cached) setTimetable(cached);
        }
        return false;
      } finally {
        if (!silent) setLoadingTimetable(false);
      }
    },
    []
  );

  const fetchHomework = useCallback(async (silent = false): Promise<boolean> => {
    if (!silent) setLoadingHomework(true);
    try {
      const from = new Date();
      from.setDate(from.getDate() - 3);
      from.setHours(0, 0, 0, 0);
      const to = new Date();
      to.setDate(to.getDate() + 28);
      to.setHours(23, 59, 59, 999);
      const list = await window.pronoteAPI.data.getHomework(from.toISOString(), to.toISOString());
      setHomework(list);
      return true;
    } catch (err) {
      console.error('Homework fetch failed:', err);
      return false;
    } finally {
      if (!silent) setLoadingHomework(false);
    }
  }, []);

  const fetchGrades = useCallback(async (periodId?: string, silent = false): Promise<boolean> => {
    if (!silent) setLoadingGrades(true);
    try {
      const data = await window.pronoteAPI.data.getGrades(periodId || undefined);
      if (data.periodId) gradesCacheRef.current.set(data.periodId, data);
      if (periodId) gradesCacheRef.current.set(periodId, data);
      setGrades(data);

      if (knownGradeIdsRef.current !== null) {
        for (const g of data.grades) {
          if (!knownGradeIdsRef.current.has(g.id)) {
            window.pronoteAPI.system.notify(
              `Nouvelle note en ${g.subject}`,
              `${g.value.label}/${g.outOf}${g.comment ? ` — ${g.comment}` : ''}`
            );
          }
        }
      }
      knownGradeIdsRef.current = new Set(data.grades.map((g) => g.id));
      return true;
    } catch (err) {
      console.error('Grades fetch failed:', err);
      const snap = cachedSnapRef.current ?? (await window.pronoteAPI.data.getOfflineSnapshot().catch(() => null));
      if (snap && periodId && snap.grades?.[periodId]) {
        setGrades(snap.grades[periodId]);
      }
      return false;
    } finally {
      if (!silent) setLoadingGrades(false);
    }
  }, []);

  const fetchAttendance = useCallback(
    async (periodId?: string, silent = false): Promise<boolean> => {
      if (!silent) setLoadingAttendance(true);
      try {
        const data = await window.pronoteAPI.data.getAttendance(periodId || undefined);
        if (data.periodId) attendanceCacheRef.current.set(data.periodId, data);
        if (periodId) attendanceCacheRef.current.set(periodId, data);
        setAttendance(data);
        return true;
      } catch (err) {
        console.error('Attendance fetch failed:', err);
        const snap = cachedSnapRef.current ?? (await window.pronoteAPI.data.getOfflineSnapshot().catch(() => null));
        if (snap && periodId && snap.attendance?.[periodId]) {
          setAttendance(snap.attendance[periodId]);
        }
        return false;
      } finally {
        if (!silent) setLoadingAttendance(false);
      }
    },
    []
  );

  const fetchMessages = useCallback(async (silent = false): Promise<boolean> => {
    if (!silent) setLoadingMessages(true);
    try {
      const [newsRes, discRes, disabled] = await Promise.all([
        window.pronoteAPI.data.getNews(),
        window.pronoteAPI.data.getDiscussions(),
        window.pronoteAPI.data.getMessagingDisabled().catch(() => false),
      ]);
      setNews(newsRes);
      setDiscussions(discRes);
      setMessagingDisabled(disabled);
      return true;
    } catch {
      return false;
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, []);

  const fetchMenus = useCallback(async (date?: Date, silent = false): Promise<boolean> => {
    if (!silent) setLoadingMenus(true);
    try {
      const data = await window.pronoteAPI.data.getMenus((date ?? new Date()).toISOString());
      setMenus(data);
      return true;
    } catch {
      return false;
    } finally {
      if (!silent) setLoadingMenus(false);
    }
  }, []);

  const refreshAll = useCallback(
    async (silent = false, allowAutoAdvance = false) => {
      if (!profile) return;
      setRefreshing(true);

      // If currently offline, try reconnecting first before fetching
      if (isOffline) {
        setReconnecting(true);
        try {
          const recon = await window.pronoteAPI.auth.reconnect();
          if (!recon.ok) {
            setRefreshing(false);
            setReconnecting(false);
            return;
          }
          if (recon.profile) setProfile(recon.profile);
          setIsOffline(false);
        } catch {
          setRefreshing(false);
          setReconnecting(false);
          return;
        } finally {
          setReconnecting(false);
        }
      }

      // Wave 1 (Critical Dashboard data first — avoids head-of-line blocking on PRONOTE's sequential session queue)
      const wave1: Promise<boolean>[] = [];
      if (profile.availableTabs.timetable) {
        wave1.push(fetchTimetableFor(timetableDate, silent, allowAutoAdvance));
      }
      if (profile.availableTabs.homework) wave1.push(fetchHomework(silent));
      if (profile.availableTabs.grades) wave1.push(fetchGrades(selectedGradePeriodId, silent));

      const r1 = await Promise.all(wave1);

      // Wave 2 (Secondary views in background immediately after Dashboard is ready)
      const wave2: Promise<boolean>[] = [];
      if (profile.availableTabs.news || profile.availableTabs.discussions) {
        wave2.push(fetchMessages(silent));
      }
      if (profile.availableTabs.attendance) {
        wave2.push(fetchAttendance(selectedAttendancePeriodId, silent));
      }
      if (profile.availableTabs.menus) wave2.push(fetchMenus(menusDate, silent));

      const r2 = await Promise.all(wave2);
      const results = [...r1, ...r2];
      const totalTasks = wave1.length + wave2.length;
      const anySuccess = results.some(Boolean);
      if (anySuccess) {
        const nowIso = new Date().toISOString();
        setIsOffline(false);
        setLastSyncedAt(nowIso);
        setLastUpdated(new Date(nowIso));
      } else if (totalTasks > 0) {
        setIsOffline(true);
      }
      setRefreshing(false);
    },
    [
      profile,
      isOffline,
      timetableDate,
      menusDate,
      selectedGradePeriodId,
      selectedAttendancePeriodId,
      fetchTimetableFor,
      fetchHomework,
      fetchGrades,
      fetchAttendance,
      fetchMessages,
      fetchMenus,
    ]
  );

  // Initial data load when authenticated online
  useEffect(() => {
    if (!profile) return;
    knownGradeIdsRef.current = null;
    knownCanceledIdsRef.current = null;
    if (!isOffline) {
      refreshAll(false, true);
    }
    // Warm up lazy view chunks during idle time so switching tabs is 0ms instant
    const warmTimer = setTimeout(() => {
      void import('./views/GradesView');
      void import('./views/MessagesView');
      void import('./views/AttendanceView');
      void import('./views/MenusView');
      void import('./views/SettingsView');
    }, 1200);
    return () => clearTimeout(warmTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Auto-reconnect seamlessly when internet returns
  useEffect(() => {
    if (!profile) return;
    const onOnline = () => {
      refreshAll(true, !hasAutoAdvancedRef.current);
    };
    const onOffline = () => {
      setIsOffline(true);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [profile, refreshAll]);

  // Background auto-refresh timer
  useEffect(() => {
    if (!profile || settings.refreshIntervalMinutes <= 0) return;
    const ms = settings.refreshIntervalMinutes * 60 * 1000;
    const id = setInterval(() => {
      if (navigator.onLine !== false) refreshAll(true, false);
    }, ms);
    return () => clearInterval(id);
  }, [profile, settings.refreshIntervalMinutes, refreshAll]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!profile) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        refreshAll(false, false);
      } else if (e.ctrlKey && e.key >= '1' && e.key <= '6') {
        const order: NavTab[] = [
          'dashboard',
          'timetable',
          'homework',
          'grades',
          'attendance',
          'messages',
        ];
        const target = order[Number(e.key) - 1];
        if (target) {
          e.preventDefault();
          setActiveTab(target);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [profile, refreshAll]);

  const handleAuthenticated = (newProfile: StudentProfile) => {
    hasAutoAdvancedRef.current = false;
    setIsOffline(false);
    setTimetableDate(getInitialSchoolDate());
    setAutoAdvanceNote(isWeekend(new Date()) ? 'Week-end · Affichage de lundi' : null);
    setActiveTab('dashboard');
    const defGrade =
      newProfile.gradePeriods.find((p) => p.isDefault)?.id ||
      newProfile.gradePeriods[0]?.id ||
      '';
    const defAtt =
      newProfile.attendancePeriods.find((p) => p.isDefault)?.id ||
      newProfile.attendancePeriods[0]?.id ||
      '';
    setSelectedGradePeriodId(defGrade);
    setSelectedAttendancePeriodId(defAtt);
    setProfile(newProfile);
  };

  const handleLogout = async () => {
    await window.pronoteAPI.auth.logout();
    setProfile(null);
    setIsOffline(false);
    setLastSyncedAt(null);
    setMessagingDisabled(false);
    setAutoAdvanceNote(null);
    hasAutoAdvancedRef.current = false;
    cachedSnapRef.current = null;
    timetableWeekCacheRef.current.clear();
    gradesCacheRef.current.clear();
    attendanceCacheRef.current.clear();
    setTimetable(null);
    setHomework([]);
    setGrades(null);
    setAttendance(null);
    setNews([]);
    setDiscussions([]);
    setMenus([]);
    setLastUpdated(null);
    knownGradeIdsRef.current = null;
    knownCanceledIdsRef.current = null;
  };

  const handleChangeTimetableDate = (nextDate: Date) => {
    hasAutoAdvancedRef.current = true;
    setAutoAdvanceNote(null);
    const prevKey = getWeekKey(timetableDate);
    const key = getWeekKey(nextDate);
    setTimetableDate(nextDate);
    // Same week click in Day mode: instant 0ms switch, zero network call!
    if (key === prevKey && timetable) {
      return;
    }
    const memCached = timetableWeekCacheRef.current.get(key) ?? cachedSnapRef.current?.timetables?.[key];
    if (memCached) {
      setTimetable(memCached);
      if (!isOffline) fetchTimetableFor(nextDate, true, false);
      return;
    }
    fetchTimetableFor(nextDate, false, false);
  };

  const handleChangeMenusDate = (nextDate: Date) => {
    setMenusDate(nextDate);
    fetchMenus(nextDate, false);
  };

  const handleSelectGradePeriod = (periodId: string) => {
    setSelectedGradePeriodId(periodId);
    knownGradeIdsRef.current = null;
    const memCached = gradesCacheRef.current.get(periodId) ?? cachedSnapRef.current?.grades?.[periodId];
    if (memCached) {
      setGrades(memCached);
      if (!isOffline) fetchGrades(periodId, true);
      return;
    }
    fetchGrades(periodId, false);
  };

  const handleSelectAttendancePeriod = (periodId: string) => {
    setSelectedAttendancePeriodId(periodId);
    const memCached =
      attendanceCacheRef.current.get(periodId) ?? cachedSnapRef.current?.attendance?.[periodId];
    if (memCached) {
      setAttendance(memCached);
      if (!isOffline) fetchAttendance(periodId, true);
      return;
    }
    fetchAttendance(periodId, false);
  };

  const handleToggleHomework = async (id: string, done: boolean) => {
    if (isOffline) return;
    setHomework((prev) => prev.map((h) => (h.id === id ? { ...h, done } : h)));
    try {
      await window.pronoteAPI.data.setHomeworkDone(id, done);
    } catch {
      setHomework((prev) => prev.map((h) => (h.id === id ? { ...h, done: !done } : h)));
    }
  };

  const handleMarkNewsRead = useCallback(async (newsId: string) => {
    setNews((prev) => prev.map((n) => (n.id === newsId ? { ...n, read: true } : n)));
    try {
      await window.pronoteAPI.data.markNewsRead(newsId);
    } catch {
      // ignore offline
    }
  }, []);

  const handleNewsDetailLoaded = useCallback((updated: NewsItemDTO) => {
    setNews((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  }, []);

  const handleUpdateSettings = async (partial: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
    try {
      const saved = await window.pronoteAPI.system.saveSettings(partial);
      setSettings(saved);
    } catch {
      // ignore
    }
  };

  const handleManualUpdateCheck = async () => {
    setCheckingUpdate(true);
    setUpdateCheckFeedback(null);
    try {
      const info = await window.pronoteAPI.updater.checkForUpdates();
      if (info.updateAvailable) {
        setAvailableUpdate(info);
      } else if (info.error) {
        setUpdateCheckFeedback(`Impossible de vérifier : ${info.error}`);
      } else {
        setUpdateCheckFeedback(`Noctis est à jour (v${info.currentVersion}).`);
      }
    } finally {
      setCheckingUpdate(false);
    }
  };

  const undoneHomeworkCount = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return homework.filter(
      (h) => !h.done && new Date(h.deadline).getTime() >= startOfToday.getTime()
    ).length;
  }, [homework]);

  const unreadMessagesCount = useMemo(() => {
    const unreadNews = news.filter((n) => !n.read).length;
    const unreadDisc = discussions.reduce((s, d) => s + d.numberOfMessagesUnread, 0);
    return unreadNews + unreadDisc;
  }, [news, discussions]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#060608] text-zinc-100 overflow-hidden">
      <TitleBar
        profile={profile}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
        onRefresh={profile ? () => refreshAll(false, false) : undefined}
      />

      {/* Offline Mode Warning Banner */}
      {profile && isOffline && (
        <div className="shrink-0 px-4 py-2 bg-amber-500/12 border-b border-amber-400/25 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200">
          <div className="flex items-center gap-2 min-w-0">
            <WifiOff className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span className="font-semibold">Mode hors ligne</span>
            <span className="text-amber-200/80">
              — Tu n'es pas connecté, les données affichées ne sont pas à jour
              {lastSyncedAt ? ` (dernière synchro : ${formatLastSync(lastSyncedAt)})` : ''}.
            </span>
          </div>
          <button
            onClick={() => refreshAll(false, false)}
            disabled={reconnecting || refreshing}
            className="px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/35 text-amber-100 font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${reconnecting || refreshing ? 'animate-spin' : ''}`} />
            <span>Réessayer</span>
          </button>
        </div>
      )}

      {booting ? (
        <div className="flex-1 flex flex-col items-center justify-center obsidian-glow gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent/90 to-accent/30 border border-white/15 flex items-center justify-center shadow-glow">
            <span className="text-xl font-extrabold text-white">N</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
            <span>Reconnexion à votre espace…</span>
          </div>
        </div>
      ) : !profile ? (
        <LoginView onAuthenticated={handleAuthenticated} />
      ) : (
        <div
          className={`flex-1 min-h-0 flex overflow-hidden ${
            settings.sidebarPosition === 'right' ? 'flex-row-reverse' : 'flex-row'
          }`}
        >
          <Sidebar
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            profile={profile}
            undoneHomeworkCount={undoneHomeworkCount}
            unreadMessagesCount={unreadMessagesCount}
            compact={Boolean(settings.sidebarCompact)}
            position={settings.sidebarPosition || 'left'}
            onLogout={handleLogout}
          />

          <main className="flex-1 min-w-0 overflow-y-auto obsidian-glow bg-[#07070A]">
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
                defaultViewMode={settings.defaultTimetableView || 'week'}
                courseCardStyle={settings.courseCardStyle || 'left'}
                showBreaks={settings.showBreaks !== false}
                onChangeDate={handleChangeTimetableDate}
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
                selectedPeriodId={selectedGradePeriodId}
                loading={loadingGrades}
                onSelectPeriod={handleSelectGradePeriod}
              />
            )}

            {activeTab === 'attendance' && (
              <AttendanceView
                attendance={attendance}
                periods={profile.attendancePeriods}
                selectedPeriodId={selectedAttendancePeriodId}
                loading={loadingAttendance}
                onSelectPeriod={handleSelectAttendancePeriod}
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
                onRefreshAllMessages={async () => {
                  await fetchMessages(true);
                }}
              />
            )}

            {activeTab === 'menus' && (
              <MenusView
                menus={menus}
                selectedDate={menusDate}
                loading={loadingMenus}
                onChangeDate={handleChangeMenusDate}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                profile={profile}
                settings={settings}
                appVersion={appVersion}
                checkingUpdate={checkingUpdate}
                updateFeedback={updateCheckFeedback}
                onCheckUpdates={handleManualUpdateCheck}
                onUpdateSettings={handleUpdateSettings}
                onLogout={handleLogout}
              />
            )}
            </Suspense>
          </main>
        </div>
      )}

      {availableUpdate && (
        <UpdateModal
          update={availableUpdate}
          onDismiss={() => setAvailableUpdate(null)}
        />
      )}
    </div>
  );
}
