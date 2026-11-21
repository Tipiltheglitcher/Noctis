import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import {
  AccountKind,
  AttachmentKind,
  BadCredentialsError,
  DoubleAuthMode,
  GradeKind,
  ResourceContentCategory,
  SecurityError,
  SessionExpiredError,
  TabLocation,
  assignmentStatus,
  assignmentsFromIntervals,
  cleanURL,
  clearPresenceInterval,
  createSessionHandle,
  discussionMessages,
  discussionSendMessage,
  discussions,
  finishLoginManually,
  frequency,
  geolocation,
  gradesOverview,
  instance,
  loginCredentials,
  loginQrCode,
  loginToken,
  menus,
  news,
  newsInformationAcknowledge,
  newsQuestionLocalMutate,
  newsRead,
  newsSurveySend,
  notebook,
  parseTimetable,
  resource,
  resourceAssignments,
  securityCheckPIN,
  securitySave,
  securitySource,
  startPresenceInterval,
  timetableFromWeek,
  translateToWeekNumber,
  type Assignment,
  type Attachment,
  type Discussion,
  type GradeValue,
  type Meal,
  type NewsInformation,
  type NewsQuestion,
  type NewsSurvey,
  type Period,
  type RefreshInformation,
  type SessionHandle,
} from '@blockshub/pawnote-lts';
import type {
  AttachmentDTO,
  AttendanceDTO,
  AuthResult,
  DiscussionSummaryDTO,
  DiscussionThreadDTO,
  GradeValueDTO,
  GradesOverviewDTO,
  HomeworkDTO,
  LessonDetailsDTO,
  MealDTO,
  MenuDayDTO,
  MobileSettings,
  NewsItemDTO,
  NewsQuestionDTO,
  OfflineCacheSnapshot,
  PeriodDTO,
  SchoolSearchResult,
  StudentProfile,
  TimetableItemDTO,
  TimetableResponse,
} from '@/types';
import { getWeekKey } from '@/utils/schoolTime';
import { mobileFetcher } from './fetcher';

const SESSION_KEY = 'noctis_mobile_session_v1';
const SETTINGS_KEY = 'noctis_mobile_settings_v1';
const CACHE_KEY = 'noctis_mobile_cache_v1';
const DEMO_URL = 'https://demo.index-education.net/pronote';

interface SavedAuthData {
  url: string;
  username: string;
  token: string;
  deviceUUID: string;
  kind: number;
  navigatorIdentifier?: string;
}

function makeUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

class MobilePronoteService {
  private session: SessionHandle | null = null;
  private isDemo = false;
  private currentAuth: SavedAuthData | null = null;
  private profileCache: StudentProfile | null = null;
  private pendingSecurity: {
    session: SessionHandle;
    error: SecurityError;
    deviceUUID: string;
    isDemo: boolean;
  } | null = null;
  private newsMap = new Map<string, NewsInformation | NewsSurvey>();
  private discussionsMap = new Map<string, Discussion>();
  private cacheMem: OfflineCacheSnapshot | null = null;
  private disconnectMessagingDisabled = false;

  public getRightToDisconnectFromServer(): boolean {
    return this.disconnectMessagingDisabled;
  }

  public isOnlineSessionActive(): boolean {
    return this.session !== null;
  }

  public async loadOfflineSnapshot(): Promise<OfflineCacheSnapshot | null> {
    if (this.cacheMem) return this.cacheMem;
    try {
      const { value } = await Preferences.get({ key: CACHE_KEY });
      if (!value) return null;
      const parsed = JSON.parse(value) as OfflineCacheSnapshot;
      if (!parsed || !parsed.profile) return null;
      this.cacheMem = parsed;
      return parsed;
    } catch {
      return null;
    }
  }

  private async persistCache(mutator: (snap: OfflineCacheSnapshot) => void): Promise<void> {
    if (this.isDemo) return;
    try {
      const existing = await this.loadOfflineSnapshot();
      const baseProfile = this.profileCache ?? existing?.profile;
      if (!baseProfile) return;
      const snap: OfflineCacheSnapshot = existing
        ? { ...existing, profile: baseProfile }
        : {
            profile: baseProfile,
            lastSyncedAt: new Date().toISOString(),
            timetables: {},
            latestTimetable: null,
            homework: [],
            grades: {},
            latestGrades: null,
            attendance: {},
            latestAttendance: null,
            news: [],
            discussions: [],
            menus: [],
          };
      mutator(snap);
      snap.lastSyncedAt = new Date().toISOString();
      // Keep only the 4 most recent weeks of timetables so storage stays tiny
      const ttKeys = Object.keys(snap.timetables);
      if (ttKeys.length > 4) {
        for (const k of ttKeys.sort().slice(0, ttKeys.length - 4)) {
          delete snap.timetables[k];
        }
      }
      this.cacheMem = snap;
      await Preferences.set({ key: CACHE_KEY, value: JSON.stringify(snap) });
    } catch {
      // ignore storage quota errors
    }
  }

  private resetSession(): void {
    if (this.session) {
      try {
        clearPresenceInterval(this.session);
      } catch {
        // ignore
      }
    }
    this.session = null;
    this.profileCache = null;
    this.pendingSecurity = null;
    this.newsMap.clear();
    this.discussionsMap.clear();
  }

