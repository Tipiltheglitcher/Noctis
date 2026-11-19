import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
  UpdateInfoDTO,
} from '@shared/types';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { LoginView } from './components/LoginView';
import { UpdateModal } from './components/UpdateModal';
import { DashboardView } from './views/DashboardView';
import { TimetableView } from './views/TimetableView';
import { HomeworkView } from './views/HomeworkView';
import { GradesView } from './views/GradesView';
import { AttendanceView } from './views/AttendanceView';
import { MessagesView } from './views/MessagesView';
import { MenusView } from './views/MenusView';
import { SettingsView } from './views/SettingsView';

const DEFAULT_SETTINGS: AppSettings = {
  accent: 'violet',
  notificationsEnabled: true,
  refreshIntervalMinutes: 10,
};

export default function App() {
  const [booting, setBooting] = useState(true);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Data states
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [timetableDate, setTimetableDate] = useState<Date>(() => new Date());
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

  const [menusDate, setMenusDate] = useState<Date>(() => new Date());
  const [menus, setMenus] = useState<MenuDayDTO[]>([]);
  const [loadingMenus, setLoadingMenus] = useState(false);

  const [appVersion, setAppVersion] = useState('1.0.0');
  const [availableUpdate, setAvailableUpdate] = useState<UpdateInfoDTO | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateCheckFeedback, setUpdateCheckFeedback] = useState<string | null>(null);

  // Refs for detecting new grades / canceled lessons for Windows notifications
  const knownGradeIdsRef = useRef<Set<string> | null>(null);
  const knownCanceledIdsRef = useRef<Set<string> | null>(null);

  // Apply accent color theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-accent', settings.accent);
  }, [settings.accent]);

  // Boot: load settings & attempt encrypted session restore
  useEffect(() => {
    (async () => {
      try {
        const savedSettings = await window.pronoteAPI.system.getSettings();
        setSettings(savedSettings);
      } catch {
        // use defaults
      }

      try {
        const ver = await window.pronoteAPI.updater.getVersion();
        setAppVersion(ver);
      } catch {
        // ignore
      }

      // Check GitHub Releases automatically on every startup
      window.pronoteAPI.updater
        .checkForUpdates()
        .then((info) => {
          if (info.updateAvailable) {
            setAvailableUpdate(info);
          }
        })
        .catch(() => {});

      try {
        const res = await window.pronoteAPI.auth.restoreSession();
        if (res.ok && res.profile) {
          setProfile(res.profile);
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
        }
      } catch {
        // stay on login screen
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const fetchTimetableFor = useCallback(async (date: Date, silent = false) => {
    if (!silent) setLoadingTimetable(true);
    try {
      const data = await window.pronoteAPI.data.getTimetable(date.toISOString());
      setTimetable(data);

      // Check for newly canceled classes
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
    } catch (err) {
      console.error('Timetable fetch failed:', err);
    } finally {
      if (!silent) setLoadingTimetable(false);
    }
  }, []);

  const fetchHomework = useCallback(async (silent = false) => {
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
    } catch (err) {
      console.error('Homework fetch failed:', err);
    } finally {
      if (!silent) setLoadingHomework(false);
    }
  }, []);

  const fetchGrades = useCallback(async (periodId?: string, silent = false) => {
    if (!silent) setLoadingGrades(true);
    try {
      const data = await window.pronoteAPI.data.getGrades(periodId || undefined);
      setGrades(data);

      // Check for newly published grades
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
    } catch (err) {
      console.error('Grades fetch failed:', err);
    } finally {
      if (!silent) setLoadingGrades(false);
    }
  }, []);

  const fetchAttendance = useCallback(async (periodId?: string, silent = false) => {
    if (!silent) setLoadingAttendance(true);
    try {
      const data = await window.pronoteAPI.data.getAttendance(periodId || undefined);
      setAttendance(data);
    } catch (err) {
      console.error('Attendance fetch failed:', err);
    } finally {
      if (!silent) setLoadingAttendance(false);
    }
  }, []);

  const fetchMessages = useCallback(async (silent = false) => {
    if (!silent) setLoadingMessages(true);
    try {
      const [newsRes, discRes] = await Promise.all([
        window.pronoteAPI.data.getNews().catch(() => []),
        window.pronoteAPI.data.getDiscussions().catch(() => []),
      ]);
      setNews(newsRes);
      setDiscussions(discRes);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, []);

  const fetchMenus = useCallback(async (date?: Date, silent = false) => {
    if (!silent) setLoadingMenus(true);
    try {
      const data = await window.pronoteAPI.data.getMenus((date ?? new Date()).toISOString());
      setMenus(data);
    } catch {
      setMenus([]);
    } finally {
      if (!silent) setLoadingMenus(false);
    }
  }, []);

  const refreshAll = useCallback(
    async (silent = false) => {
      if (!profile) return;
      setRefreshing(true);
      const tasks: Promise<unknown>[] = [];
      if (profile.availableTabs.timetable) tasks.push(fetchTimetableFor(timetableDate, silent));
      if (profile.availableTabs.homework) tasks.push(fetchHomework(silent));
      if (profile.availableTabs.grades) tasks.push(fetchGrades(selectedGradePeriodId, silent));
      if (profile.availableTabs.attendance) {
        tasks.push(fetchAttendance(selectedAttendancePeriodId, silent));
      }
      if (profile.availableTabs.news || profile.availableTabs.discussions) {
        tasks.push(fetchMessages(silent));
      }
      if (profile.availableTabs.menus) tasks.push(fetchMenus(menusDate, silent));

      await Promise.allSettled(tasks);
      setLastUpdated(new Date());
      setRefreshing(false);
    },
    [
      profile,
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

  // Initial data load when authenticated
  useEffect(() => {
    if (!profile) return;
    knownGradeIdsRef.current = null;
    knownCanceledIdsRef.current = null;
    refreshAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Background auto-refresh timer
  useEffect(() => {
    if (!profile || settings.refreshIntervalMinutes <= 0) return;
    const ms = settings.refreshIntervalMinutes * 60 * 1000;
    const id = setInterval(() => {
      refreshAll(true);
    }, ms);
    return () => clearInterval(id);
  }, [profile, settings.refreshIntervalMinutes, refreshAll]);

  // Keyboard shortcuts (Ctrl+R refresh, Ctrl+1..6 navigate)
  useEffect(() => {
    if (!profile) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        refreshAll(false);
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
    setProfile(newProfile);
    setActiveTab('dashboard');
    setTimetableDate(new Date());
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
    setLastUpdated(null);
    knownGradeIdsRef.current = null;
    knownCanceledIdsRef.current = null;
  };

  const handleChangeTimetableDate = (nextDate: Date) => {
    setTimetableDate(nextDate);
    fetchTimetableFor(nextDate, false);
  };

  const handleChangeMenusDate = (nextDate: Date) => {
    setMenusDate(nextDate);
    fetchMenus(nextDate, false);
  };

  const handleSelectGradePeriod = (periodId: string) => {
    setSelectedGradePeriodId(periodId);
    knownGradeIdsRef.current = null;
    fetchGrades(periodId, false);
  };

  const handleSelectAttendancePeriod = (periodId: string) => {
    setSelectedAttendancePeriodId(periodId);
    fetchAttendance(periodId, false);
  };

  const handleToggleHomework = async (id: string, done: boolean) => {
    // Optimistic UI update
    setHomework((prev) => prev.map((h) => (h.id === id ? { ...h, done } : h)));
    try {
      await window.pronoteAPI.data.setHomeworkDone(id, done);
    } catch {
      // Revert on failure
      setHomework((prev) => prev.map((h) => (h.id === id ? { ...h, done: !done } : h)));
    }
  };

  const handleMarkNewsRead = useCallback(async (newsId: string) => {
    setNews((prev) => prev.map((n) => (n.id === newsId ? { ...n, read: true } : n)));
    try {
      await window.pronoteAPI.data.markNewsRead(newsId);
    } catch {
      // ignore
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
        onRefresh={profile ? () => refreshAll(false) : undefined}
      />

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
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <Sidebar
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            profile={profile}
            undoneHomeworkCount={undoneHomeworkCount}
            unreadMessagesCount={unreadMessagesCount}
            onLogout={handleLogout}
          />

          <main className="flex-1 min-w-0 overflow-y-auto obsidian-glow bg-[#07070A]">
            {activeTab === 'dashboard' && (
              <DashboardView
                profile={profile}
                timetableItems={timetable?.items ?? []}
                homework={homework}
                grades={grades}
                news={news}
                loading={refreshing}
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
                onMarkNewsRead={handleMarkNewsRead}
                onNewsDetailLoaded={handleNewsDetailLoaded}
                onRefreshAllMessages={() => fetchMessages(true)}
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
