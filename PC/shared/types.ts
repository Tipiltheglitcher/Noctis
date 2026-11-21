export type NavTab =
  | 'dashboard'
  | 'timetable'
  | 'homework'
  | 'grades'
  | 'attendance'
  | 'messages'
  | 'menus'
  | 'settings';

export type AccentTheme =
  | 'violet'
  | 'emerald'
  | 'cyan'
  | 'rose'
  | 'amber'
  | 'blue'
  | 'indigo'
  | 'mono'
  | 'custom';

export type BackgroundTheme = 'obsidian' | 'amoled' | 'midnight' | 'graphite' | 'aurora';
export type ShapeStyle = 'sharp' | 'balanced' | 'rounded' | 'pill';
export type CardStyle = 'solid' | 'glass' | 'outline';
export type DensityStyle = 'compact' | 'normal' | 'spacious';
export type FontScale = 'sm' | 'md' | 'lg';
export type CourseCardStyle = 'left' | 'border' | 'tinted';
export type SidebarPosition = 'left' | 'right';
export type DashboardLayout = 'bento' | 'stacked';

export interface DashboardWidgetsConfig {
  showKpis: boolean;
  showTimetable: boolean;
  showHomework: boolean;
  showGrades: boolean;
  showNews: boolean;
}

export interface AppSettings {
  accent: AccentTheme;
  customAccentHex?: string;
  background?: BackgroundTheme;
  glowEnabled?: boolean;
  shape?: ShapeStyle;
  cardStyle?: CardStyle;
  density?: DensityStyle;
  fontScale?: FontScale;
  sidebarPosition?: SidebarPosition;
  sidebarCompact?: boolean;
  dashboardLayout?: DashboardLayout;
  dashboardWidgets?: DashboardWidgetsConfig;
  defaultTimetableView?: 'week' | 'day';
  courseCardStyle?: CourseCardStyle;
  showBreaks?: boolean;
  notificationsEnabled: boolean;
  refreshIntervalMinutes: number;
}

export interface PeriodDTO {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isDefault: boolean;
}

export interface StudentProfile {
  name: string;
  firstName: string;
  className: string;
  establishmentName: string;
  profilePicture?: string;
  instanceUrl: string;
  isDemo: boolean;
  availableTabs: {
    timetable: boolean;
    homework: boolean;
    grades: boolean;
    attendance: boolean;
    news: boolean;
    discussions: boolean;
    menus: boolean;
  };
  gradePeriods: PeriodDTO[];
  attendancePeriods: PeriodDTO[];
}

export interface AttachmentDTO {
  id: string;
  name: string;
  url: string;
  kind: 'link' | 'file';
}

export interface TimetableItemDTO {
  id: string;
  kind: 'lesson' | 'activity' | 'detention';
  title: string;
  startDate: string;
  endDate: string;
  backgroundColor?: string;
  teachers: string[];
  classrooms: string[];
  groups: string[];
  status?: string;
  canceled: boolean;
  exempted: boolean;
  test: boolean;
  notes?: string;
  virtualClassrooms: string[];
  lessonResourceID?: string;
}

export interface LessonContentDTO {
  id: string;
  title?: string;
  description?: string;
  categoryLabel?: string;
  themes: string[];
  files: AttachmentDTO[];
}

export interface LessonDetailsDTO {
  id: string;
  subject: string;
  teachers: string[];
  groups: string[];
  haveAssignment: boolean;
  contents: LessonContentDTO[];
  assignments: HomeworkDTO[];
}

export interface TimetableResponse {
  weekNumber: number;
  weekFrequency?: string;
  startDate: string;
  endDate: string;
  items: TimetableItemDTO[];
}

export interface HomeworkDTO {
  id: string;
  subject: string;
  description: string;
  backgroundColor: string;
  done: boolean;
  deadline: string;
  difficulty: number;
  lengthMinutes?: number;
  themes: string[];
  attachments: AttachmentDTO[];
  returnKind: number;
}

export interface GradeValueDTO {
  kind: number;
  points: number;
  label: string;
}

export interface GradeDTO {
  id: string;
  subject: string;
  subjectId: string;
  value: GradeValueDTO;
  outOf: number;
  date: string;
  average?: number;
  max?: number;
  min?: number;
  coefficient: number;
  comment: string;
  commentaireSurNote?: string;
  isBonus: boolean;
  isOptional: boolean;
  isOutOf20: boolean;
  subjectFile?: AttachmentDTO;
  correctionFile?: AttachmentDTO;
}