  private formatGradeValue(gv: GradeValue): GradeValueDTO {
    const labels: Record<number, string> = {
      [GradeKind.Error]: 'Err.',
      [GradeKind.Grade]: gv.points.toFixed(2).replace(/\.00$/, '').replace('.', ','),
      [GradeKind.Absent]: 'Abs',
      [GradeKind.Exempted]: 'Disp',
      [GradeKind.NotGraded]: 'N.Not',
      [GradeKind.Unfit]: 'Inap',
      [GradeKind.Unreturned]: 'N.Rdu',
      [GradeKind.AbsentZero]: 'Abs (0)',
      [GradeKind.UnreturnedZero]: 'N.Rdu (0)',
      [GradeKind.Congratulations]: 'Félic.',
    };
    return {
      kind: gv.kind,
      points: gv.points,
      label: labels[gv.kind] ?? String(gv.points),
    };
  }

  private mapAttachment(att: Attachment): AttachmentDTO {
    return {
      id: att.id,
      name: att.name,
      url: att.url,
      kind: att.kind === AttachmentKind.Link ? 'link' : 'file',
    };
  }

  private mapAssignment(a: Assignment): HomeworkDTO {
    return {
      id: a.id,
      subject: a.subject.name,
      description: a.description,
      backgroundColor: a.backgroundColor,
      done: a.done,
      deadline: a.deadline.toISOString(),
      difficulty: a.difficulty,
      lengthMinutes: a.length,
      themes: (a.themes ?? []).map((t) => t.name),
      attachments: (a.attachments ?? []).map((att) => this.mapAttachment(att)),
      returnKind: a.return?.kind ?? 0,
    };
  }

  private mapPeriods(tabLocation: TabLocation): PeriodDTO[] {
    if (!this.session) return [];
    const tab = this.session.userResource.tabs.get(tabLocation);
    const list: Period[] = tab?.periods?.length ? tab.periods : this.session.instance.periods ?? [];
    const defaultId = tab?.defaultPeriod?.id;
    return list.map((p, idx) => ({
      id: p.id,
      name: p.name,
      startDate: p.startDate.toISOString(),
      endDate: p.endDate.toISOString(),
      isDefault: defaultId ? p.id === defaultId : idx === 0,
    }));
  }

  private findPeriod(tabLocation: TabLocation, periodId?: string): Period | undefined {
    if (!this.session) return undefined;
    const tab = this.session.userResource.tabs.get(tabLocation);
    const list: Period[] = tab?.periods?.length ? tab.periods : this.session.instance.periods ?? [];
    if (periodId) {
      const found = list.find((p) => p.id === periodId);
      if (found) return found;
    }
    return tab?.defaultPeriod ?? list[0];
  }

