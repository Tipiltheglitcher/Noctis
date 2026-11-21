import { registerPlugin } from '@capacitor/core';

export type MobileTab =
  | 'dashboard'
  | 'timetable'
  | 'homework'
  | 'grades'
  | 'attendance'
  | 'messages'
  | 'menus'
  | 'settings';

export type AccentTheme = 'violet' | 'emerald' | 'cyan' | 'mono';

export interface MobileSettings {
  accent: AccentTheme;
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

export interface TimetableResponse {
  weekNumber: number;
  weekFrequency?: string;
  items: TimetableItemDTO[];
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

export interface AttendanceDTO {
  periodId: string;
  periodName: string;
  absences: Array<{
    id: string;
    startDate: string;
    endDate: string;
    justified: boolean;
    hoursMissed: number;
    minutesMissed: number;
    reason?: string;
  }>;
  delays: Array<{
    id: string;
    date: string;
    minutes: number;
    justified: boolean;
    reason?: string;
    justification?: string;
  }>;
  punishments: Array<{
    id: string;
    title: string;
    reasons: string[];
    dateGiven: string;
    giver: string;
    workToDo: string;
  }>;
  observations: Array<{
    id: string;
    date: string;
    name: string;
    subject?: string;
    reason?: string;
  }>;
}

export interface NewsQuestionDTO {
  id: string;
  position: number;
  kind: number;
  title: string;
  fullTitle: string;
  content: string;
  attachments: AttachmentDTO[];
  choices: Array<{ value: string; position: number; isTextInput: boolean }>;
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
  date: string;
  numberOfMessages: number;
  numberOfMessagesUnread: number;
  closed: boolean;
}

export interface DiscussionThreadDTO {
  id: string;
  canReply: boolean;
  messages: Array<{
    id: string;
    content: string;
    creationDate: string;
    authorName: string;
    isSelf: boolean;
    files: AttachmentDTO[];
  }>;
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

export interface MobileUpdateInfo {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes?: string;
  apkUrl?: string;
  apkName?: string;
  apkSize?: number;
  releaseUrl: string;
  error?: string;
}

export interface EntLoginNativeResult {
  url: string;
  username: string;
  token: string;
  deviceUUID: string;
}

export interface EntLoginPluginInterface {
  startLogin(options: {
    mode: 'lyceeconnecte-educonnect' | 'lyceeconnecte-direct' | 'url';
    url?: string;
    schoolName?: string;
  }): Promise<EntLoginNativeResult>;
}

export const EntLogin = registerPlugin<EntLoginPluginInterface>('EntLogin');

declare global {
  const __NOCTIS_VERSION__: string;
}