export interface SubjectAverageDTO {
  subject: string;
  subjectId: string;
  student?: number;
  classAverage?: number;
  max?: number;
  min?: number;
  outOf: number;
  backgroundColor: string;
}

export interface GradesOverviewDTO {
  periodId: string;
  periodName: string;
  overallAverage?: number;
  classAverage?: number;
  subjectsAverages: SubjectAverageDTO[];
  grades: GradeDTO[];
}

export interface AbsenceDTO {
  id: string;
  startDate: string;
  endDate: string;
  justified: boolean;
  daysMissed: number;
  hoursMissed: number;
  minutesMissed: number;
  reason?: string;
  administrativelyFixed: boolean;
}

export interface DelayDTO {
  id: string;
  date: string;
  minutes: number;
  justified: boolean;
  reason?: string;
  justification?: string;
}

export interface PunishmentDTO {
  id: string;
  title: string;
  reasons: string[];
  dateGiven: string;
  durationMinutes: number;
  giver: string;
  workToDo: string;
  circumstances: string;
  exclusion: boolean;
}

export interface ObservationDTO {
  id: string;
  date: string;
  name: string;
  kind: number;
  subject?: string;
  reason?: string;
}

export interface AttendanceDTO {
  periodId: string;
  periodName: string;
  absences: AbsenceDTO[];
  delays: DelayDTO[];
  punishments: PunishmentDTO[];
  observations: ObservationDTO[];
}

export interface NewsQuestionChoiceDTO {
  value: string;
  position: number;
  isTextInput: boolean;
}

export interface NewsQuestionDTO {
  id: string;
  position: number;
  kind: number;
  title: string;
  fullTitle: string;
  content: string;
  attachments: AttachmentDTO[];
  choices: NewsQuestionChoiceDTO[];
  shouldAnswer: boolean;
  answered: boolean;
  maximumChoices: number;
  shouldRespectMaximumChoices: boolean;
  maximumLength: number;
  selectedAnswers?: number[];
  textInputAnswer?: string;
}

export interface NewsItemDTO {
  id: string;
  is: 'information' | 'survey';
  title: string;
  category: string;
  author: string;
  creationDate: string;
  startDate?: string;
  endDate?: string;
  read: boolean;
  content: string;
  attachments: AttachmentDTO[];
  needToAcknowledge?: boolean;
  acknowledged?: boolean;
  isAnonymous?: boolean;
  questions?: NewsQuestionDTO[];
  needsDetail?: boolean;
}

export interface DiscussionSummaryDTO {
  id: string;
  subject: string;
  creator: string;
  recipientName?: string;
  date: string;
  numberOfMessages: number;
  numberOfMessagesUnread: number;
  closed: boolean;
}

export interface DiscussionMessageDTO {
  id: string;
  content: string;
  creationDate: string;
  authorName: string;
  isSelf: boolean;
  files: AttachmentDTO[];
}

export interface DiscussionThreadDTO {
  id: string;
  canReply: boolean;
  messages: DiscussionMessageDTO[];
}

export interface MenuFoodDTO {
  name: string;
  allergens: { name: string; color: string }[];
  labels: { name: string; color: string }[];
}

export interface MealDTO {
  entry: MenuFoodDTO[];
  main: MenuFoodDTO[];
  side: MenuFoodDTO[];
  fromage: MenuFoodDTO[];
  dessert: MenuFoodDTO[];
  drink: MenuFoodDTO[];
}

export interface MenuDayDTO {
  date: string;
  lunch?: MealDTO;
  dinner?: MealDTO;
}

export interface SchoolSearchResult {
  name: string;
  url: string;
  postalCode: string;
  distanceKm: number;
}

export interface SecurityChallengeDTO {
  required: true;
  shouldEnterPIN: boolean;
  shouldEnterSource: boolean;
  shouldCustomPassword: boolean;
  message: string;
}

export interface AuthResult {
  ok: boolean;
  profile?: StudentProfile;
  challenge?: SecurityChallengeDTO;
  error?: string;
  offline?: boolean;
  lastSyncedAt?: string;
  invalidCredentials?: boolean;
}