  private extractFirstName(fullName: string): string {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 1) return fullName.trim() || 'Élève';
    const nonAllCaps = parts.filter((p) => p !== p.toUpperCase() || p.length <= 1);
    return nonAllCaps[0] || parts[parts.length - 1];
  }

  private async buildProfile(): Promise<StudentProfile> {
    if (!this.session) throw new Error('Aucune session active.');
    const resourceItem = this.session.userResource;
    const tabs = this.session.user.authorizations.tabs;
    const hasTab = (loc: TabLocation) => tabs.includes(loc);

    const profile: StudentProfile = {
      name: resourceItem.name || this.session.user.name,
      firstName: this.extractFirstName(resourceItem.name || this.session.user.name),
      className: resourceItem.className || 'Élève',
      establishmentName: resourceItem.establishmentName || 'Établissement',
      profilePicture: resourceItem.profilePicture?.url,
      instanceUrl: this.session.information.url,
      isDemo: this.isDemo,
      availableTabs: {
        timetable: hasTab(TabLocation.Timetable),
        homework: hasTab(TabLocation.Assignments),
        grades: hasTab(TabLocation.Grades),
        attendance: hasTab(TabLocation.Notebook),
        news: hasTab(TabLocation.News),
        discussions:
          hasTab(TabLocation.Discussions) && this.session.user.authorizations.canReadDiscussions,
        menus: hasTab(TabLocation.Menus),
      },
      gradePeriods: this.mapPeriods(TabLocation.Grades),
      attendancePeriods: this.mapPeriods(TabLocation.Notebook),
    };
    this.profileCache = profile;
    return profile;
  }

  private async finalizeAuthenticatedSession(
    session: SessionHandle,
    refresh: RefreshInformation,
    deviceUUID: string,
    isDemo: boolean
  ): Promise<AuthResult> {
    this.resetSession();
    this.session = session;
    this.isDemo = isDemo;
    startPresenceInterval(session);

    if (!isDemo) {
      const authData: SavedAuthData = {
        url: refresh.url,
        username: refresh.username,
        token: refresh.token,
        deviceUUID,
        kind: refresh.kind,
        navigatorIdentifier: refresh.navigatorIdentifier,
      };
      this.currentAuth = authData;
      await Preferences.set({ key: SESSION_KEY, value: JSON.stringify(authData) });
    } else {
      this.currentAuth = null;
    }

    const profile = await this.buildProfile();
    if (!isDemo) {
      await this.persistCache((snap) => {
        snap.profile = profile;
      });
    }
    return { ok: true, profile, offline: false, lastSyncedAt: new Date().toISOString() };
  }

  private async handlePossibleSecurityError(
    session: SessionHandle,
    error: unknown,
    deviceUUID: string,
    isDemo: boolean
  ): Promise<AuthResult> {
    if (error instanceof SecurityError) {
      const handle = error.handle;
      if (
        !handle.shouldCustomPassword &&
        !handle.shouldCustomDoubleAuth &&
        handle.shouldEnterSource &&
        !handle.shouldEnterPIN
      ) {
        await securitySource(session, 'Noctis Android');
        await securitySave(session, handle, {
          mode: DoubleAuthMode.MGDA_NotificationSeulement,
          deviceName: 'Noctis Android',
        });
        const refresh = await finishLoginManually(
          session,
          handle.context.authentication,
          handle.context.identity,
          handle.context.initialUsername
        );
        return this.finalizeAuthenticatedSession(session, refresh, deviceUUID, isDemo);
      }

      this.pendingSecurity = { session, error, deviceUUID, isDemo };
      return {
        ok: false,
        challenge: {
          required: true,
          shouldEnterPIN: handle.shouldEnterPIN,
          shouldEnterSource: handle.shouldEnterSource,
          message: handle.shouldEnterPIN
            ? 'Votre compte PRONOTE requiert votre code PIN de double authentification.'
            : 'Validation de sécurité PRONOTE requise pour cet appareil.',
        },
      };
    }

    if (error instanceof BadCredentialsError) {
      return {
        ok: false,
        invalidCredentials: true,
        error: 'Identifiants ou code PIN incorrects.',
      };
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Erreur de connexion PRONOTE.',
    };
  }

  public async completeSecurityChallenge(payload: {
    pin?: string;
    deviceName?: string;
  }): Promise<AuthResult> {
    if (!this.pendingSecurity) {
      return { ok: false, error: 'Aucune vérification en cours.' };
    }
    const { session, error, deviceUUID, isDemo } = this.pendingSecurity;
    const handle = error.handle;
    try {
      const deviceName = (payload.deviceName || 'Noctis Android').slice(0, 30);
      if (handle.shouldEnterPIN) {
        if (!payload.pin || payload.pin.length < 4) {
          return { ok: false, error: 'Saisissez votre code PIN à 4 chiffres.' };
        }
        const ok = await securityCheckPIN(session, payload.pin);
        if (!ok) return { ok: false, error: 'Code PIN incorrect.' };
      }
      if (handle.shouldEnterSource) {
        await securitySource(session, deviceName);
      }
      await securitySave(session, handle, {
        pin: payload.pin,
        deviceName: handle.shouldEnterSource ? deviceName : undefined,
      });
      const refresh = await finishLoginManually(
        session,
        handle.context.authentication,
        handle.context.identity,
        handle.context.initialUsername
      );
      this.pendingSecurity = null;
      return this.finalizeAuthenticatedSession(session, refresh, deviceUUID, isDemo);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Erreur de validation.' };
    }
  }

  public async loginWithQR(payload: {
    qr: { jeton: string; login: string; url: string };
    pin: string;
  }): Promise<AuthResult> {
    const deviceUUID = makeUUID();
    const session = createSessionHandle(mobileFetcher);
    try {
      const refresh = await loginQrCode(session, {
        qr: payload.qr,
        pin: payload.pin.trim(),
        deviceUUID,
      });
      return this.finalizeAuthenticatedSession(session, refresh, deviceUUID, false);
    } catch (err) {
      return this.handlePossibleSecurityError(session, err, deviceUUID, false);
    }
  }

  public async loginWithToken(payload: {
    url: string;
    username: string;
    token: string;
    deviceUUID: string;
    kind?: number;
    navigatorIdentifier?: string;
  }): Promise<AuthResult> {
    const session = createSessionHandle(mobileFetcher);
    try {
      const refresh = await loginToken(session, {
        url: cleanURL(payload.url),
        kind: (payload.kind ?? AccountKind.STUDENT) as AccountKind,
        username: payload.username,
        token: payload.token,
        deviceUUID: payload.deviceUUID,
        navigatorIdentifier: payload.navigatorIdentifier,
      });
      return this.finalizeAuthenticatedSession(session, refresh, payload.deviceUUID, false);
    } catch (err) {
      return this.handlePossibleSecurityError(session, err, payload.deviceUUID, false);
    }
  }

  public async loginWithCredentials(payload: {
    url: string;
    username: string;
    password: string;
  }): Promise<AuthResult> {
    const deviceUUID = makeUUID();
    const session = createSessionHandle(mobileFetcher);
    try {
      const refresh = await loginCredentials(session, {
        url: cleanURL(payload.url),
        kind: AccountKind.STUDENT,
        username: payload.username.trim(),
        password: payload.password,
        deviceUUID,
      });
      return this.finalizeAuthenticatedSession(session, refresh, deviceUUID, false);
    } catch (err) {
      return this.handlePossibleSecurityError(session, err, deviceUUID, false);
    }
  }

  public async loginDemo(): Promise<AuthResult> {
    const deviceUUID = makeUUID();
    const session = createSessionHandle(mobileFetcher);
    try {
      const refresh = await loginCredentials(session, {
        url: DEMO_URL,
        kind: AccountKind.STUDENT,
        username: 'demonstration',
        password: 'pronotevs',
        deviceUUID,
      });
      return this.finalizeAuthenticatedSession(session, refresh, deviceUUID, true);
    } catch (err) {
      return this.handlePossibleSecurityError(session, err, deviceUUID, true);
    }
  }

  public async restoreSession(): Promise<AuthResult> {
    const { value } = await Preferences.get({ key: SESSION_KEY });
    if (!value) return { ok: false };
    try {
      const saved = JSON.parse(value) as SavedAuthData;
      if (!saved.url || !saved.username || !saved.token || !saved.deviceUUID) {
        return { ok: false };
      }
      // Keep saved auth in memory IMMEDIATELY so reconnect works later even if we boot offline!
      this.currentAuth = saved;
      const cached = await this.loadOfflineSnapshot();

      // If browser/device explicitly reports offline, don't hang waiting for network timeout
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        if (cached?.profile) {
          this.profileCache = cached.profile;
          return {
            ok: true,
            profile: cached.profile,
            offline: true,
            lastSyncedAt: cached.lastSyncedAt,
          };
        }
        return { ok: false, error: 'Aucune connexion internet.' };
      }

      const res = await this.loginWithToken(saved);
      if (res.ok) {
        return res;
      }

      // ONLY wipe saved credentials if PRONOTE explicitly rejected the token while online!
      // NEVER wipe session on network/offline/timeout errors!
      if (res.invalidCredentials) {
        await Preferences.remove({ key: SESSION_KEY });
        await Preferences.remove({ key: CACHE_KEY });
        this.currentAuth = null;
        this.cacheMem = null;
        return res;
      }

      // Network / server unreachable -> seamlessly open app in Offline Mode using cached snapshot!
      if (cached?.profile) {
        this.profileCache = cached.profile;
        return {
          ok: true,
          profile: cached.profile,
          offline: true,
          lastSyncedAt: cached.lastSyncedAt,
        };
      }

      return res;
    } catch {
      const cached = await this.loadOfflineSnapshot();
      if (cached?.profile) {
        this.profileCache = cached.profile;
        return {
          ok: true,
          profile: cached.profile,
          offline: true,
          lastSyncedAt: cached.lastSyncedAt,
        };
      }
      return { ok: false };
    }
  }

  public async reconnectOnline(): Promise<AuthResult> {
    if (this.session && this.profileCache) {
      return { ok: true, profile: this.profileCache, offline: false };
    }
    if (!this.currentAuth) {
      const { value } = await Preferences.get({ key: SESSION_KEY });
      if (value) {
        try {
          this.currentAuth = JSON.parse(value) as SavedAuthData;
        } catch {
          // ignore
        }
      }
    }
    if (!this.currentAuth) return { ok: false, error: 'Aucune session enregistrée.' };
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return { ok: false, error: 'Toujours hors ligne.' };
    }
    return this.loginWithToken(this.currentAuth);
  }

  public async logout(): Promise<void> {
    this.resetSession();
    this.currentAuth = null;
    this.isDemo = false;
    this.cacheMem = null;
    this.disconnectMessagingDisabled = false;
    await Preferences.remove({ key: SESSION_KEY });
    await Preferences.remove({ key: CACHE_KEY });
  }

  public async loadSettings(): Promise<MobileSettings> {
    const defaults: MobileSettings = {
      accent: 'violet',
      customAccentHex: '#8B74FF',
      background: 'obsidian',
      glowEnabled: true,
      shape: 'rounded',
      cardStyle: 'solid',
      density: 'normal',
      fontScale: 'md',
      defaultTab: 'dashboard',
      courseCardStyle: 'left',
      showBreaks: true,
      dashboardWidgets: {
        showKpis: true,
        showTimetable: true,
        showHomework: true,
      },
    };
    const { value } = await Preferences.get({ key: SETTINGS_KEY });
    if (!value) return defaults;
    try {
      const parsed = JSON.parse(value) as Partial<MobileSettings>;
      return {
        ...defaults,
        ...parsed,
        dashboardWidgets: {
          ...defaults.dashboardWidgets!,
          ...(parsed.dashboardWidgets ?? {}),
        },
      };
    } catch {
      return defaults;
    }
  }

  public async saveSettings(next: MobileSettings): Promise<MobileSettings> {
    await Preferences.set({ key: SETTINGS_KEY, value: JSON.stringify(next) });
    return next;
  }

  private async ensureActiveSession(): Promise<SessionHandle> {
    if (this.session) return this.session;
    if (this.isDemo) {
      const res = await this.loginDemo();
      if (res.ok && this.session) return this.session;
    } else if (this.currentAuth) {
      const res = await this.loginWithToken(this.currentAuth);
      if (res.ok && this.session) return this.session;
    }
    throw new Error('Session expirée.');
  }

  private async withRetry<T>(fn: (s: SessionHandle) => Promise<T>): Promise<T> {
    const session = await this.ensureActiveSession();
    try {
      return await fn(session);
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        this.resetSession();
        const refreshed = await this.ensureActiveSession();
        return fn(refreshed);
      }
      throw err;
    }
  }

  public async searchSchools(query: string): Promise<SchoolSearchResult[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    if (/^https?:\/\//i.test(trimmed) || trimmed.includes('index-education.net')) {
      try {
        const cleaned = cleanURL(trimmed);
        const info = await instance(cleaned, mobileFetcher);
        return [{ name: info.name || cleaned, url: cleaned, postalCode: '', distanceKm: 0 }];
      } catch {
        return [];
      }
    }

    try {
      const geoUrl = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(trimmed)}&limit=4`;
      let geoJson: { features?: Array<{ geometry?: { coordinates?: [number, number] } }> };

      if (Capacitor.isNativePlatform()) {
        const res = await CapacitorHttp.get({ url: geoUrl });
        geoJson = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      } else {
        geoJson = await (await fetch(geoUrl)).json();
      }

      const byUrl = new Map<string, SchoolSearchResult>();
      await Promise.all(
        (geoJson.features ?? []).slice(0, 3).map(async (f) => {
          const coords = f.geometry?.coordinates;
          if (!coords) return;
          const [longitude, latitude] = coords;
          try {
            const found = await geolocation({ latitude, longitude }, mobileFetcher);
            for (const item of found) {
              const cleaned = cleanURL(item.url);
              if (!byUrl.has(cleaned)) {
                byUrl.set(cleaned, {
                  name: item.name,
                  url: cleaned,
                  postalCode: String(item.postalCode).padStart(5, '0'),
                  distanceKm: Math.round((item.distance / 1000) * 10) / 10,
                });
              }
            }
          } catch {
            // ignore
          }
        })
      );

      const tokens = trimmed
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/\s+/)
        .filter((t) => t.length >= 2);

      return Array.from(byUrl.values())
        .sort((a, b) => {
          const normA = a.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const normB = b.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const sA = tokens.filter((t) => normA.includes(t)).length;
          const sB = tokens.filter((t) => normB.includes(t)).length;
          if (sB !== sA) return sB - sA;
          return a.distanceKm - b.distanceKm;
        })
        .slice(0, 15);
    } catch {
      return [];
    }
  }

  public async getTimetable(date: Date): Promise<TimetableResponse> {
    return this.withRetry(async (session) => {
      const monday = new Date(date);
      const day = monday.getDay();
      monday.setDate(monday.getDate() + (day === 0 ? -6 : 1 - day));
      monday.setHours(0, 0, 0, 0);

      const weekNum = Math.max(1, translateToWeekNumber(monday, session.instance.firstMonday));
      const raw = await timetableFromWeek(session, weekNum);
      parseTimetable(session, raw, {
        withSuperposedCanceledClasses: false,
        withCanceledClasses: true,
        withPlannedClasses: true,
      });

      const freq = frequency(session, weekNum);

      const items: TimetableItemDTO[] = raw.classes
        .map((cls): TimetableItemDTO => {
          if (cls.is === 'lesson') {
            return {
              id: cls.id,
              kind: 'lesson',
              title: cls.subject?.name || cls.status || 'Cours',
              startDate: cls.startDate.toISOString(),
              endDate: cls.endDate.toISOString(),
              backgroundColor: cls.backgroundColor,
              teachers: cls.teacherNames ?? [],
              classrooms: cls.classrooms ?? [],
              groups: cls.groupNames ?? [],
              status: cls.status,
              canceled: cls.canceled,
              exempted: cls.exempted,
              test: cls.test,
              notes: cls.notes,
              virtualClassrooms: cls.virtualClassrooms ?? [],
              lessonResourceID: cls.lessonResourceID,
            };
          }
          if (cls.is === 'activity') {
            return {
              id: cls.id,
              kind: 'activity',
              title: cls.title || 'Activité',
              startDate: cls.startDate.toISOString(),
              endDate: cls.endDate.toISOString(),
              backgroundColor: cls.backgroundColor,
              teachers: cls.attendants ?? [],
              classrooms: cls.resourceValue ? [cls.resourceValue] : [],
              groups: [],
              canceled: false,
              exempted: false,
              test: false,
              notes: cls.notes,
              virtualClassrooms: [],
            };
          }
          return {
            id: cls.id,
            kind: 'detention',
            title: cls.title || 'Retenue',
            startDate: cls.startDate.toISOString(),
            endDate: cls.endDate.toISOString(),
            backgroundColor: cls.backgroundColor || '#ef4444',
            teachers: [...(cls.teacherNames ?? []), ...(cls.personalNames ?? [])],
            classrooms: cls.classrooms ?? [],
            groups: [],
            status: 'Retenue',
            canceled: false,
            exempted: false,
            test: false,
            notes: cls.notes,
            virtualClassrooms: [],
          };
        })
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

      const result: TimetableResponse = { weekNumber: weekNum, weekFrequency: freq?.label, items };
      const wkKey = getWeekKey(date);
      void this.persistCache((snap) => {
        snap.timetables[wkKey] = result;
        snap.latestTimetable = result;
      });
      return result;
    });
  }

  public async getLessonDetails(resourceId: string): Promise<LessonDetailsDTO | null> {
    if (!resourceId) return null;
    return this.withRetry(async (session) => {
      try {
        const res = await resource(session, resourceId);
        let linked: HomeworkDTO[] = [];
        if (res.haveAssignment) {
          try {
            linked = (await resourceAssignments(session, resourceId)).map((a) =>
              this.mapAssignment(a)
            );
          } catch {
            // ignore
          }
        }
        const catMap: Record<number, string> = {
          [ResourceContentCategory.LESSON]: 'Cours',
          [ResourceContentCategory.CORRECTION]: 'Correction',
          [ResourceContentCategory.DST]: 'Devoir sur table',
          [ResourceContentCategory.ORAL_INTERROGATION]: 'Oral',
          [ResourceContentCategory.TD]: 'TD',
          [ResourceContentCategory.TP]: 'TP',
          [ResourceContentCategory.EVALUATION_COMPETENCES]: 'Évaluation',
          [ResourceContentCategory.EPI]: 'EPI',
          [ResourceContentCategory.AP]: 'AP',
          [ResourceContentCategory.VISIO]: 'Visio',
        };
        return {
          id: res.id,
          subject: res.subject.name,
          teachers: res.teachers ?? [],
          groups: res.groups ?? [],
          haveAssignment: res.haveAssignment,
          contents: (res.contents ?? []).map((c) => ({
            id: c.id,
            title: c.title,
            description: c.description,
            categoryLabel: c.categoryText || catMap[c.category],
            themes: (c.themes ?? []).map((t) => t.name),
            files: (c.files ?? []).map((f) => this.mapAttachment(f)),
          })),
          assignments: linked,
        };
      } catch {
        return null;
      }
    });
  }

  public async getHomework(): Promise<HomeworkDTO[]> {
    return this.withRetry(async (session) => {
      const from = new Date();
      from.setDate(from.getDate() - 3);
      from.setHours(0, 0, 0, 0);
      const to = new Date();
      to.setDate(to.getDate() + 28);
      to.setHours(23, 59, 59, 999);
      const list = await assignmentsFromIntervals(session, from, to);
      const mapped = list
        .map((a) => this.mapAssignment(a))
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
      void this.persistCache((snap) => {
        snap.homework = mapped;
      });
      return mapped;
    });
  }

  public async setHomeworkDone(id: string, done: boolean): Promise<boolean> {
    return this.withRetry(async (session) => {
      await assignmentStatus(session, id, done);
      return true;
    });
  }

  public async getGrades(periodId?: string): Promise<GradesOverviewDTO> {
    return this.withRetry(async (session) => {
      const period = this.findPeriod(TabLocation.Grades, periodId);
      if (!period) return { periodId: '', periodName: 'Période', subjectsAverages: [], grades: [] };
      const data = await gradesOverview(session, period);
      const overview: GradesOverviewDTO = {
        periodId: period.id,
        periodName: period.name,
        overallAverage:
          data.overallAverage?.kind === GradeKind.Grade ? data.overallAverage.points : undefined,
        classAverage:
          data.classAverage?.kind === GradeKind.Grade ? data.classAverage.points : undefined,
        subjectsAverages: data.subjectsAverages.map((sa) => ({
          subject: sa.subject.name,
          subjectId: sa.subject.id,
          student: sa.student?.kind === GradeKind.Grade ? sa.student.points : undefined,
          classAverage:
            sa.class_average?.kind === GradeKind.Grade ? sa.class_average.points : undefined,
          max: sa.max?.kind === GradeKind.Grade ? sa.max.points : undefined,
          min: sa.min?.kind === GradeKind.Grade ? sa.min.points : undefined,
          outOf: sa.outOf?.points ?? sa.defaultOutOf?.points ?? 20,
          backgroundColor: sa.backgroundColor,
        })),
        grades: data.grades
          .map((g) => ({
            id: g.id,
            subject: g.subject.name,
            subjectId: g.subject.id,
            value: this.formatGradeValue(g.value),
            outOf: g.outOf.points || 20,
            date: g.date.toISOString(),
            average: g.average?.kind === GradeKind.Grade ? g.average.points : undefined,
            max: g.max?.kind === GradeKind.Grade ? g.max.points : undefined,
            min: g.min?.kind === GradeKind.Grade ? g.min.points : undefined,
            coefficient: g.coefficient,
            comment: g.comment || '',
            commentaireSurNote: g.commentaireSurNote,
            isBonus: g.isBonus,
            isOptional: g.isOptional,
            subjectFile: g.subjectFile ? this.mapAttachment(g.subjectFile) : undefined,
            correctionFile: g.correctionFile ? this.mapAttachment(g.correctionFile) : undefined,
          }))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      };
      void this.persistCache((snap) => {
        snap.grades[overview.periodId] = overview;
        snap.latestGrades = overview;
      });
      return overview;
    });
  }

  public async getAttendance(periodId?: string): Promise<AttendanceDTO> {
    return this.withRetry(async (session) => {
      const period = this.findPeriod(TabLocation.Notebook, periodId);
      if (!period) {
        return {
          periodId: '',
          periodName: 'Période',
          absences: [],
          delays: [],
          punishments: [],
          observations: [],
        };
      }
      const data = await notebook(session, period);
      const att: AttendanceDTO = {
        periodId: period.id,
        periodName: period.name,
        absences: data.absences.map((a) => ({
          id: a.id,
          startDate: a.startDate.toISOString(),
          endDate: a.endDate.toISOString(),
          justified: a.justified,
          hoursMissed: a.hoursMissed,
          minutesMissed: a.minutesMissed,
          reason: a.reason,
        })),
        delays: data.delays.map((d) => ({
          id: d.id,
          date: d.date.toISOString(),
          minutes: d.minutes,
          justified: d.justified,
          reason: d.reason,
          justification: d.justification,
        })),
        punishments: data.punishments.map((p) => ({
          id: p.id,
          title: p.title,
          reasons: p.reasons ?? [],
          dateGiven: p.dateGiven.toISOString(),
          giver: p.giver,
          workToDo: p.workToDo,
        })),
        observations: data.observations.map((o) => ({
          id: o.id,
          date: o.date.toISOString(),
          name: o.name,
          subject: o.subject?.name,
          reason: o.reason,
        })),
      };
      void this.persistCache((snap) => {
        snap.attendance[att.periodId] = att;
        snap.latestAttendance = att;
      });
      return att;
    });
  }

  private mapNewsQuestion(q: NewsQuestion): NewsQuestionDTO {
    return {
      id: q.id,
      position: q.position,
      kind: q.kind,
      title: q.title || q.fullTitle || '',
      fullTitle: q.fullTitle || q.title || '',
      content: q.content || '',
      attachments: (q.attachments ?? []).map((att) => this.mapAttachment(att)),
      choices: (q.choices ?? []).map((c) => ({
        value: c.value,
        position: c.position,
        isTextInput: c.isTextInput,
      })),
      shouldAnswer: q.shouldAnswer,
      answered: q.answered,
      maximumChoices: q.maximumChoices,
      shouldRespectMaximumChoices: q.shouldRespectMaximumChoices,
      maximumLength: q.maximumLength,
      selectedAnswers: q.selectedAnswers,
      textInputAnswer: q.textInputAnswer,
    };
  }

  private mapNewsItem(item: NewsInformation | NewsSurvey): NewsItemDTO {
    const patched = item as (NewsInformation | NewsSurvey) & { __needsDetail?: boolean };
    if (item.is === 'information') {
      return {
        id: item.id,
        is: 'information',
        title: item.title || 'Information',
        category: item.category?.name || 'Information',
        author: item.author || 'Établissement',
        creationDate: item.creationDate.toISOString(),
        read: item.read,
        content: item.content || '',
        attachments: (item.attachments ?? []).map((att) => this.mapAttachment(att)),
        needToAcknowledge: item.needToAcknowledge,
        acknowledged: item.acknowledged,
        needsDetail: Boolean(patched.__needsDetail),
      };
    }
    return {
      id: item.id,
      is: 'survey',
      title: item.title || 'Sondage',
      category: item.category?.name || 'Sondage',
      author: item.author || 'Établissement',
      creationDate: item.creationDate.toISOString(),
      read: item.read,
      content: '',
      attachments: (item.questions ?? []).flatMap((q) =>
        (q.attachments ?? []).map((att) => this.mapAttachment(att))
      ),
      isAnonymous: item.isAnonymous,
      questions: (item.questions ?? []).map((q) => this.mapNewsQuestion(q)),
      needsDetail: Boolean(patched.__needsDetail),
    };
  }

  public async getNews(): Promise<NewsItemDTO[]> {
    return this.withRetry(async (session) => {
      if (!session.user.authorizations.tabs.includes(TabLocation.News)) return [];
      try {
        const data = (await news(session)) as Awaited<ReturnType<typeof news>> & {
          messagerieDesactivee?: boolean;
        };
        if (typeof data.messagerieDesactivee === 'boolean') {
          this.disconnectMessagingDisabled = data.messagerieDesactivee;
        }
        this.newsMap.clear();
        const mapped = data.items
          .map((item): NewsItemDTO => {
            this.newsMap.set(item.id, item);
            return this.mapNewsItem(item);
          })
          .sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());

        // During Droit à la déconnexion, PRONOTE hides live items -> keep cached items readable!
        if (mapped.length === 0 && data.messagerieDesactivee) {
          const cached = await this.loadOfflineSnapshot();
          if (cached?.news?.length) return cached.news;
        }

        // Preserve any already-fetched non-empty content from cache
        const cached = await this.loadOfflineSnapshot();
        const merged = mapped.map((item) => {
          if (item.needsDetail && cached?.news) {
            const prev = cached.news.find((c) => {
              if (c.id !== item.id || c.needsDetail) return false;
              const hasInfoText = Boolean(c.content?.trim());
              const hasSurveyBody = Boolean(
                c.questions?.some((q) => Boolean(q.content?.trim()) || q.choices.length > 0)
              );
              return hasInfoText || hasSurveyBody || c.attachments.length > 0;
            });
            if (prev) {
              return {
                ...item,
                content: prev.content,
                questions: prev.questions,
                attachments: prev.attachments,
                needsDetail: false,
              };
            }
          }
          return item;
        });

        void this.persistCache((snap) => {
          snap.news = merged;
        });
        return merged;
      } catch {
        const cached = await this.loadOfflineSnapshot();
        return cached?.news ?? [];
      }
    });
  }

  public async getNewsDetail(id: string): Promise<NewsItemDTO | null> {
    if (!this.session) {
      const cached = await this.loadOfflineSnapshot();
      return cached?.news?.find((n) => n.id === id) ?? null;
    }
    return this.withRetry(async () => {
      const item = this.newsMap.get(id) as
        | ((NewsInformation | NewsSurvey) & {
            __needsDetail?: boolean;
            __fetchDetail?: () => Promise<NewsInformation | NewsSurvey>;
          })
        | undefined;
      if (!item) {
        const cached = await this.loadOfflineSnapshot();
        return cached?.news?.find((n) => n.id === id) ?? null;
      }
      const mappedNow = this.mapNewsItem(item);
      const alreadyHasBody =
        mappedNow.is === 'information'
          ? Boolean(mappedNow.content?.trim()) || mappedNow.attachments.length > 0
          : Boolean(
              mappedNow.questions?.some((q) => Boolean(q.content?.trim()) || q.choices.length > 0)
            );
      if ((!item.__needsDetail && alreadyHasBody) || typeof item.__fetchDetail !== 'function') {
        return mappedNow;
      }
      try {
        const full = await item.__fetchDetail();
        this.newsMap.set(id, full);
        const dto = this.mapNewsItem(full);
        void this.persistCache((snap) => {
          snap.news = snap.news.map((n) => (n.id === dto.id ? dto : n));
        });
        return dto;
      } catch {
        return this.mapNewsItem(item);
      }
    });
  }

  public async markNewsRead(id: string): Promise<void> {
    await this.withRetry(async (session) => {
      const item = this.newsMap.get(id);
      if (item) await newsRead(session, item, true);
    });
  }

  public async acknowledgeNews(id: string): Promise<boolean> {
    return this.withRetry(async (session) => {
      const item = this.newsMap.get(id);
      if (!item || item.is !== 'information') return false;
      await newsInformationAcknowledge(session, item, true);
      return true;
    });
  }

  public async answerSurvey(
    id: string,
    answers: Array<{ questionId: string; selectedAnswers?: number[]; textInputAnswer?: string }>
  ): Promise<boolean> {
    return this.withRetry(async (session) => {
      const item = this.newsMap.get(id);
      if (!item || item.is !== 'survey') return false;
      for (const ans of answers) {
        const q = item.questions.find((qq) => qq.id === ans.questionId);
        if (!q) continue;
        if (ans.selectedAnswers && ans.selectedAnswers.length > 0) {
          newsQuestionLocalMutate(q, ans.selectedAnswers, ans.textInputAnswer);
        } else if (ans.textInputAnswer !== undefined) {
          newsQuestionLocalMutate(q, ans.textInputAnswer);
        }
      }
      await newsSurveySend(session, item, true);
      return true;
    });
  }

  public async getDiscussions(): Promise<DiscussionSummaryDTO[]> {
    return this.withRetry(async (session) => {
      if (!session.user.authorizations.canReadDiscussions) return [];
      try {
        const data = (await discussions(session)) as Awaited<ReturnType<typeof discussions>> & {
          messagerieDesactivee?: boolean;
        };
        if (typeof data.messagerieDesactivee === 'boolean' && data.messagerieDesactivee) {
          this.disconnectMessagingDisabled = true;
        }
        this.discussionsMap.clear();
        const mapped = data.items
          .map((d) => {
            const id = d.participantsMessageID;
            this.discussionsMap.set(id, d);
            return {
              id,
              subject: d.subject || '(Sans objet)',
              creator: d.creator || d.recipientName || 'Inconnu',
              date: d.date.toISOString(),
              numberOfMessages: d.numberOfMessages,
              numberOfMessagesUnread: d.numberOfMessagesUnread,
              closed: d.closed,
            };
          })
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (mapped.length === 0 && data.messagerieDesactivee) {
          const cached = await this.loadOfflineSnapshot();
          if (cached?.discussions?.length) return cached.discussions;
        }

        void this.persistCache((snap) => {
          snap.discussions = mapped;
        });
        return mapped;
      } catch {
        const cached = await this.loadOfflineSnapshot();
        return cached?.discussions ?? [];
      }
    });
  }

  public async getDiscussionMessages(id: string): Promise<DiscussionThreadDTO> {
    return this.withRetry(async (session) => {
      const d = this.discussionsMap.get(id);
      if (!d) return { id, canReply: false, messages: [] };
      const thread = await discussionMessages(session, d, true);
      return {
        id,
        canReply:
          !d.closed && thread.sendAction !== undefined && session.user.authorizations.canDiscuss,
        messages: [...thread.sents]
          .sort((a, b) => a.creationDate.getTime() - b.creationDate.getTime())
          .map((m) => ({
            id: m.id,
            content: m.content,
            creationDate: m.creationDate.toISOString(),
            authorName: m.author ? m.author.name : session.userResource.name || 'Moi',
            isSelf: !m.author,
            files: (m.files ?? []).map((att) => this.mapAttachment(att)),
          })),
      };
    });
  }

  public async sendDiscussionReply(id: string, content: string): Promise<boolean> {
    return this.withRetry(async (session) => {
      const d = this.discussionsMap.get(id);
      if (!d || !content.trim()) return false;
      await discussionSendMessage(session, d, content.trim(), false);
      return true;
    });
  }

  private mapMeal(meal?: Meal): MealDTO | undefined {
    if (!meal) return undefined;
    const mapFoods = (
      arr?: ReadonlyArray<{
        name: string;
        allergens: ReadonlyArray<{ name: string; color: string }>;
        labels: ReadonlyArray<{ name: string; color: string }>;
      }>
    ) =>
      (arr ?? []).map((f) => ({
        name: f.name,
        allergens: f.allergens.map((a) => ({ name: a.name, color: a.color })),
        labels: f.labels.map((l) => ({ name: l.name, color: l.color })),
      }));
    return {
      entry: mapFoods(meal.entry),
      main: mapFoods(meal.main),
      side: mapFoods(meal.side),
      fromage: mapFoods(meal.fromage),
      dessert: mapFoods(meal.dessert),
      drink: mapFoods(meal.drink),
    };
  }

  public async getMenus(date?: Date): Promise<MenuDayDTO[]> {
    return this.withRetry(async (session) => {
      if (!session.user.authorizations.tabs.includes(TabLocation.Menus)) return [];
      try {
        const week = await menus(session, date ?? new Date());
        const mapped = week.days.map((d) => ({
          date: d.date.toISOString(),
          lunch: this.mapMeal(d.lunch),
          dinner: this.mapMeal(d.dinner),
        }));
        void this.persistCache((snap) => {
          snap.menus = mapped;
        });
        return mapped;
      } catch {
        const cached = await this.loadOfflineSnapshot();
        return cached?.menus ?? [];
      }
    });
  }
}

export const mobilePronote = new MobilePronoteService();
