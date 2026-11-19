import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  BookCheck,
  Award,
  MoreHorizontal,
  RefreshCw,
  Clock3,
  MessageSquareText,
  UtensilsCrossed,
  Settings,
  Loader2,
  X,
} from 'lucide-react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import type {
  AttendanceDTO,
  DiscussionSummaryDTO,
  GradesOverviewDTO,
  HomeworkDTO,
  MenuDayDTO,
  MobileSettings,
  MobileTab,
  MobileUpdateInfo,
  NewsItemDTO,
  StudentProfile,
  TimetableResponse,
} from './types';
import { mobilePronote } from './services/pronote';
import { checkMobileUpdate } from './services/updater';
import { MobileLogin } from './components/MobileLogin';
import { MobileUpdateSheet } from './components/MobileUpdateSheet';
import {
  MobileAttendance,
  MobileDashboard,
  MobileGrades,
  MobileHomework,
  MobileMenus,
  MobileMessages,
  MobileSettingsView,
  MobileTimetable,
} from './components/MobileViews';

export default function App() {
  const [booting, setBooting] = useState(true);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [tab, setTab] = useState<MobileTab>('dashboard');
  const [moreOpen, setMoreOpen] = useState(false);
  const [settings, setSettings] = useState<MobileSettings>({ accent: 'violet' });
  const [refreshing, setRefreshing] = useState(false);

  const [timetableDate, setTimetableDate] = useState(() => new Date());
  const [timetable, setTimetable] = useState<TimetableResponse | null>(null);
  const [loadingTt, setLoadingTt] = useState(false);

  const [homework, setHomework] = useState<HomeworkDTO[]>([]);
  const [gradePeriodId, setGradePeriodId] = useState('');
  const [grades, setGrades] = useState<GradesOverviewDTO | null>(null);
  const [attPeriodId, setAttPeriodId] = useState('');
  const [attendance, setAttendance] = useState<AttendanceDTO | null>(null);
  const [news, setNews] = useState<NewsItemDTO[]>([]);
  const [discussions, setDiscussions] = useState<DiscussionSummaryDTO[]>([]);
  const [menusDate, setMenusDate] = useState(() => new Date());
  const [menus, setMenus] = useState<MenuDayDTO[]>([]);

  const [updateInfo, setUpdateInfo] = useState<MobileUpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', settings.accent);
  }, [settings.accent]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#060608' }).catch(() => {});
    }

    (async () => {
      try {
        setSettings(await mobilePronote.loadSettings());
      } catch {
        // default
      }

      // Check GitHub Releases automatically on every startup
      checkMobileUpdate()
        .then((info) => {
          if (info.updateAvailable) setUpdateInfo(info);
        })
        .catch(() => {});

      try {
        const res = await mobilePronote.restoreSession();
        if (res.ok && res.profile) {
          setProfile(res.profile);
          setGradePeriodId(
            res.profile.gradePeriods.find((p) => p.isDefault)?.id ||
              res.profile.gradePeriods[0]?.id ||
              ''
          );
          setAttPeriodId(
            res.profile.attendancePeriods.find((p) => p.isDefault)?.id ||
              res.profile.attendancePeriods[0]?.id ||
              ''
          );
        }
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const refreshAll = useCallback(async () => {
    if (!profile) return;
    setRefreshing(true);
    await Promise.allSettled([
      mobilePronote.getTimetable(timetableDate).then(setTimetable),
      mobilePronote.getHomework().then(setHomework),
      mobilePronote.getGrades(gradePeriodId || undefined).then(setGrades),
      mobilePronote.getAttendance(attPeriodId || undefined).then(setAttendance),
      mobilePronote.getNews().then(setNews),
      mobilePronote.getDiscussions().then(setDiscussions),
      mobilePronote.getMenus(menusDate).then(setMenus),
    ]);
    setRefreshing(false);
  }, [profile, timetableDate, gradePeriodId, attPeriodId, menusDate]);

  useEffect(() => {
    if (profile) refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const handleAuthenticated = (p: StudentProfile) => {
    setProfile(p);
    setTab('dashboard');
    setGradePeriodId(p.gradePeriods.find((x) => x.isDefault)?.id || p.gradePeriods[0]?.id || '');
    setAttPeriodId(p.attendancePeriods.find((x) => x.isDefault)?.id || p.attendancePeriods[0]?.id || '');
  };

  const handleToggleHw = async (id: string, done: boolean) => {
    setHomework((prev) => prev.map((h) => (h.id === id ? { ...h, done } : h)));
    try {
      await mobilePronote.setHomeworkDone(id, done);
    } catch {
      setHomework((prev) => prev.map((h) => (h.id === id ? { ...h, done: !done } : h)));
    }
  };

  const handleManualUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateMsg(null);
    try {
      const info = await checkMobileUpdate();
      if (info.updateAvailable) {
        setUpdateInfo(info);
      } else if (info.error) {
        setUpdateMsg(`Erreur : ${info.error}`);
      } else {
        setUpdateMsg(`Noctis Android est à jour (v${info.currentVersion}).`);
      }
    } finally {
      setCheckingUpdate(false);
    }
  };

  if (booting) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#060608] obsidian-glow gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent/90 to-accent/30 flex items-center justify-center shadow-glow">
          <span className="text-xl font-extrabold text-white">N</span>
        </div>
        <Loader2 className="w-4 h-4 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-[#060608] text-zinc-100 overflow-hidden">
      {!profile ? (
        <MobileLogin onAuthenticated={handleAuthenticated} />
      ) : (
        <>
          {/* Top Bar */}
          <header className="safe-top px-4 pb-2.5 bg-[#09090D] border-b border-white/[0.06] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent/90 to-accent/30 flex items-center justify-center font-extrabold text-xs text-white shrink-0">
                N
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white leading-none">Noctis</div>
                <div className="text-[10.5px] text-zinc-500 truncate mt-0.5">
                  {profile.establishmentName}
                </div>
              </div>
            </div>

            <button
              onClick={refreshAll}
              disabled={refreshing}
              className="p-2 rounded-xl bg-white/[0.05] text-zinc-300"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-accent' : ''}`} />
            </button>
          </header>

          {/* Main Scrollable View */}
          <main className="flex-1 overflow-y-auto obsidian-glow bg-[#07070A]">
            {tab === 'dashboard' && (
              <MobileDashboard
                profile={profile}
                timetableItems={timetable?.items ?? []}
                homework={homework}
                grades={grades}
                news={news}
                onNavigate={setTab}
                onToggleHomework={handleToggleHw}
              />
            )}
            {tab === 'timetable' && (
              <MobileTimetable
                timetable={timetable}
                homework={homework}
                selectedDate={timetableDate}
                loading={loadingTt}
                onChangeDate={(d) => {
                  setTimetableDate(d);
                  setLoadingTt(true);
                  mobilePronote
                    .getTimetable(d)
                    .then(setTimetable)
                    .finally(() => setLoadingTt(false));
                }}
                onToggleHomework={handleToggleHw}
              />
            )}
            {tab === 'homework' && (
              <MobileHomework homework={homework} onToggleDone={handleToggleHw} />
            )}
            {tab === 'grades' && (
              <MobileGrades
                grades={grades}
                periods={profile.gradePeriods}
                selectedPeriodId={gradePeriodId}
                onSelectPeriod={(id) => {
                  setGradePeriodId(id);
                  mobilePronote.getGrades(id).then(setGrades);
                }}
              />
            )}
            {tab === 'attendance' && (
              <MobileAttendance
                attendance={attendance}
                periods={profile.attendancePeriods}
                selectedPeriodId={attPeriodId}
                onSelectPeriod={(id) => {
                  setAttPeriodId(id);
                  mobilePronote.getAttendance(id).then(setAttendance);
                }}
              />
            )}
            {tab === 'messages' && (
              <MobileMessages
                news={news}
                discussions={discussions}
                onRefresh={async () => {
                  const [n, d] = await Promise.all([
                    mobilePronote.getNews(),
                    mobilePronote.getDiscussions(),
                  ]);
                  setNews(n);
                  setDiscussions(d);
                }}
              />
            )}
            {tab === 'menus' && (
              <MobileMenus
                menus={menus}
                selectedDate={menusDate}
                onChangeDate={(d) => {
                  setMenusDate(d);
                  mobilePronote.getMenus(d).then(setMenus);
                }}
              />
            )}
            {tab === 'settings' && (
              <MobileSettingsView
                profile={profile}
                settings={settings}
                checkingUpdate={checkingUpdate}
                updateMsg={updateMsg}
                onUpdateSettings={async (next) => {
                  setSettings(next);
                  await mobilePronote.saveSettings(next);
                }}
                onCheckUpdate={handleManualUpdate}
                onLogout={async () => {
                  await mobilePronote.logout();
                  setProfile(null);
                }}
              />
            )}
          </main>

          {/* Bottom Tab Bar */}
          <nav className="safe-bottom bg-[#09090D] border-t border-white/[0.06] grid grid-cols-5 px-2 pt-2 shrink-0">
            {(
              [
                { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
                { id: 'timetable', label: 'Cours', icon: CalendarDays },
                { id: 'homework', label: 'Devoirs', icon: BookCheck },
                { id: 'grades', label: 'Notes', icon: Award },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setMoreOpen(false);
                    setTab(item.id);
                  }}
                  className={`flex flex-col items-center gap-1 py-1 text-[10.5px] font-medium ${
                    active ? 'text-accent' : 'text-zinc-500'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <button
              onClick={() => setMoreOpen(true)}
              className={`flex flex-col items-center gap-1 py-1 text-[10.5px] font-medium ${
                ['attendance', 'messages', 'menus', 'settings'].includes(tab)
                  ? 'text-accent'
                  : 'text-zinc-500'
              }`}
            >
              <MoreHorizontal className="w-5 h-5" />
              <span>Plus</span>
            </button>
          </nav>

          {/* "Plus" Menu Sheet */}
          {moreOpen && (
            <div
              onClick={() => setMoreOpen(false)}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-end"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full rounded-t-3xl bg-[#101018] border-t border-white/10 p-5 space-y-3 safe-bottom"
              >
                <div className="flex items-center justify-between pb-1">
                  <span className="text-sm font-bold text-white">Plus d'espaces</span>
                  <button onClick={() => setMoreOpen(false)} className="text-zinc-400">
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
                          setTab(item.id);
                          setMoreOpen(false);
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
        </>
      )}

      {updateInfo && (
        <MobileUpdateSheet update={updateInfo} onDismiss={() => setUpdateInfo(null)} />
      )}
    </div>
  );
}