export interface OfflineCacheSnapshot {
  profile: StudentProfile;
  lastSyncedAt: string;
  timetables: Record<string, TimetableResponse>;
  latestTimetable?: TimetableResponse | null;
  homework: HomeworkDTO[];
  grades: Record<string, GradesOverviewDTO>;
  latestGrades?: GradesOverviewDTO | null;
  attendance: Record<string, AttendanceDTO>;
  latestAttendance?: AttendanceDTO | null;
  news: NewsItemDTO[];
  discussions: DiscussionSummaryDTO[];
  menus: MenuDayDTO[];
}

export interface UpdateInfoDTO {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName?: string;
  releaseNotes?: string;
  publishedAt?: string;
  downloadUrl?: string;
  assetName?: string;
  assetSize?: number;
  releaseUrl: string;
  error?: string;
}

export interface UpdateProgressDTO {
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
}

export interface PronoteAPI {
  window: {
    minimize: () => Promise<void>;
    toggleMaximize: () => Promise<boolean>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    onMaximizedChange: (cb: (maximized: boolean) => void) => () => void;
  };
  auth: {
    restoreSession: () => Promise<AuthResult>;
    reconnect: () => Promise<AuthResult>;
    loginQR: (payload: { qr: { jeton: string; login: string; url: string }; pin: string }) => Promise<AuthResult>;
    loginENT: (options: {
      mode: 'lyceeconnecte' | 'lyceeconnecte-educonnect' | 'lyceeconnecte-direct' | 'url';
      url?: string;
      schoolName?: string;
    }) => Promise<AuthResult>;
    cancelENT: () => Promise<void>;
    loginCredentials: (payload: { url: string; username: string; password: string }) => Promise<AuthResult>;
    loginDemo: () => Promise<AuthResult>;
    completeSecurityChallenge: (payload: { pin?: string; deviceName?: string }) => Promise<AuthResult>;
    logout: () => Promise<void>;
    searchSchools: (query: string) => Promise<SchoolSearchResult[]>;
    onEntStatus: (cb: (status: string) => void) => () => void;
  };
  data: {
    getProfile: () => Promise<StudentProfile | null>;
    getOfflineSnapshot: () => Promise<OfflineCacheSnapshot | null>;
    getMessagingDisabled: () => Promise<boolean>;
    getTimetable: (dateISO: string) => Promise<TimetableResponse>;
    getLessonDetails: (resourceId: string) => Promise<LessonDetailsDTO | null>;
    getHomework: (fromISO: string, toISO: string) => Promise<HomeworkDTO[]>;
    setHomeworkDone: (assignmentId: string, done: boolean) => Promise<boolean>;
    getGrades: (periodId?: string) => Promise<GradesOverviewDTO>;
    getAttendance: (periodId?: string) => Promise<AttendanceDTO>;
    getNews: () => Promise<NewsItemDTO[]>;
    getNewsDetail: (newsId: string) => Promise<NewsItemDTO | null>;
    markNewsRead: (newsId: string) => Promise<boolean>;
    acknowledgeNews: (newsId: string) => Promise<boolean>;
    answerSurvey: (
      newsId: string,
      answers: Array<{
        questionId: string;
        selectedAnswers?: number[];
        textInputAnswer?: string;
      }>
    ) => Promise<boolean>;
    getDiscussions: () => Promise<DiscussionSummaryDTO[]>;
    getDiscussionMessages: (discussionId: string) => Promise<DiscussionThreadDTO>;
    sendDiscussionMessage: (discussionId: string, content: string) => Promise<boolean>;
    getMenus: (dateISO?: string) => Promise<MenuDayDTO[]>;
  };
  system: {
    openExternal: (url: string) => Promise<void>;
    getSettings: () => Promise<AppSettings>;
    saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
    notify: (title: string, body: string) => Promise<void>;
  };
  updater: {
    getVersion: () => Promise<string>;
    checkForUpdates: () => Promise<UpdateInfoDTO>;
    downloadAndInstall: (
      downloadUrl: string,
      assetName: string
    ) => Promise<{ ok: boolean; error?: string }>;
    onDownloadProgress: (cb: (progress: UpdateProgressDTO) => void) => () => void;
  };
}

declare global {
  interface Window {
    pronoteAPI: PronoteAPI;
  }
}
