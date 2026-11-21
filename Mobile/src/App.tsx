import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  WifiOff,
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
  OfflineCacheSnapshot,
  StudentProfile,
  TimetableResponse,
} from './types';
import { mobilePronote } from './services/pronote';
import { checkMobileUpdate } from './services/updater';
import {
  evaluateDayAutoAdvance,
  formatLastSync,
  getInitialSchoolDate,
  getWeekKey,
  isWeekend,
} from './utils/schoolTime';
import { applyMobileThemeToDocument, DEFAULT_MOBILE_SETTINGS } from './utils/theme';
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
  const [settings, setSettings] = useState<MobileSettings>(DEFAULT_MOBILE_SETTINGS);
  const [refreshing, setRefreshing] = useState(false);

  // Offline / sync state
  const [isOffline, setIsOffline] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [messagingDisabled, setMessagingDisabled] = useState(false);

  const [timetableDate, setTimetableDate] = useState(() => getInitialSchoolDate());
  const [autoAdvanceNote, setAutoAdvanceNote] = useState<string | null>(() =>
    isWeekend(new Date()) ? 'Week-end · Affichage de lundi' : null
  );
  const [timetable, setTimetable] = useState<TimetableResponse | null>(null);
  const [loadingTt, setLoadingTt] = useState(false);

  const [homework, setHomework] = useState<HomeworkDTO[]>([]);
  const [gradePeriodId, setGradePeriodId] = useState('');
  const [grades, setGrades] = useState<GradesOverviewDTO | null>(null);
  const [attPeriodId, setAttPeriodId] = useState('');
  const [attendance, setAttendance] = useState<AttendanceDTO | null>(null);
  const [news, setNews] = useState<NewsItemDTO[]>([]);
  const [discussions, setDiscussions] = useState<DiscussionSummaryDTO[]>([]);
  const [menusDate, setMenusDate] = useState(() => getInitialSchoolDate());
  const [menus, setMenus] = useState<MenuDayDTO[]>([]);

  const [updateInfo, setUpdateInfo] = useState<MobileUpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  const hasAutoAdvancedRef = useRef(false);
  const cachedSnapRef = useRef<OfflineCacheSnapshot | null>(null);

  useEffect(() => {
    applyMobileThemeToDocument(settings);
    if (Capacitor.isNativePlatform()) {
      const bg =
        settings.background === 'amoled'
          ? '#000000'
          : settings.background === 'midnight'
          ? '#050814'
          : settings.background === 'graphite'
          ? '#111216'
          : '#060608';
      StatusBar.setBackgroundColor({ color: bg }).catch(() => {});
    }
  }, [settings]);

  const hydrateFromSnapshot = useCallback((snap: OfflineCacheSnapshot, targetDate: Date) => {
    cachedSnapRef.current = snap;
    setLastSyncedAt(snap.lastSyncedAt || null);
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

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#060608' }).catch(() => {});
    }

    (async () => {
      try {
        const loadedSettings = await mobilePronote.loadSettings();
        setSettings(loadedSettings);
        if (loadedSettings.defaultTab) {
          setTab(loadedSettings.defaultTab);
        }
      } catch {
        // default
      }

      // Check GitHub Releases automatically on every startup (ignore offline errors)
      checkMobileUpdate()
        .then((info) => {
          if (info.updateAvailable) setUpdateInfo(info);
        })
        .catch(() => {});

      try {
        const res = await mobilePronote.restoreSession();
        if (res.ok && res.profile) {
          const initDate = getInitialSchoolDate();
          setTimetableDate(initDate);
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

          // Pre-hydrate cached data immediately so user sees content right away (online OR offline!)
          const snap = await mobilePronote.loadOfflineSnapshot();
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
      } finally {
        setBooting(false);
      }
    })();
  }, [hydrateFromSnapshot]);

  const refreshAll = useCallback(
    async (allowAutoAdvance = false) => {
      if (!profile) return;
      setRefreshing(true);

      // If offline or session not active yet, try reconnecting first without ever logging out!
      if (isOffline || !mobilePronote.isOnlineSessionActive()) {
        setReconnecting(true);
        try {
          const recon = await mobilePronote.reconnectOnline();
          if (!recon.ok) {
            setIsOffline(true);
            setRefreshing(false);
            setReconnecting(false);
            return;
          }
          if (recon.profile) setProfile(recon.profile);
          setIsOffline(false);
        } catch {
          setIsOffline(true);
          setRefreshing(false);
          setReconnecting(false);
          return;
        } finally {
          setReconnecting(false);
        }
      }

      const settled = await Promise.allSettled([
        mobilePronote.getTimetable(timetableDate).then(async (tt) => {
          setTimetable(tt);
          if (allowAutoAdvance && !hasAutoAdvancedRef.current) {
            hasAutoAdvancedRef.current = true;
            const adv = evaluateDayAutoAdvance(tt.items, new Date());
            if (adv.shouldAdvance) {
              setTimetableDate(adv.targetDate);
              setAutoAdvanceNote(adv.label);
              if (getWeekKey(adv.targetDate) !== getWeekKey(timetableDate)) {
                const nextWeekTt = await mobilePronote.getTimetable(adv.targetDate);
                setTimetable(nextWeekTt);
              }
            }
          }
          return true;
        }),
        mobilePronote.getHomework().then((list) => {
          setHomework(list);
          return true;
        }),
        mobilePronote.getGrades(gradePeriodId || undefined).then((g) => {
          setGrades(g);
          return true;
        }),
        mobilePronote.getAttendance(attPeriodId || undefined).then((a) => {
          setAttendance(a);
          return true;
        }),
        mobilePronote.getNews().then((n) => {
          setNews(n);
          setMessagingDisabled(mobilePronote.getRightToDisconnectFromServer());
          return true;
        }),
        mobilePronote.getDiscussions().then((d) => {
          setDiscussions(d);
          setMessagingDisabled(mobilePronote.getRightToDisconnectFromServer());
          return true;
        }),
        mobilePronote.getMenus(menusDate).then((m) => {
          setMenus(m);
          return true;
        }),
      ]);

      const anySuccess = settled.some((s) => s.status === 'fulfilled');
      if (anySuccess) {
        setIsOffline(false);
        setLastSyncedAt(new Date().toISOString());
      } else {
        setIsOffline(true);
      }
      setRefreshing(false);
    },
    [profile, isOffline, timetableDate, gradePeriodId, attPeriodId, menusDate]
  );

  // Initial online fetch after boot / login
  useEffect(() => {
    if (profile && !isOffline) {
      refreshAll(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Auto-reconnect when device comes back online OR app resumes from background!
  useEffect(() => {
    if (!profile) return;

    const onOnline = () => {
      refreshAll(!hasAutoAdvancedRef.current);
    };
    const onOffline = () => {
      setIsOffline(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (navigator.onLine === false) {
          setIsOffline(true);
        } else if (isOffline || !mobilePronote.isOnlineSessionActive()) {
          refreshAll(!hasAutoAdvancedRef.current);
        }
      }
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [profile, isOffline, refreshAll]);

  const handleAuthenticated = (p: StudentProfile) => {
    hasAutoAdvancedRef.current = false;
    setIsOffline(false);
    setTimetableDate(getInitialSchoolDate());
    setAutoAdvanceNote(isWeekend(new Date()) ? 'Week-end · Affichage de lundi' : null);
    setTab(settings.defaultTab || 'dashboard');
    setGradePeriodId(p.gradePeriods.find((x) => x.isDefault)?.id || p.gradePeriods[0]?.id || '');
    setAttPeriodId(p.attendancePeriods.find((x) => x.isDefault)?.id || p.attendancePeriods[0]?.id || '');
    setProfile(p);
  };

  const handleToggleHw = async (id: string, done: boolean) => {
    if (isOffline) return;
    setHomework((prev) => prev.map((h) => (h.id === id ? { ...h, done } : h)));
    try {
      await mobilePronote.setHomeworkDone(id, done);
    } catch {
      setHomework((prev) => prev.map((h) => (h.id === id ? { ...h, done: !done } : h)));
    }
  };

  const handleChangeTimetableDate = async (d: Date) => {
    hasAutoAdvancedRef.current = true;
    setAutoAdvanceNote(null);
    setTimetableDate(d);
    if (isOffline) {
      const snap = cachedSnapRef.current ?? (await mobilePronote.loadOfflineSnapshot());
      const cached = snap?.timetables?.[getWeekKey(d)];
      if (cached) setTimetable(cached);
      return;
    }
    setLoadingTt(true);
    try {
      const tt = await mobilePronote.getTimetable(d);
      setTimetable(tt);
    } catch {
      setIsOffline(true);
      const snap = cachedSnapRef.current ?? (await mobilePronote.loadOfflineSnapshot());
      const cached = snap?.timetables?.[getWeekKey(d)];
      if (cached) setTimetable(cached);
    } finally {
      setLoadingTt(false);
    }
  };

  const handleNewsDetailLoaded = useCallback((updated: NewsItemDTO) => {
    setNews((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  }, []);

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
                <div className="text-xs font-bold text-white leading-none flex items-center gap-1.5">
                  <span>Noctis</span>
                  {isOffline && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold uppercase tracking-wider">
                      Hors ligne
                    </span>
                  )}
                </div>
                <div className="text-[10.5px] text-zinc-500 truncate mt-0.5">
                  {profile.establishmentName}
                </div>
              </div>
            </div>

            <button
              onClick={() => refreshAll(false)}
              disabled={refreshing || reconnecting}
              className="p-2 rounded-xl bg-white/[0.05] text-zinc-300"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing || reconnecting ? 'animate-spin text-accent' : ''}`}
              />
            </button>
          </header>

          {/* Offline Mode Warning Banner */}
          {isOffline && (
            <div className="shrink-0 px-3.5 py-2 bg-amber-500/12 border-b border-amber-400/25 flex items-center justify-between gap-2 text-[11.5px] text-amber-200">
              <div className="flex items-start gap-2 min-w-0">
                <WifiOff className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-0.5" />
                <div className="min-w-0 leading-snug">
                  <span className="font-semibold">Non connecté</span> — Données non à jour
                  {lastSyncedAt ? ` (synchro : ${formatLastSync(lastSyncedAt)})` : ''}.
                </div>
              </div>
              <button
                onClick={() => refreshAll(false)}
                disabled={reconnecting || refreshing}
                className="px-2.5 py-1 rounded-lg bg-amber-400/20 border border-amber-400/35 text-amber-100 text-[11px] font-semibold shrink-0 disabled:opacity-50"
              >
                {reconnecting ? '…' : 'Réessayer'}
              </button>
            </div>
          )}

          {/* Main Scrollable View */}
          <main className="flex-1 overflow-y-auto obsidian-glow bg-[#07070A]">
            {tab === 'dashboard' && (
              <MobileDashboard
                profile={profile}
                timetableItems={timetable?.items ?? []}
                homework={homework}
                grades={grades}
                news={news}
                messagingDisabled={messagingDisabled}
                widgets={settings.dashboardWidgets}
                showBreaks={settings.showBreaks !== false}
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
                autoAdvanceNote={autoAdvanceNote}
                courseCardStyle={settings.courseCardStyle || 'left'}
                showBreaks={settings.showBreaks !== false}
                onChangeDate={handleChangeTimetableDate}
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
                onSelectPeriod={async (id) => {
                  setGradePeriodId(id);
                  if (isOffline) {
                    const snap = cachedSnapRef.current ?? (await mobilePronote.loadOfflineSnapshot());
                    if (snap?.grades?.[id]) setGrades(snap.grades[id]);
                    return;
                  }
                  mobilePronote
                    .getGrades(id)
                    .then(setGrades)
                    .catch(() => setIsOffline(true));
                }}
              />
            )}
            {tab === 'attendance' && (
              <MobileAttendance
                attendance={attendance}
                periods={profile.attendancePeriods}
                selectedPeriodId={attPeriodId}
                onSelectPeriod={async (id) => {
                  setAttPeriodId(id);
                  if (isOffline) {
                    const snap = cachedSnapRef.current ?? (await mobilePronote.loadOfflineSnapshot());
                    if (snap?.attendance?.[id]) setAttendance(snap.attendance[id]);
                    return;
                  }
                  mobilePronote
                    .getAttendance(id)
                    .then(setAttendance)
                    .catch(() => setIsOffline(true));
                }}
              />
            )}
            {tab === 'messages' && (
              <MobileMessages
                news={news}
                discussions={discussions}
                messagingDisabled={messagingDisabled}
                onNewsDetailLoaded={handleNewsDetailLoaded}
                onRefresh={async () => {
                  try {
                    const [n, d] = await Promise.all([
                      mobilePronote.getNews(),
                      mobilePronote.getDiscussions(),
                    ]);
                    setNews(n);
                    setDiscussions(d);
                    setMessagingDisabled(mobilePronote.getRightToDisconnectFromServer());
                  } catch {
                    setIsOffline(true);
                  }
                }}
              />
            )}
            {tab === 'menus' && (
              <MobileMenus
                menus={menus}
                selectedDate={menusDate}
                onChangeDate={(d) => {
                  setMenusDate(d);
                  if (!isOffline) {
                    mobilePronote
                      .getMenus(d)
                      .then(setMenus)
                      .catch(() => setIsOffline(true));
                  }
                }}
              />
            )}
            {tab === 'settings' && (
              <MobileSettingsView
                profile={profile}
                settings={settings}
                checkingUpdate={checkingUpdate}
                updateMsg={updateMsg}
                onUpdateSettings={async (partial) => {
                  const next: MobileSettings = {
                    ...settings,
                    ...partial,
                    dashboardWidgets: partial.dashboardWidgets
                      ? {
                          ...(settings.dashboardWidgets ?? DEFAULT_MOBILE_SETTINGS.dashboardWidgets!),
                          ...partial.dashboardWidgets,
                        }
                      : settings.dashboardWidgets,
                  };
                  setSettings(next);
                  await mobilePronote.saveSettings(next);
                }}
                onCheckUpdate={handleManualUpdate}
                onLogout={async () => {
                  await mobilePronote.logout();
                  cachedSnapRef.current = null;
                  hasAutoAdvancedRef.current = false;
                  setIsOffline(false);
                  setLastSyncedAt(null);
                  setMessagingDisabled(false);
                  setAutoAdvanceNote(null);
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
