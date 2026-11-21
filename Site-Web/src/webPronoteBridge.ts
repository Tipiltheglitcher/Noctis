import {
  AccountKind,
  AttachmentKind,
  BadCredentialsError,
  DoubleAuthMode,
  GradeKind,
  ResourceContentCategory,
  SecurityError,
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
  gradesOverview,
  loginCredentials,
  loginQrCode,
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
  type SessionHandle,
} from '@blockshub/pawnote-lts';
import type { Fetcher, Request as PawnoteRequest, Response as PawnoteResponse } from '@literate.ink/utilities';
import type {
  AppSettings,
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
  PeriodDTO,
  PronoteAPI,
  StudentProfile,
  TimetableItemDTO,
  TimetableResponse,
} from '@shared/types';
import { getRelayUrl } from './config';
import { DEFAULT_APP_SETTINGS } from '@/utils/theme';

const DEMO_URL = 'https://demo.index-education.net/pronote';
const SETTINGS_KEY = 'noctis_web_settings';

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

function createRelayFetcher(): Fetcher {
  return async (req: PawnoteRequest): Promise<PawnoteResponse> => {
    const relay = getRelayUrl();
    if (!relay) {
      throw new Error(
        "Aucun relais Cloudflare Worker n'est configuré pour Noctis Web. Configure ton relais gratuit (1 min) ou télécharge l'application Noctis PC / Android."
      );
    }

    const headers: Record<string, string> = {
      'X-Noctis-Target': req.url.toString(),
    };
    if (req.headers) {
      if (req.headers instanceof Headers) {
        req.headers.forEach((v, k) => {
          if (k.toLowerCase() === 'cookie') headers['X-Noctis-Cookie'] = v;
          else if (k.toLowerCase() === 'content-type') headers['Content-Type'] = v;
        });
      } else {
        for (const [k, v] of Object.entries(req.headers)) {
          if (k.toLowerCase() === 'cookie') headers['X-Noctis-Cookie'] = v;
          else if (k.toLowerCase() === 'content-type') headers['Content-Type'] = v;
        }
      }
    }

    const res = await fetch(relay, {
      method: req.method ?? 'GET',
      headers,
      body: (req.method ?? 'GET') === 'POST' ? req.content : undefined,
    });

    const content = await res.text();
    const mapped = new Headers(res.headers);
    const forwardedCookie = res.headers.get('X-Noctis-Set-Cookie');
    if (forwardedCookie) mapped.set('set-cookie', forwardedCookie);

    return {
      status: res.status,
      content,
      headers: mapped,
    };
  };
}

