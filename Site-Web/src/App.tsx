import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { GradesView } from '../../PC/src/views/GradesView';
import { AttendanceView } from '../../PC/src/views/AttendanceView';
import { MessagesView } from '../../PC/src/views/MessagesView';
import { MenusView } from '../../PC/src/views/MenusView';
import { SettingsView } from '../../PC/src/views/SettingsView';
import { WebTopBar } from './components/WebTopBar';

export default function App() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [settings, setSettings] = useState<AppSettings>({
    accent: 'violet',
    notificationsEnabled: false,
    refreshIntervalMinutes: 10,
  });
  const [refreshing, setRefreshing] = useState(false);

  const [timetableDate, setTimetableDate] = useState(() => new Date());
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
  const [menusDate, setMenusDate] = useState(() => new Date());
  const [menus, setMenus] = useState<MenuDayDTO[]>([]);
  const [loadingMenus, setLoadingMenus] = useState(false);

  useEffect(() => {
    window.pronoteAPI.system.getSettings().then(setSettings).catch(() => {});
    // Launch directly into the interactive demo with zero login wall
    window.pronoteAPI.auth.loginDemo().then((res) => {
      if (res.ok && res.profile) {
        handleAuthenticated(res.profile);
      }
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', settings.accent);
  }, [settings.accent]);

  const fetchTimetableFor = useCallback(async (date: Date) => {
    setLoadingTimetable(true);
    try {
      setTimetable(await window.pronoteAPI.data.getTimetable(date.toISOString()));
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

  const refreshAll = useCallback(async () => {
    if (!profile) return;
    setRefreshing(true);
    await Promise.allSettled([
      fetchTimetableFor(timetableDate),
      fetchHomework(),
      fetchGrades(gradePeriodId),
      fetchAttendance(attPeriodId),
      fetchMessages(),
      fetchMenus(menusDate),
    ]);
    setRefreshing(false);
  }, [
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
  ]);

  useEffect(() => {
    if (profile) refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const handleAuthenticated = (p: StudentProfile) => {
    setProfile(p);
    setActiveTab('dashboard');
    setGradePeriodId(p.gradePeriods.find((x) => x.isDefault)?.id || p.gradePeriods[0]?.id || '');
    setAttPeriodId(p.attendancePeriods.find((x) => x.isDefault)?.id || p.attendancePeriods[0]?.id || '');
  };

  const handleLogout = async () => {
    window.location.href = './';
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
    <div className="h-screen w-screen flex flex-col bg-[#060608] text-zinc-100 overflow-hidden">
      <WebTopBar profile={profile} refreshing={refreshing} onRefresh={profile ? refreshAll : undefined} />

      {!profile ? (
        <div className="flex-1 flex items-center justify-center text-sm text-zinc-400">
          Chargement de la démo Noctis…
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <Sidebar
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            profile={profile}
            undoneHomeworkCount={undoneCount}
            unreadMessagesCount={unreadCount}
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
                onChangeDate={(d) => {
                  setTimetableDate(d);
                  fetchTimetableFor(d);
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
                appVersion="Web (Auto)"
                checkingUpdate={false}
                updateFeedback="La version Web est toujours à jour automatiquement !"
                onCheckUpdates={() => {}}
                onUpdateSettings={async (p) => {
                  const next = await window.pronoteAPI.system.saveSettings(p);
                  setSettings(next);
                }}
                onLogout={handleLogout}
              />
            )}
          </main>
        </div>
      )}
    </div>
  );
}
