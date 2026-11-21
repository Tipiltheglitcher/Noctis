import type { AccentTheme, MobileSettings } from '@/types';

export const MOBILE_ACCENT_PRESETS: Array<{ id: Exclude<AccentTheme, 'custom'>; label: string; hex: string }> = [
  { id: 'violet', label: 'Violet', hex: '#8B74FF' },
  { id: 'emerald', label: 'Émeraude', hex: '#10B981' },
  { id: 'cyan', label: 'Cyan', hex: '#22D3EE' },
  { id: 'rose', label: 'Rose', hex: '#F43F5E' },
  { id: 'amber', label: 'Ambre', hex: '#F59E0B' },
  { id: 'blue', label: 'Bleu', hex: '#3B82F6' },
  { id: 'indigo', label: 'Indigo', hex: '#6366F1' },
  { id: 'mono', label: 'Blanc', hex: '#F4F4F5' },
];

export const DEFAULT_MOBILE_SETTINGS: MobileSettings = {
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

export function hexToRgbTriplet(hex: string): string {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) return `${r} ${g} ${b}`;
  }
  return '139 116 255';
}

export function resolveMobileAccentHex(settings: MobileSettings): string {
  if (settings.accent === 'custom' && settings.customAccentHex) {
    return settings.customAccentHex;
  }
  return MOBILE_ACCENT_PRESETS.find((p) => p.id === settings.accent)?.hex ?? '#8B74FF';
}

export function applyMobileThemeToDocument(settings: MobileSettings): void {
  const root = document.documentElement;
  const hex = resolveMobileAccentHex(settings);
  root.style.setProperty('--accent-rgb', hexToRgbTriplet(hex));
  root.setAttribute('data-accent', settings.accent || 'violet');
  root.setAttribute('data-bg', settings.background || 'obsidian');
  root.setAttribute('data-glow', settings.glowEnabled === false ? 'off' : 'on');
  root.setAttribute('data-shape', settings.shape || 'rounded');
  root.setAttribute('data-card-style', settings.cardStyle || 'solid');
  root.setAttribute('data-density', settings.density || 'normal');
  root.setAttribute('data-font-scale', settings.fontScale || 'md');
}