// Built-in rich interactive sandbox demo if user clicks "Aperçu Démo" before configuring a relay
function buildLocalDemoData() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() + (now.getDay() === 0 ? -6 : 1 - now.getDay()));
  monday.setHours(0, 0, 0, 0);

  const mkTime = (dayOffset: number, h: number, m = 0) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + dayOffset);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  const profile: StudentProfile = {
    name: 'Élève Démo Noctis',
    firstName: 'Élève',
    className: 'Terminale G2',
    establishmentName: 'Lycée de Démonstration Noctis',
    instanceUrl: DEMO_URL,
    isDemo: true,
    availableTabs: {
      timetable: true,
      homework: true,
      grades: true,
      attendance: true,
      news: true,
      discussions: true,
      menus: true,
    },
    gradePeriods: [
      {
        id: 't1',
        name: 'Trimestre 1',
        startDate: mkTime(-45, 0),
        endDate: mkTime(30, 0),
        isDefault: true,
      },
    ],
    attendancePeriods: [
      {
        id: 't1',
        name: 'Trimestre 1',
        startDate: mkTime(-45, 0),
        endDate: mkTime(30, 0),
        isDefault: true,
      },
    ],
  };

  const lessons: TimetableItemDTO[] = [
    {
      id: 'd1',
      kind: 'lesson',
      title: 'MATHÉMATIQUES',
      startDate: mkTime(0, 8, 0),
      endDate: mkTime(0, 10, 0),
      backgroundColor: '#7C6BFF',
      teachers: ['M. BERNARD'],
      classrooms: ['B204'],
      groups: ['Spé Maths'],
      canceled: false,
      exempted: false,
      test: false,
      virtualClassrooms: [],
      lessonResourceID: 'res-maths',
    },
    {
      id: 'd2',
      kind: 'lesson',
      title: 'PHYSIQUE-CHIMIE',
      startDate: mkTime(0, 10, 15),
      endDate: mkTime(0, 12, 15),
      backgroundColor: '#10B981',
      teachers: ['Mme LAURENT'],
      classrooms: ['Labo P2'],
      groups: ['Spé PC'],
      canceled: false,
      exempted: false,
      test: true,
      status: 'Devoir surveillé',
      virtualClassrooms: [],
      lessonResourceID: 'res-pc',
    },
    {
      id: 'd3',
      kind: 'lesson',
      title: 'ANGLAIS LV1',
      startDate: mkTime(1, 9, 0),
      endDate: mkTime(1, 10, 0),
      backgroundColor: '#22D3EE',
      teachers: ['Mme SMITH'],
      classrooms: ['A108'],
      groups: [],
      canceled: true,
      status: 'Prof. absent',
      exempted: false,
      test: false,
      virtualClassrooms: [],
    },
    {
      id: 'd4',
      kind: 'lesson',
      title: 'PHILOSOPHIE',
      startDate: mkTime(2, 8, 0),
      endDate: mkTime(2, 10, 0),
      backgroundColor: '#F59E0B',
      teachers: ['M. MOREAU'],
      classrooms: ['C102'],
      groups: [],
      canceled: false,
      exempted: false,
      test: false,
      virtualClassrooms: [],
      lessonResourceID: 'res-philo',
    },
    {
      id: 'd5',
      kind: 'lesson',
      title: 'HISTOIRE-GÉOGRAPHIE',
      startDate: mkTime(3, 14, 0),
      endDate: mkTime(3, 16, 0),
      backgroundColor: '#EC4899',
      teachers: ['Mme DUBOIS'],
      classrooms: ['A201'],
      groups: [],
      canceled: false,
      exempted: false,
      test: false,
      virtualClassrooms: [],
    },
    {
      id: 'd6',
      kind: 'lesson',
      title: 'NSI / INFORMATIQUE',
      startDate: mkTime(4, 10, 15),
      endDate: mkTime(4, 12, 15),
      backgroundColor: '#8B74FF',
      teachers: ['M. LEROY'],
      classrooms: ['Salle Info 1'],
      groups: ['Spé NSI'],
      canceled: false,
      exempted: false,
      test: false,
      virtualClassrooms: [],
    },
  ];

  const homework: HomeworkDTO[] = [
    {
      id: 'hw1',
      subject: 'MATHÉMATIQUES',
      description: '<p>Exercices <strong>42, 45 et 48 p.184</strong> sur les suites et limites.</p>',
      backgroundColor: '#7C6BFF',
      done: false,
      deadline: mkTime(1, 8, 0),
      difficulty: 2,
      lengthMinutes: 45,
      themes: ['Suites & Limites'],
      attachments: [],
      returnKind: 0,
    },
    {
      id: 'hw2',
      subject: 'PHILOSOPHIE',
      description: '<p>Rédiger l’introduction de la dissertation : <em>« La technique nous libère-t-elle ? »</em></p>',
      backgroundColor: '#F59E0B',
      done: true,
      deadline: mkTime(2, 8, 0),
      difficulty: 3,
      lengthMinutes: 60,
      themes: ['La technique'],
      attachments: [],
      returnKind: 2,
    },
  ];

  const grades: GradesOverviewDTO = {
    periodId: 't1',
    periodName: 'Trimestre 1',
    overallAverage: 15.65,
    classAverage: 12.9,
    subjectsAverages: [
      { subject: 'MATHÉMATIQUES', subjectId: 's1', student: 16.5, classAverage: 12.4, min: 6.5, max: 19, outOf: 20, backgroundColor: '#7C6BFF' },
      { subject: 'PHYSIQUE-CHIMIE', subjectId: 's2', student: 15.0, classAverage: 13.1, min: 7.0, max: 18.5, outOf: 20, backgroundColor: '#10B981' },
      { subject: 'PHILOSOPHIE', subjectId: 's3', student: 14.5, classAverage: 11.8, min: 8.0, max: 17.0, outOf: 20, backgroundColor: '#F59E0B' },
      { subject: 'NSI / INFORMATIQUE', subjectId: 's4', student: 18.0, classAverage: 14.2, min: 9.5, max: 19.5, outOf: 20, backgroundColor: '#22D3EE' },
    ],
    grades: [
      { id: 'g1', subject: 'MATHÉMATIQUES', subjectId: 's1', value: { kind: 0, points: 17, label: '17' }, outOf: 20, date: mkTime(-5, 10), average: 12.3, min: 6, max: 19.5, coefficient: 2, comment: 'DS n°2 — Dérivation & Suites', commentaireSurNote: 'Très bonne rigueur !', isBonus: false, isOptional: false, isOutOf20: true },
      { id: 'g2', subject: 'PHYSIQUE-CHIMIE', subjectId: 's2', value: { kind: 0, points: 15, label: '15' }, outOf: 20, date: mkTime(-9, 14), average: 13.1, min: 7, max: 18.5, coefficient: 2, comment: 'TP Titrage acido-basique', isBonus: false, isOptional: false, isOutOf20: true },
      { id: 'g3', subject: 'NSI / INFORMATIQUE', subjectId: 's4', value: { kind: 0, points: 18, label: '18' }, outOf: 20, date: mkTime(-12, 10), average: 14.2, min: 9.5, max: 19.5, coefficient: 1, comment: 'Projet Python — Graphes', isBonus: false, isOptional: false, isOutOf20: true },
    ],
  };

  const newsItems: NewsItemDTO[] = [
    {
      id: 'n1',
      is: 'information',
      title: 'Bienvenue dans la démo interactive de Noctis',
      category: 'Informations',
      author: 'Noctis',
      creationDate: now.toISOString(),
      read: false,
      content:
        '<p>Teste librement l’interface <strong>Noctis</strong> : clique sur un cours dans l’emploi du temps pour ouvrir sa pop-up de contenu, coche les devoirs, essaie le <strong>simulateur de moyenne</strong> dans Notes, ou regarde la séparation <strong>Midi / Soir (Internat)</strong> dans Cantine.</p><p>Pour connecter ton vrai compte Lycée Connecté ou QR Code, clique sur <strong>Télécharger PC / Android</strong> en haut à droite !</p>',
      attachments: [],
    },
  ];

  const menuDays: MenuDayDTO[] = [
    {
      date: mkTime(0, 12),
      lunch: {
        entry: [{ name: 'Salade composée bio', allergens: [], labels: [{ name: 'Bio', color: '#10b981' }] }],
        main: [{ name: 'Poulet rôti fermier', allergens: [], labels: [{ name: 'Local', color: '#10b981' }] }],
        side: [{ name: 'Gratin dauphinois', allergens: [{ name: 'Lait', color: '#f59e0b' }], labels: [] }],
        fromage: [{ name: 'Comté AOP', allergens: [{ name: 'Lait', color: '#f59e0b' }], labels: [] }],
        dessert: [{ name: 'Tarte aux pommes maison', allergens: [{ name: 'Gluten', color: '#f59e0b' }], labels: [] }],
        drink: [],
      },
      dinner: {
        entry: [{ name: 'Velouté de potimarron', allergens: [], labels: [{ name: 'Fait maison', color: '#10b981' }] }],
        main: [{ name: 'Pâtes carbonara (Internat)', allergens: [{ name: 'Gluten', color: '#f59e0b' }], labels: [] }],
        side: [{ name: 'Salade verte', allergens: [], labels: [] }],
        fromage: [{ name: 'Yaourt nature bio', allergens: [{ name: 'Lait', color: '#f59e0b' }], labels: [] }],
        dessert: [{ name: 'Compote poire-vanille', allergens: [], labels: [] }],
        drink: [],
      },
    },
  ];

  return { profile, lessons, homework, grades, newsItems, menuDays, monday };
}

