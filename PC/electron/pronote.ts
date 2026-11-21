import crypto from 'node:crypto';
import os from 'node:os';
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
  NewsItemDTO,
  NewsQuestionDTO,
  OfflineCacheSnapshot,
  PeriodDTO,
  SchoolSearchResult,
  StudentProfile,
  TimetableItemDTO,
  TimetableResponse,
} from '../shared/types';
import {
  clearAuthSession,
  clearOfflineCache,
  loadAuthSession,
  loadOfflineCache,
  saveAuthSession,
  saveOfflineCache,
  type SavedAuthData,
} from './storage';

function weekKeyFromDate(d: Date): string {
  const m = new Date(d);
  const day = m.getDay();
  m.setDate(m.getDate() + (day === 0 ? -6 : 1 - day));
  m.setHours(0, 0, 0, 0);
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(
    m.getDate()
  ).padStart(2, '0')}`;
}

const DEMO_URL = 'https://demo.index-education.net/pronote';

interface PendingSecurityState {
  session: SessionHandle;
  error: SecurityError;
  deviceUUID: string;
  isDemo: boolean;
}

class PronoteService {
  private session: SessionHandle | null = null;
  private isDemo = false;
  private currentAuth: SavedAuthData | null = null;
  private profileCache: StudentProfile | null = null;
  private pendingSecurity: PendingSecurityState | null = null;
  private newsMap = new Map<string, NewsInformation | NewsSurvey>();
  private discussionsMap = new Map<string, Discussion>();
  private cacheMem: OfflineCacheSnapshot | null = null;
  private disconnectMessagingDisabled = false;

  public getOfflineSnapshot(): OfflineCacheSnapshot | null {
    if (!this.cacheMem) {
      this.cacheMem = loadOfflineCache();
    }
    return this.cacheMem;
  }

  public getMessagingDisabled(): boolean {
    return this.disconnectMessagingDisabled;
  }

  private persistCache(mutator: (snap: OfflineCacheSnapshot) => void): void {
    if (this.isDemo) return;
    try {
      const existing = this.getOfflineSnapshot();
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
      const ttKeys = Object.keys(snap.timetables);
      if (ttKeys.length > 4) {
        for (const k of ttKeys.sort().slice(0, ttKeys.length - 4)) {
          delete snap.timetables[k];
        }
      }
      this.cacheMem = snap;
      saveOfflineCache(snap);
    } catch {
      // ignore
    }
  }

  private getDeviceName(): string {
    const raw = `Noctis (${os.hostname()})`;
    return raw.length > 30 ? 'Noctis' : raw;
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
    // Pronote often formats names as "DUPONT Lucas" or "Lucas DUPONT"
    const nonAllCaps = parts.filter((p) => p !== p.toUpperCase() || p.length <= 1);
    if (nonAllCaps.length > 0) return nonAllCaps[0];
    return parts[parts.length - 1];
  }

  private async fetchProfilePictureDataUri(url?: string): Promise<string | undefined> {
    if (!url) return undefined;
    try {
      const res = await fetch(url);
      if (!res.ok) return undefined;
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      const arrBuf = await res.arrayBuffer();
      const b64 = Buffer.from(arrBuf).toString('base64');
      return `data:${contentType};base64,${b64}`;
    } catch {
      return undefined;
    }
  }

  private async buildProfile(): Promise<StudentProfile> {
    if (!this.session) throw new Error('Aucune session active.');
    const resource = this.session.userResource;
    const tabs = this.session.user.authorizations.tabs;
    const hasTab = (loc: TabLocation) => tabs.includes(loc);
    const profilePicture = await this.fetchProfilePictureDataUri(resource.profilePicture?.url);

    const profile: StudentProfile = {
      name: resource.name || this.session.user.name,
      firstName: this.extractFirstName(resource.name || this.session.user.name),
      className: resource.className || 'Élève',
      establishmentName: resource.establishmentName || 'Établissement',
      profilePicture,
      instanceUrl: this.session.information.url,
      isDemo: this.isDemo,
      availableTabs: {
        timetable: hasTab(TabLocation.Timetable),
        homework: hasTab(TabLocation.Assignments),
        grades: hasTab(TabLocation.Grades),
        attendance: hasTab(TabLocation.Notebook),
        news: hasTab(TabLocation.News),
        discussions: hasTab(TabLocation.Discussions) && this.session.user.authorizations.canReadDiscussions,
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
      saveAuthSession(authData);
    } else {
      this.currentAuth = null;
    }

    const profile = await this.buildProfile();
    if (!isDemo) {
      this.persistCache((snap) => {
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
      // Automatic non-interactive device registration if only source name is requested
      if (
        !handle.shouldCustomPassword &&
        !handle.shouldCustomDoubleAuth &&
        handle.shouldEnterSource &&
        !handle.shouldEnterPIN
      ) {
        const deviceName = this.getDeviceName();
        await securitySource(session, deviceName);
        await securitySave(session, handle, {
          mode: DoubleAuthMode.MGDA_NotificationSeulement,
          deviceName,
        });
        const refresh = await finishLoginManually(
          session,
          handle.context.authentication,
          handle.context.identity,
          handle.context.initialUsername
        );
        return this.finalizeAuthenticatedSession(session, refresh, deviceUUID, isDemo);
      }

      // Interactive challenge required (e.g. PRONOTE 2FA PIN)
      this.pendingSecurity = { session, error, deviceUUID, isDemo };
      return {
        ok: false,
        challenge: {
          required: true,
          shouldEnterPIN: handle.shouldEnterPIN,
          shouldEnterSource: handle.shouldEnterSource,
          shouldCustomPassword: handle.shouldCustomPassword,
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
        error: 'Identifiants ou code PIN incorrects. Vérifiez vos informations et réessayez.',
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || 'Erreur de connexion à PRONOTE.' };
  }

  public async completeSecurityChallenge(payload: {
    pin?: string;
    deviceName?: string;
  }): Promise<AuthResult> {
    if (!this.pendingSecurity) {
      return { ok: false, error: 'Aucune vérification de sécurité en cours.' };
    }

    const { session, error, deviceUUID, isDemo } = this.pendingSecurity;
    const handle = error.handle;

    try {
      const deviceName = (payload.deviceName || this.getDeviceName()).slice(0, 30);

      if (handle.shouldEnterPIN) {
        if (!payload.pin || payload.pin.length < 4) {
          return { ok: false, error: 'Veuillez saisir votre code PIN PRONOTE (4 chiffres).' };
        }
        const valid = await securityCheckPIN(session, payload.pin);
        if (!valid) {
          return { ok: false, error: 'Code PIN de double authentification incorrect.' };
        }
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
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `Échec de la validation : ${message}` };
    }
  }

  public async loginWithQR(payload: {
    qr: { jeton: string; login: string; url: string };
    pin: string;
  }): Promise<AuthResult> {
    const deviceUUID = crypto.randomUUID();
    const session = createSessionHandle();
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
    const session = createSessionHandle();
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
    const deviceUUID = crypto.randomUUID();
    const session = createSessionHandle();
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
    const deviceUUID = crypto.randomUUID();
    const session = createSessionHandle();
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
    const saved = loadAuthSession();
    if (!saved) {
      return { ok: false };
    }
    this.currentAuth = saved;
    const cached = this.getOfflineSnapshot();

    const res = await this.loginWithToken(saved);
    if (res.ok) {
      return res;
    }

    // Only clear saved credentials if PRONOTE explicitly rejected them online
    if (res.invalidCredentials) {
      clearAuthSession();
      clearOfflineCache();
      this.currentAuth = null;
      this.cacheMem = null;
      return res;
    }

    // Network/offline error -> keep session intact and boot into Offline Mode if cached!
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
  }

  public async reconnectOnline(): Promise<AuthResult> {
    if (this.session && this.profileCache) {
      return { ok: true, profile: this.profileCache, offline: false };
    }
    if (!this.currentAuth) {
      this.currentAuth = loadAuthSession();
    }
    if (!this.currentAuth) {
      return { ok: false, error: 'Aucune session enregistrée.' };
    }
    return this.loginWithToken(this.currentAuth);
  }

  public logout(): void {
    this.resetSession();
    this.currentAuth = null;
    this.isDemo = false;
    this.cacheMem = null;
    this.disconnectMessagingDisabled = false;
    clearAuthSession();
    clearOfflineCache();
  }

  public getProfile(): StudentProfile | null {
    return this.profileCache;
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
    throw new Error('Session expirée. Veuillez vous reconnecter.');
  }

  private async withSessionRetry<T>(fn: (session: SessionHandle) => Promise<T>): Promise<T> {
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

    // Direct URL detection
    if (/^https?:\/\//i.test(trimmed) || trimmed.includes('index-education.net')) {
      try {
        const cleaned = cleanURL(trimmed);
        const info = await instance(cleaned);
        return [
          {
            name: info.name || cleaned,
            url: cleaned,
            postalCode: '',
            distanceKm: 0,
          },
        ];
      } catch {
        return [];
      }
    }

    try {
      const geoRes = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(trimmed)}&limit=5`
      );
      if (!geoRes.ok) return [];
      const geoJson = (await geoRes.json()) as {
        features?: Array<{
          geometry?: { coordinates?: [number, number] };
        }>;
      };

      const features = geoJson.features ?? [];
      if (features.length === 0) return [];

      const byUrl = new Map<string, SchoolSearchResult>();
      const coordsList = features.slice(0, 3);

      await Promise.all(
        coordsList.map(async (feat) => {
          const coords = feat.geometry?.coordinates;
          if (!coords) return;
          const [longitude, latitude] = coords;
          try {
            const found = await geolocation({ latitude, longitude });
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
            // ignore individual lookup errors
          }
        })
      );

      const tokens = trimmed
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/\s+/)
        .filter((t) => t.length >= 2);

      const results = Array.from(byUrl.values());
      results.sort((a, b) => {
        const normA = a.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        const normB = b.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        const scoreA = tokens.filter((t) => normA.includes(t)).length;
        const scoreB = tokens.filter((t) => normB.includes(t)).length;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return a.distanceKm - b.distanceKm;
      });

      return results.slice(0, 20);
    } catch {
      return [];
    }
  }

  public async getTimetable(dateISO: string): Promise<TimetableResponse> {
    return this.withSessionRetry(async (session) => {
      const targetDate = new Date(dateISO);
      // Compute Monday of that week
      const monday = new Date(targetDate);
      const day = monday.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      monday.setDate(monday.getDate() + diff);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const weekNum = Math.max(
        1,
        translateToWeekNumber(monday, session.instance.firstMonday)
      );

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

      const res: TimetableResponse = {
        weekNumber: weekNum,
        weekFrequency: freq?.label,
        startDate: monday.toISOString(),
        endDate: sunday.toISOString(),
        items,
      };
      const wkKey = weekKeyFromDate(monday);
      this.persistCache((snap) => {
        snap.timetables[wkKey] = res;
        snap.latestTimetable = res;
      });
      return res;
    });
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

  public async getLessonDetails(resourceId: string): Promise<LessonDetailsDTO | null> {
    if (!resourceId) return null;
    return this.withSessionRetry(async (session) => {
      try {
        const res = await resource(session, resourceId);
        let linkedAssignments: HomeworkDTO[] = [];
        if (res.haveAssignment) {
          try {
            const rawAssigns = await resourceAssignments(session, resourceId);
            linkedAssignments = rawAssigns.map((a) => this.mapAssignment(a));
          } catch {
            // ignore if assignment fetch is restricted
          }
        }

        const categoryLabels: Record<number, string> = {
          [ResourceContentCategory.LESSON]: 'Cours',
          [ResourceContentCategory.CORRECTION]: 'Correction',
          [ResourceContentCategory.DST]: 'Devoir sur table',
          [ResourceContentCategory.ORAL_INTERROGATION]: 'Interrogation orale',
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
            categoryLabel: c.categoryText || categoryLabels[c.category],
            themes: (c.themes ?? []).map((t) => t.name),
            files: (c.files ?? []).map((f) => this.mapAttachment(f)),
          })),
          assignments: linkedAssignments,
        };
      } catch (err) {
        console.warn('[pronote] getLessonDetails failed:', err);
        return null;
      }
    });
  }

  public async getHomework(fromISO: string, toISO: string): Promise<HomeworkDTO[]> {
    return this.withSessionRetry(async (session) => {
      const from = new Date(fromISO);
      const to = new Date(toISO);
      const list = await assignmentsFromIntervals(session, from, to);

      const mapped = list
        .map((a): HomeworkDTO => this.mapAssignment(a))
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
      this.persistCache((snap) => {
        snap.homework = mapped;
      });
      return mapped;
    });
  }

  public async setHomeworkDone(assignmentId: string, done: boolean): Promise<boolean> {
    return this.withSessionRetry(async (session) => {
      await assignmentStatus(session, assignmentId, done);
      return true;
    });
  }

  public async getGrades(periodId?: string): Promise<GradesOverviewDTO> {
    return this.withSessionRetry(async (session) => {
      const period = this.findPeriod(TabLocation.Grades, periodId);
      if (!period) {
        return {
          periodId: '',
          periodName: 'Période',
          subjectsAverages: [],
          grades: [],
        };
      }

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
            isOutOf20: g.isOutOf20,
            subjectFile: g.subjectFile ? this.mapAttachment(g.subjectFile) : undefined,
            correctionFile: g.correctionFile ? this.mapAttachment(g.correctionFile) : undefined,
          }))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      };
      this.persistCache((snap) => {
        snap.grades[overview.periodId] = overview;
        snap.latestGrades = overview;
      });
      return overview;
    });
  }

  public async getAttendance(periodId?: string): Promise<AttendanceDTO> {
    return this.withSessionRetry(async (session) => {
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
        absences: data.absences
          .map((a) => ({
            id: a.id,
            startDate: a.startDate.toISOString(),
            endDate: a.endDate.toISOString(),
            justified: a.justified,
            daysMissed: a.daysMissed,
            hoursMissed: a.hoursMissed,
            minutesMissed: a.minutesMissed,
            reason: a.reason,
            administrativelyFixed: a.administrativelyFixed,
          }))
          .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()),
        delays: data.delays
          .map((d) => ({
            id: d.id,
            date: d.date.toISOString(),
            minutes: d.minutes,
            justified: d.justified,
            reason: d.reason,
            justification: d.justification,
          }))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        punishments: data.punishments
          .map((p) => ({
            id: p.id,
            title: p.title,
            reasons: p.reasons ?? [],
            dateGiven: p.dateGiven.toISOString(),
            durationMinutes: p.durationMinutes,
            giver: p.giver,
            workToDo: p.workToDo,
            circumstances: p.circumstances,
            exclusion: p.exclusion,
          }))
          .sort((a, b) => new Date(b.dateGiven).getTime() - new Date(a.dateGiven).getTime()),
        observations: data.observations
          .map((o) => ({
            id: o.id,
            date: o.date.toISOString(),
            name: o.name,
            kind: o.kind,
            subject: o.subject?.name,
            reason: o.reason,
          }))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      };
      this.persistCache((snap) => {
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
        startDate: item.startDate?.toISOString(),
        endDate: item.endDate?.toISOString(),
        read: item.read,
        content: item.content || '',
        attachments: (item.attachments ?? []).map((att) => this.mapAttachment(att)),
        needToAcknowledge: item.needToAcknowledge,
        acknowledged: item.acknowledged,
        needsDetail: Boolean(patched.__needsDetail),
      };
    }
    const questions = (item.questions ?? []).map((q) => this.mapNewsQuestion(q));
    const combinedContent = (item.questions ?? [])
      .map((q) => q.content || '')
      .filter(Boolean)
      .join('<hr/>');
    const allAttachments = (item.questions ?? []).flatMap((q) => q.attachments ?? []);
    return {
      id: item.id,
      is: 'survey',
      title: item.title || 'Sondage',
      category: item.category?.name || 'Sondage',
      author: item.author || 'Établissement',
      creationDate: item.creationDate.toISOString(),
      startDate: item.startDate?.toISOString(),
      endDate: item.endDate?.toISOString(),
      read: item.read,
      content: combinedContent,
      attachments: allAttachments.map((att) => this.mapAttachment(att)),
      isAnonymous: item.isAnonymous,
      questions,
      needsDetail: Boolean(patched.__needsDetail),
    };
  }

  public async getNews(): Promise<NewsItemDTO[]> {
    return this.withSessionRetry(async (session) => {
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

        if (mapped.length === 0 && data.messagerieDesactivee) {
          const cached = this.getOfflineSnapshot();
          if (cached?.news?.length) return cached.news;
        }

        const cached = this.getOfflineSnapshot();
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

        this.persistCache((snap) => {
          snap.news = merged;
        });
        return merged;
      } catch (err) {
        console.warn('[pronote] getNews failed gracefully:', err);
        return this.getOfflineSnapshot()?.news ?? [];
      }
    });
  }

  public async getNewsDetail(newsId: string): Promise<NewsItemDTO | null> {
    if (!this.session) {
      return this.getOfflineSnapshot()?.news?.find((n) => n.id === newsId) ?? null;
    }
    return this.withSessionRetry(async () => {
      const item = this.newsMap.get(newsId) as
        | ((NewsInformation | NewsSurvey) & {
            __needsDetail?: boolean;
            __fetchDetail?: () => Promise<NewsInformation | NewsSurvey>;
          })
        | undefined;
      if (!item) {
        return this.getOfflineSnapshot()?.news?.find((n) => n.id === newsId) ?? null;
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
        this.newsMap.set(newsId, full);
        const dto = this.mapNewsItem(full);
        this.persistCache((snap) => {
          snap.news = snap.news.map((n) => (n.id === dto.id ? dto : n));
        });
        return dto;
      } catch (err) {
        console.warn('[pronote] getNewsDetail failed:', err);
        return this.mapNewsItem(item);
      }
    });
  }

  public async markNewsRead(newsId: string): Promise<boolean> {
    return this.withSessionRetry(async (session) => {
      const item = this.newsMap.get(newsId);
      if (!item) return false;
      await newsRead(session, item, true);
      return true;
    });
  }

  public async acknowledgeNews(newsId: string): Promise<boolean> {
    return this.withSessionRetry(async (session) => {
      const item = this.newsMap.get(newsId);
      if (!item || item.is !== 'information') return false;
      await newsInformationAcknowledge(session, item, true);
      return true;
    });
  }

  public async answerSurvey(
    newsId: string,
    answers: Array<{
      questionId: string;
      selectedAnswers?: number[];
      textInputAnswer?: string;
    }>
  ): Promise<boolean> {
    return this.withSessionRetry(async (session) => {
      const item = this.newsMap.get(newsId);
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
    return this.withSessionRetry(async (session) => {
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
          .map((d): DiscussionSummaryDTO => {
            const id = d.participantsMessageID;
            this.discussionsMap.set(id, d);
            return {
              id,
              subject: d.subject || '(Sans objet)',
              creator: d.creator || d.recipientName || 'Inconnu',
              recipientName: d.recipientName,
              date: d.date.toISOString(),
              numberOfMessages: d.numberOfMessages,
              numberOfMessagesUnread: d.numberOfMessagesUnread,
              closed: d.closed,
            };
          })
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (mapped.length === 0 && data.messagerieDesactivee) {
          const cached = this.getOfflineSnapshot();
          if (cached?.discussions?.length) return cached.discussions;
        }

        this.persistCache((snap) => {
          snap.discussions = mapped;
        });
        return mapped;
      } catch (err) {
        console.warn('[pronote] getDiscussions failed gracefully:', err);
        return this.getOfflineSnapshot()?.discussions ?? [];
      }
    });
  }

  public async getDiscussionMessages(discussionId: string): Promise<DiscussionThreadDTO> {
    return this.withSessionRetry(async (session) => {
      const d = this.discussionsMap.get(discussionId);
      if (!d) {
        return { id: discussionId, canReply: false, messages: [] };
      }

      const thread = await discussionMessages(session, d, true);
      const msgs = [...thread.sents]
        .sort((a, b) => a.creationDate.getTime() - b.creationDate.getTime())
        .map((m) => ({
          id: m.id,
          content: m.content,
          creationDate: m.creationDate.toISOString(),
          authorName: m.author ? m.author.name : session.userResource.name || 'Moi',
          isSelf: !m.author,
          files: (m.files ?? []).map((att) => this.mapAttachment(att)),
        }));

      return {
        id: discussionId,
        canReply: !d.closed && thread.sendAction !== undefined && session.user.authorizations.canDiscuss,
        messages: msgs,
      };
    });
  }

  public async sendDiscussionReply(discussionId: string, content: string): Promise<boolean> {
    return this.withSessionRetry(async (session) => {
      const d = this.discussionsMap.get(discussionId);
      if (!d || !content.trim()) return false;
      await discussionSendMessage(session, d, content.trim(), false);
      return true;
    });
  }

  private mapMeal(meal?: Meal): MealDTO | undefined {
    if (!meal) return undefined;
    const mapFoods = (arr?: ReadonlyArray<{ name: string; allergens: ReadonlyArray<{ name: string; color: string }>; labels: ReadonlyArray<{ name: string; color: string }> }>) =>
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

  public async getMenus(dateISO?: string): Promise<MenuDayDTO[]> {
    return this.withSessionRetry(async (session) => {
      if (!session.user.authorizations.tabs.includes(TabLocation.Menus)) {
        return [];
      }
      try {
        const weekMenu = await menus(session, dateISO ? new Date(dateISO) : new Date());
        const mapped = weekMenu.days.map((day) => ({
          date: day.date.toISOString(),
          lunch: this.mapMeal(day.lunch),
          dinner: this.mapMeal(day.dinner),
        }));
        this.persistCache((snap) => {
          snap.menus = mapped;
        });
        return mapped;
      } catch {
        return this.getOfflineSnapshot()?.menus ?? [];
      }
    });
  }
}

export const pronoteService = new PronoteService();
