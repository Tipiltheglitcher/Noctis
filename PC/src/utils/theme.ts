import type { AccentTheme, AppSettings } from '@shared/types';

export const ACCENT_PRESETS: Array<{ id: Exclude<AccentTheme, 'custom'>; name: string; hex: string; desc: string }> = [
  { id: 'violet', name: 'Violet Nocturne', hex: '#8B74FF', desc: 'Signature Noctis' },
  { id: 'emerald', name: 'Émeraude', hex: '#10B981', desc: 'Frais & équilibré' },
  { id: 'cyan', name: 'Cyan Polaire', hex: '#22D3EE', desc: 'Net & futuriste' },
  { id: 'rose', name: 'Rose Néon', hex: '#F43F5E', desc: 'Vibrant & vif' },
  { id: 'amber', name: 'Ambre Solaire', hex: '#F59E0B', desc: 'Chaud & doré' },
  { id: 'blue', name: 'Bleu Électrique', hex: '#3B82F6', desc: 'Classique & clair' },
  { id: 'indigo', name: 'Indigo Royal', hex: '#6366F1', desc: 'Profond & sobre' },
  { id: 'mono', name: 'Obsidian Blanc', hex: '#F4F4F5', desc: 'Minimaliste pur noir' },
];

export const DEFAULT_APP_SETTINGS: AppSettings = {
  accent: 'violet',
  customAccentHex: '#8B74FF',
  background: 'obsidian',
  glowEnabled: true,
  shape: 'rounded',
  cardStyle: 'solid',
  density: 'normal',
  fontScale: 'md',
  sidebarPosition: 'left',
  sidebarCompact: false,
  dashboardLayout: 'bento',
  dashboardWidgets: {
    showKpis: true,
    showTimetable: true,
    showHomework: true,
    showGrades: true,
    showNews: true,
  },
  defaultTimetableView: 'week',
  courseCardStyle: 'left',
  showBreaks: true,
  notificationsEnabled: true,
  refreshIntervalMinutes: 10,
};

export function hexToRgbTriplet(hex: string): string {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) return `${r} ${g} ${b}`;
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) return `${r} ${g} ${b}`;
  }
  return '139 116 255';
}

export function resolveAccentHex(settings: Pick<AppSettings, 'accent' | 'customAccentHex'>): string {
  if (settings.accent === 'custom' && settings.customAccentHex) {
    return settings.customAccentHex;
  }
  const found = ACCENT_PRESETS.find((p) => p.id === settings.accent);
  return found?.hex ?? '#8B74FF';
}

export function applyThemeToDocument(settings: AppSettings): void {
  const root = document.documentElement;
  const hex = resolveAccentHex(settings);
  root.style.setProperty('--accent-rgb', hexToRgbTriplet(hex));
  root.setAttribute('data-accent', settings.accent || 'violet');
  root.setAttribute('data-bg', settings.background || 'obsidian');
  root.setAttribute('data-glow', settings.glowEnabled === false ? 'off' : 'on');
  root.setAttribute('data-shape', settings.shape || 'rounded');
  root.setAttribute('data-card-style', settings.cardStyle || 'solid');
  root.setAttribute('data-density', settings.density || 'normal');
  root.setAttribute('data-font-scale', settings.fontScale || 'md');
}