class WebPronoteBridge {
  private session: SessionHandle | null = null;
  private profileCache: StudentProfile | null = null;
  private localDemoMode = false;
  private localDemo = buildLocalDemoData();
  private newsMap = new Map<string, NewsInformation | NewsSurvey>();
  private discussionsMap = new Map<string, Discussion>();
  private pendingSecurity: { session: SessionHandle; error: SecurityError; deviceUUID: string } | null = null;

  private reset() {
    if (this.session) {
      try {
        clearPresenceInterval(this.session);
      } catch {
        // ignore
      }
    }
    this.session = null;
    this.profileCache = null;
    this.localDemoMode = false;
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
    return { kind: gv.kind, points: gv.points, label: labels[gv.kind] ?? String(gv.points) };
  }

  private mapAttachment(att: Attachment): AttachmentDTO {
    return { id: att.id, name: att.name, url: att.url, kind: att.kind === AttachmentKind.Link ? 'link' : 'file' };
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

  private mapPeriods(loc: TabLocation): PeriodDTO[] {
    if (!this.session) return [];
    const tab = this.session.userResource.tabs.get(loc);
    const list: Period[] = tab?.periods?.length ? tab.periods : this.session.instance.periods ?? [];
    const defId = tab?.defaultPeriod?.id;
    return list.map((p, i) => ({
      id: p.id,
      name: p.name,
      startDate: p.startDate.toISOString(),
      endDate: p.endDate.toISOString(),
      isDefault: defId ? p.id === defId : i === 0,
    }));
  }

  private findPeriod(loc: TabLocation, id?: string): Period | undefined {
    if (!this.session) return undefined;
    const tab = this.session.userResource.tabs.get(loc);
    const list: Period[] = tab?.periods?.length ? tab.periods : this.session.instance.periods ?? [];
    if (id) {
      const f = list.find((p) => p.id === id);
      if (f) return f;
    }
    return tab?.defaultPeriod ?? list[0];
  }

  private buildProfile(isDemo: boolean): StudentProfile {
    const s = this.session!;
    const r = s.userResource;
    const tabs = s.user.authorizations.tabs;
    const has = (l: TabLocation) => tabs.includes(l);
    const fullName = r.name || s.user.name;
    const parts = fullName.trim().split(/\s+/);
    const nonCaps = parts.filter((p) => p !== p.toUpperCase() || p.length <= 1);
    const profile: StudentProfile = {
      name: fullName,
      firstName: nonCaps[0] || parts[parts.length - 1] || 'Élève',
      className: r.className || 'Élève',
      establishmentName: r.establishmentName || 'Établissement',
      instanceUrl: s.information.url,
      isDemo,
      availableTabs: {
        timetable: has(TabLocation.Timetable),
        homework: has(TabLocation.Assignments),
        grades: has(TabLocation.Grades),
        attendance: has(TabLocation.Notebook),
        news: has(TabLocation.News),
        discussions: has(TabLocation.Discussions) && s.user.authorizations.canReadDiscussions,
        menus: has(TabLocation.Menus),
      },
      gradePeriods: this.mapPeriods(TabLocation.Grades),
      attendancePeriods: this.mapPeriods(TabLocation.Notebook),
    };
    this.profileCache = profile;
    return profile;
  }

  private async handleSecurity(session: SessionHandle, err: unknown, deviceUUID: string, isDemo: boolean): Promise<AuthResult> {
    if (err instanceof SecurityError) {
      const h = err.handle;
      if (!h.shouldCustomPassword && !h.shouldCustomDoubleAuth && h.shouldEnterSource && !h.shouldEnterPIN) {
        await securitySource(session, 'Noctis Web');
        await securitySave(session, h, { mode: DoubleAuthMode.MGDA_NotificationSeulement, deviceName: 'Noctis Web' });
        await finishLoginManually(session, h.context.authentication, h.context.identity, h.context.initialUsername);
        this.reset();
        this.session = session;
        startPresenceInterval(session);
        return { ok: true, profile: this.buildProfile(isDemo) };
      }
      this.pendingSecurity = { session, error: err, deviceUUID };
      return {
        ok: false,
        challenge: {
          required: true,
          shouldEnterPIN: h.shouldEnterPIN,
          shouldEnterSource: h.shouldEnterSource,
          shouldCustomPassword: h.shouldCustomPassword,
          message: 'Double authentification PRONOTE requise.',
        },
      };
    }
    if (err instanceof BadCredentialsError) {
      return { ok: false, error: 'Identifiants ou code PIN incorrects.' };
    }
    return { ok: false, error: err instanceof Error ? err.message : 'Erreur de connexion.' };
  }

  public createAPI(): PronoteAPI {
    return {
      window: {
        minimize: async () => {},
        toggleMaximize: async () => false,
        close: async () => {},
        isMaximized: async () => false,
        onMaximizedChange: () => () => {},
      },
      auth: {
        // Ephemeral web session by design: always reconnect when reopening tab
        restoreSession: async () => ({ ok: false }),
        reconnect: async () => ({ ok: false }),
        loginQR: async ({ qr, pin }) => {
          const deviceUUID = makeUUID();
          const session = createSessionHandle(createRelayFetcher());
          try {
            await loginQrCode(session, { qr, pin: pin.trim(), deviceUUID });
            this.reset();
            this.session = session;
            startPresenceInterval(session);
            return { ok: true, profile: this.buildProfile(false) };
          } catch (err) {
            return this.handleSecurity(session, err, deviceUUID, false);
          }
        },
        loginENT: async () => ({
          ok: false,
          error: "La connexion ENT intégrée est réservée aux applications Noctis PC (.exe) et Android (.apk). Sur le Web, utilisez le QR Code !",
        }),
        cancelENT: async () => {},
        loginCredentials: async ({ url, username, password }) => {
          const deviceUUID = makeUUID();
          const session = createSessionHandle(createRelayFetcher());
          try {
            await loginCredentials(session, {
              url: cleanURL(url),
              kind: AccountKind.STUDENT,
              username: username.trim(),
              password,
              deviceUUID,
            });
            this.reset();
            this.session = session;
            startPresenceInterval(session);
            return { ok: true, profile: this.buildProfile(false) };
          } catch (err) {
            return this.handleSecurity(session, err, deviceUUID, false);
          }
        },
        loginDemo: async () => {
          if (getRelayUrl()) {
            const deviceUUID = makeUUID();
            const session = createSessionHandle(createRelayFetcher());
            try {
              await loginCredentials(session, {
                url: DEMO_URL,
                kind: AccountKind.STUDENT,
                username: 'demonstration',
                password: 'pronotevs',
                deviceUUID,
              });
              this.reset();
              this.session = session;
              startPresenceInterval(session);
              return { ok: true, profile: this.buildProfile(true) };
            } catch {
              // Fallback to local sandbox demo if relay fails
            }
          }
          this.reset();
          this.localDemo = buildLocalDemoData();
          this.localDemoMode = true;
          this.profileCache = this.localDemo.profile;
          return { ok: true, profile: this.localDemo.profile };
        },
        completeSecurityChallenge: async ({ pin, deviceName }) => {
          if (!this.pendingSecurity) return { ok: false, error: 'Aucune vérification.' };
          const { session, error } = this.pendingSecurity;
          try {
            if (error.handle.shouldEnterPIN && pin) {
              const ok = await securityCheckPIN(session, pin);
              if (!ok) return { ok: false, error: 'PIN incorrect.' };
            }
            if (error.handle.shouldEnterSource) {
              await securitySource(session, (deviceName || 'Noctis Web').slice(0, 30));
            }
            await securitySave(session, error.handle, { pin, deviceName: deviceName || 'Noctis Web' });
            await finishLoginManually(
              session,
              error.handle.context.authentication,
              error.handle.context.identity,
              error.handle.context.initialUsername
            );
            this.reset();
            this.session = session;
            startPresenceInterval(session);
            return { ok: true, profile: this.buildProfile(false) };
          } catch (e) {
            return { ok: false, error: e instanceof Error ? e.message : 'Erreur 2FA.' };
          }
        },
        logout: async () => {
          this.reset();
        },
        searchSchools: async () => [],
        onEntStatus: () => () => {},
      },
      data: {
        getProfile: async () => this.profileCache,
        getOfflineSnapshot: async () => null,
        getMessagingDisabled: async () => false,
        getTimetable: async (dateISO) => {
          if (this.localDemoMode) {
            const end = new Date(this.localDemo.monday);
            end.setDate(end.getDate() + 6);
            return {
              weekNumber: 12,
              weekFrequency: 'Semaine A',
              startDate: this.localDemo.monday.toISOString(),
              endDate: end.toISOString(),
              items: this.localDemo.lessons,
            };
          }
          const s = this.session!;
          const monday = new Date(dateISO);
          monday.setDate(monday.getDate() + (monday.getDay() === 0 ? -6 : 1 - monday.getDay()));
          monday.setHours(0, 0, 0, 0);
          const sunday = new Date(monday);
          sunday.setDate(monday.getDate() + 6);
          const wn = Math.max(1, translateToWeekNumber(monday, s.instance.firstMonday));
          const raw = await timetableFromWeek(s, wn);
          parseTimetable(s, raw, { withCanceledClasses: true, withPlannedClasses: true, withSuperposedCanceledClasses: false });
          const freq = frequency(s, wn);
          return {
            weekNumber: wn,
            weekFrequency: freq?.label,
            startDate: monday.toISOString(),
            endDate: sunday.toISOString(),
            items: raw.classes.map((cls): TimetableItemDTO =>
              cls.is === 'lesson'
                ? {
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
                  }
                : cls.is === 'activity'
                ? {
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
                  }
                : {
                    id: cls.id,
                    kind: 'detention',
                    title: cls.title || 'Retenue',
                    startDate: cls.startDate.toISOString(),
                    endDate: cls.endDate.toISOString(),
                    backgroundColor: '#ef4444',
                    teachers: [...(cls.teacherNames ?? []), ...(cls.personalNames ?? [])],
                    classrooms: cls.classrooms ?? [],
                    groups: [],
                    status: 'Retenue',
                    canceled: false,
                    exempted: false,
                    test: false,
                    notes: cls.notes,
                    virtualClassrooms: [],
                  }
            ),
          };
        },
        getLessonDetails: async (resourceId): Promise<LessonDetailsDTO | null> => {
          if (this.localDemoMode) {
            return {
              id: resourceId,
              subject: 'Séance de démonstration',
              teachers: ['Professeur'],
              groups: [],
              haveAssignment: false,
              contents: [
                {
                  id: 'c1',
                  title: 'Chapitre 4 — Étude de fonctions & exercices d’application',
                  description: '<p>Rappels de cours, démonstration au tableau et exercices d’entraînement.</p>',
                  categoryLabel: 'Cours',
                  themes: ['Analyse'],
                  files: [],
                },
              ],
              assignments: [],
            };
          }
          const s = this.session!;
          try {
            const r = await resource(s, resourceId);
            let assigns: HomeworkDTO[] = [];
            if (r.haveAssignment) {
              try {
                assigns = (await resourceAssignments(s, resourceId)).map((a) => this.mapAssignment(a));
              } catch {
                // ignore
              }
            }
            const labels: Record<number, string> = {
              [ResourceContentCategory.LESSON]: 'Cours',
              [ResourceContentCategory.CORRECTION]: 'Correction',
              [ResourceContentCategory.DST]: 'DST',
              [ResourceContentCategory.TD]: 'TD',
              [ResourceContentCategory.TP]: 'TP',
            };
            return {
              id: r.id,
              subject: r.subject.name,
              teachers: r.teachers ?? [],
              groups: r.groups ?? [],
              haveAssignment: r.haveAssignment,
              contents: (r.contents ?? []).map((c) => ({
                id: c.id,
                title: c.title,
                description: c.description,
                categoryLabel: c.categoryText || labels[c.category],
                themes: (c.themes ?? []).map((t) => t.name),
                files: (c.files ?? []).map((f) => this.mapAttachment(f)),
              })),
              assignments: assigns,
            };
          } catch {
            return null;
          }
        },
        getHomework: async (fromISO, toISO) => {
          if (this.localDemoMode) return this.localDemo.homework;
          const list = await assignmentsFromIntervals(this.session!, new Date(fromISO), new Date(toISO));
          return list
            .map((a) => this.mapAssignment(a))
            .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
        },
        setHomeworkDone: async (id, done) => {
          if (this.localDemoMode) {
            this.localDemo.homework = this.localDemo.homework.map((h) => (h.id === id ? { ...h, done } : h));
            return true;
          }
          await assignmentStatus(this.session!, id, done);
          return true;
        },
        getGrades: async (periodId) => {
          if (this.localDemoMode) return this.localDemo.grades;
          const period = this.findPeriod(TabLocation.Grades, periodId);
          if (!period) return { periodId: '', periodName: 'Période', subjectsAverages: [], grades: [] };
          const d = await gradesOverview(this.session!, period);
          return {
            periodId: period.id,
            periodName: period.name,
            overallAverage: d.overallAverage?.kind === GradeKind.Grade ? d.overallAverage.points : undefined,
            classAverage: d.classAverage?.kind === GradeKind.Grade ? d.classAverage.points : undefined,
            subjectsAverages: d.subjectsAverages.map((sa) => ({
              subject: sa.subject.name,
              subjectId: sa.subject.id,
              student: sa.student?.kind === GradeKind.Grade ? sa.student.points : undefined,
              classAverage: sa.class_average?.kind === GradeKind.Grade ? sa.class_average.points : undefined,
              max: sa.max?.kind === GradeKind.Grade ? sa.max.points : undefined,
              min: sa.min?.kind === GradeKind.Grade ? sa.min.points : undefined,
              outOf: sa.outOf?.points ?? 20,
              backgroundColor: sa.backgroundColor,
            })),
            grades: d.grades
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
        },
        getAttendance: async (periodId): Promise<AttendanceDTO> => {
          if (this.localDemoMode) {
            return { periodId: 't1', periodName: 'Trimestre 1', absences: [], delays: [], punishments: [], observations: [] };
          }
          const period = this.findPeriod(TabLocation.Notebook, periodId);
          if (!period) return { periodId: '', periodName: 'Période', absences: [], delays: [], punishments: [], observations: [] };
          const d = await notebook(this.session!, period);
          return {
            periodId: period.id,
            periodName: period.name,
            absences: d.absences.map((a) => ({
              id: a.id,
              startDate: a.startDate.toISOString(),
              endDate: a.endDate.toISOString(),
              justified: a.justified,
              daysMissed: a.daysMissed,
              hoursMissed: a.hoursMissed,
              minutesMissed: a.minutesMissed,
              reason: a.reason,
              administrativelyFixed: a.administrativelyFixed,
            })),
            delays: d.delays.map((x) => ({
              id: x.id,
              date: x.date.toISOString(),
              minutes: x.minutes,
              justified: x.justified,
              reason: x.reason,
              justification: x.justification,
            })),
            punishments: d.punishments.map((p) => ({
              id: p.id,
              title: p.title,
              reasons: p.reasons ?? [],
              dateGiven: p.dateGiven.toISOString(),
              durationMinutes: p.durationMinutes,
              giver: p.giver,
              workToDo: p.workToDo,
              circumstances: p.circumstances,
              exclusion: p.exclusion,
            })),
            observations: d.observations.map((o) => ({
              id: o.id,
              date: o.date.toISOString(),
              name: o.name,
              kind: o.kind,
              subject: o.subject?.name,
              reason: o.reason,
            })),
          };
        },
        getNews: async () => {
          if (this.localDemoMode) return this.localDemo.newsItems;
          try {
            const data = await news(this.session!);
            this.newsMap.clear();
            return data.items
              .map((item) => {
                this.newsMap.set(item.id, item);
                return this.mapNews(item);
              })
              .sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());
          } catch {
            return [];
          }
        },
        getNewsDetail: async (newsId) => {
          if (this.localDemoMode) return this.localDemo.newsItems.find((n) => n.id === newsId) ?? null;
          const item = this.newsMap.get(newsId) as
            | ((NewsInformation | NewsSurvey) & { __needsDetail?: boolean; __fetchDetail?: () => Promise<NewsInformation | NewsSurvey> })
            | undefined;
          if (!item) return null;
          if (!item.__needsDetail || typeof item.__fetchDetail !== 'function') return this.mapNews(item);
          const full = await item.__fetchDetail();
          this.newsMap.set(newsId, full);
          return this.mapNews(full);
        },
        markNewsRead: async (id) => {
          if (this.localDemoMode) return true;
          const item = this.newsMap.get(id);
          if (item) await newsRead(this.session!, item, true);
          return true;
        },
        acknowledgeNews: async (id) => {
          if (this.localDemoMode) return true;
          const item = this.newsMap.get(id);
          if (item && item.is === 'information') await newsInformationAcknowledge(this.session!, item, true);
          return true;
        },
        answerSurvey: async (id, answers) => {
          if (this.localDemoMode) return true;
          const item = this.newsMap.get(id);
          if (!item || item.is !== 'survey') return false;
          for (const a of answers) {
            const q = item.questions.find((qq) => qq.id === a.questionId);
            if (!q) continue;
            if (a.selectedAnswers?.length) newsQuestionLocalMutate(q, a.selectedAnswers, a.textInputAnswer);
            else if (a.textInputAnswer !== undefined) newsQuestionLocalMutate(q, a.textInputAnswer);
          }
          await newsSurveySend(this.session!, item, true);
          return true;
        },
        getDiscussions: async (): Promise<DiscussionSummaryDTO[]> => {
          if (this.localDemoMode) return [];
          try {
            const d = await discussions(this.session!);
            this.discussionsMap.clear();
            return d.items.map((x) => {
              this.discussionsMap.set(x.participantsMessageID, x);
              return {
                id: x.participantsMessageID,
                subject: x.subject || '(Sans objet)',
                creator: x.creator || x.recipientName || 'Inconnu',
                recipientName: x.recipientName,
                date: x.date.toISOString(),
                numberOfMessages: x.numberOfMessages,
                numberOfMessagesUnread: x.numberOfMessagesUnread,
                closed: x.closed,
              };
            });
          } catch {
            return [];
          }
        },
        getDiscussionMessages: async (id): Promise<DiscussionThreadDTO> => {
          const d = this.discussionsMap.get(id);
          if (!d || !this.session) return { id, canReply: false, messages: [] };
          const thread = await discussionMessages(this.session, d, true);
          return {
            id,
            canReply: !d.closed && thread.sendAction !== undefined,
            messages: thread.sents.map((m) => ({
              id: m.id,
              content: m.content,
              creationDate: m.creationDate.toISOString(),
              authorName: m.author ? m.author.name : this.session!.userResource.name || 'Moi',
              isSelf: !m.author,
              files: (m.files ?? []).map((f) => this.mapAttachment(f)),
            })),
          };
        },
        sendDiscussionMessage: async (id, content) => {
          const d = this.discussionsMap.get(id);
          if (!d || !this.session) return false;
          await discussionSendMessage(this.session, d, content.trim(), false);
          return true;
        },
        getMenus: async (dateISO): Promise<MenuDayDTO[]> => {
          if (this.localDemoMode) return this.localDemo.menuDays;
          try {
            const w = await menus(this.session!, dateISO ? new Date(dateISO) : new Date());
            const mapMeal = (meal?: Meal): MealDTO | undefined => {
              if (!meal) return undefined;
              const f = (arr?: ReadonlyArray<{ name: string; allergens: ReadonlyArray<{ name: string; color: string }>; labels: ReadonlyArray<{ name: string; color: string }> }>) =>
                (arr ?? []).map((x) => ({
                  name: x.name,
                  allergens: x.allergens.map((a) => ({ name: a.name, color: a.color })),
                  labels: x.labels.map((l) => ({ name: l.name, color: l.color })),
                }));
              return { entry: f(meal.entry), main: f(meal.main), side: f(meal.side), fromage: f(meal.fromage), dessert: f(meal.dessert), drink: f(meal.drink) };
            };
            return w.days.map((day) => ({ date: day.date.toISOString(), lunch: mapMeal(day.lunch), dinner: mapMeal(day.dinner) }));
          } catch {
            return [];
          }
        },
      },
      system: {
        openExternal: async (url) => {
          window.open(url, '_blank', 'noopener,noreferrer');
        },
        getSettings: async () => {
          try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (raw) {
              const parsed = JSON.parse(raw) as Partial<AppSettings>;
              return {
                ...DEFAULT_APP_SETTINGS,
                notificationsEnabled: false,
                ...parsed,
                dashboardWidgets: {
                  ...DEFAULT_APP_SETTINGS.dashboardWidgets!,
                  ...(parsed.dashboardWidgets ?? {}),
                },
              };
            }
          } catch {
            // ignore
          }
          return { ...DEFAULT_APP_SETTINGS, notificationsEnabled: false };
        },
        saveSettings: async (partial: Partial<AppSettings>) => {
          const cur = await window.pronoteAPI.system.getSettings();
          const next: AppSettings = {
            ...cur,
            ...partial,
            dashboardWidgets: partial.dashboardWidgets
              ? {
                  ...(cur.dashboardWidgets ?? DEFAULT_APP_SETTINGS.dashboardWidgets!),
                  ...partial.dashboardWidgets,
                }
              : cur.dashboardWidgets,
          };
          try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        },
        notify: async () => {},
      },
      updater: {
        getVersion: async () => 'Web',
        checkForUpdates: async () => ({
          updateAvailable: false,
          currentVersion: 'Web',
          latestVersion: 'Web',
          releaseUrl: 'https://github.com/Tipiltheglitcher/Noctis/releases',
        }),
        downloadAndInstall: async () => ({ ok: true }),
        onDownloadProgress: () => () => {},
      },
    };
  }

  private mapQuestion(q: NewsQuestion): NewsQuestionDTO {
    return {
      id: q.id,
      position: q.position,
      kind: q.kind,
      title: q.title || q.fullTitle || '',
      fullTitle: q.fullTitle || q.title || '',
      content: q.content || '',
      attachments: (q.attachments ?? []).map((a) => this.mapAttachment(a)),
      choices: (q.choices ?? []).map((c) => ({ value: c.value, position: c.position, isTextInput: c.isTextInput })),
      shouldAnswer: q.shouldAnswer,
      answered: q.answered,
      maximumChoices: q.maximumChoices,
      shouldRespectMaximumChoices: q.shouldRespectMaximumChoices,
      maximumLength: q.maximumLength,
      selectedAnswers: q.selectedAnswers,
      textInputAnswer: q.textInputAnswer,
    };
  }

  private mapNews(item: NewsInformation | NewsSurvey): NewsItemDTO {
    const p = item as (NewsInformation | NewsSurvey) & { __needsDetail?: boolean };
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
        attachments: (item.attachments ?? []).map((a) => this.mapAttachment(a)),
        needToAcknowledge: item.needToAcknowledge,
        acknowledged: item.acknowledged,
        needsDetail: Boolean(p.__needsDetail),
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
      attachments: (item.questions ?? []).flatMap((q) => (q.attachments ?? []).map((a) => this.mapAttachment(a))),
      isAnonymous: item.isAnonymous,
      questions: (item.questions ?? []).map((q) => this.mapQuestion(q)),
      needsDetail: Boolean(p.__needsDetail),
    };
  }
}

export function installWebPronoteBridge(): void {
  const bridge = new WebPronoteBridge();
  window.pronoteAPI = bridge.createAPI();
}
