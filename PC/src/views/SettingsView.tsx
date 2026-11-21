import React from 'react';
import {
  Palette,
  Bell,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Check,
  ExternalLink,
  DownloadCloud,
  Loader2,
  Shapes,
  LayoutGrid,
  Sparkles,
  RotateCcw,
  CalendarDays,
  Sliders,
  Pipette,
} from 'lucide-react';
import type {
  AppSettings,
  BackgroundTheme,
  CardStyle,
  CourseCardStyle,
  DashboardLayout,
  DensityStyle,
  FontScale,
  ShapeStyle,
  SidebarPosition,
  StudentProfile,
} from '@shared/types';
import {
  ACCENT_PRESETS,
  DEFAULT_APP_SETTINGS,
  resolveAccentHex,
} from '@/utils/theme';

interface SettingsViewProps {
  profile: StudentProfile;
  settings: AppSettings;
  appVersion: string;
  checkingUpdate: boolean;
  updateFeedback: string | null;
  onCheckUpdates: () => void;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onLogout: () => void;
}

const BACKGROUNDS: Array<{ id: BackgroundTheme; name: string; swatch: string; desc: string }> = [
  { id: 'obsidian', name: 'Obsidian', swatch: '#060608', desc: 'Noir profond' },
  { id: 'amoled', name: 'AMOLED Pur', swatch: '#000000', desc: 'Noir absolu' },
  { id: 'midnight', name: 'Minuit', swatch: '#080C18', desc: 'Bleu nuit' },
  { id: 'graphite', name: 'Graphite', swatch: '#121318', desc: 'Carbone doux' },
  { id: 'aurora', name: 'Aurore', swatch: '#0C0717', desc: 'Sombre violacé' },
];

const SHAPES: Array<{ id: ShapeStyle; name: string; previewRadius: string; desc: string }> = [
  { id: 'sharp', name: 'Carré', previewRadius: '4px', desc: 'Angles nets' },
  { id: 'balanced', name: 'Équilibré', previewRadius: '10px', desc: 'Classique' },
  { id: 'rounded', name: 'Arrondi', previewRadius: '16px', desc: 'Défaut Noctis' },
  { id: 'pill', name: 'Bulle', previewRadius: '24px', desc: 'Ultra doux' },
];

const CARD_STYLES: Array<{ id: CardStyle; name: string; desc: string }> = [
  { id: 'solid', name: 'Obsidian Mat', desc: 'Fond sombre classique' },
  { id: 'glass', name: 'Verre (Glass)', desc: 'Translucide & flouté' },
  { id: 'outline', name: 'Contour Néon', desc: 'Noir pur + bordures accent' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  settings,
  appVersion,
  checkingUpdate,
  updateFeedback,
  onCheckUpdates,
  onUpdateSettings,
  onLogout,
}) => {
  const accentHex = resolveAccentHex(settings);
  const widgets = {
    ...DEFAULT_APP_SETTINGS.dashboardWidgets!,
    ...(settings.dashboardWidgets ?? {}),
  };

  const toggleWidget = (key: keyof typeof widgets) => {
    onUpdateSettings({
      dashboardWidgets: {
        ...widgets,
        [key]: !widgets[key],
      },
    });
  };

  const resetVisualDefaults = () => {
    onUpdateSettings({
      accent: DEFAULT_APP_SETTINGS.accent,
      customAccentHex: DEFAULT_APP_SETTINGS.customAccentHex,
      background: DEFAULT_APP_SETTINGS.background,
      glowEnabled: DEFAULT_APP_SETTINGS.glowEnabled,
      shape: DEFAULT_APP_SETTINGS.shape,
      cardStyle: DEFAULT_APP_SETTINGS.cardStyle,
      density: DEFAULT_APP_SETTINGS.density,
      fontScale: DEFAULT_APP_SETTINGS.fontScale,
      sidebarPosition: DEFAULT_APP_SETTINGS.sidebarPosition,
      sidebarCompact: DEFAULT_APP_SETTINGS.sidebarCompact,
      dashboardLayout: DEFAULT_APP_SETTINGS.dashboardLayout,
      dashboardWidgets: { ...DEFAULT_APP_SETTINGS.dashboardWidgets! },
      defaultTimetableView: DEFAULT_APP_SETTINGS.defaultTimetableView,
      courseCardStyle: DEFAULT_APP_SETTINGS.courseCardStyle,
      showBreaks: DEFAULT_APP_SETTINGS.showBreaks,
    });
  };

  return (
    <div className="p-6 lg:p-8 max-w-[960px] mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Paramètres & Personnalisation</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Couleurs perso, formes, matériaux, disposition et emploi du temps — tout s'applique en direct
          </p>
        </div>
        <button
          onClick={resetVisualDefaults}
          className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-medium text-zinc-300 inline-flex items-center gap-1.5 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Réinitialiser le style
        </button>
      </div>

      {/* LIVE MINI PREVIEW */}
      <section className="rounded-2xl bg-[#0D0D13] border border-white/[0.08] p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center font-extrabold text-black shadow-glow shrink-0"
            style={{ backgroundColor: accentHex }}
          >
            N
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              Aperçu en direct
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent/20 text-accent border border-accent/35">
                {accentHex.toUpperCase()}
              </span>
            </div>
            <div className="text-xs text-zinc-400 mt-0.5">
              Fond <span className="text-zinc-200 capitalize">{settings.background || 'obsidian'}</span> · Forme{' '}
              <span className="text-zinc-200">{SHAPES.find((s) => s.id === (settings.shape || 'rounded'))?.name}</span> · Cartes{' '}
              <span className="text-zinc-200">{CARD_STYLES.find((c) => c.id === (settings.cardStyle || 'solid'))?.name}</span>
            </div>
          </div>
        </div>
        <div
          className="px-3.5 py-2 rounded-xl border border-l-[4px] bg-[#14141F] text-xs"
          style={{
            borderLeftColor: accentHex,
            borderColor:
              settings.courseCardStyle === 'border' || settings.courseCardStyle === 'tinted'
                ? `${accentHex}70`
                : 'rgba(255,255,255,0.08)',
            backgroundColor:
              settings.courseCardStyle === 'tinted' ? `${accentHex}20` : '#14141F',
          }}
        >
          <div className="text-[10px] text-zinc-400 tabular-nums">08:00 – 10:00</div>
          <div className="font-bold text-white">Mathématiques · Salle B204</div>
        </div>
      </section>

      {/* 1. COLORS & CUSTOM COLOR PICKER */}
      <section className="rounded-2xl bg-[#0D0D13] border border-white/[0.06] p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Palette className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-white">Couleur d'accentuation & Couleur perso</h2>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {ACCENT_PRESETS.map((item) => {
            const active = settings.accent === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onUpdateSettings({ accent: item.id, customAccentHex: item.hex })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  active
                    ? 'bg-white/[0.07] border-accent/65'
                    : 'bg-[#121219] border-white/[0.06] hover:border-white/[0.14]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="w-5 h-5 rounded-full border border-white/20"
                    style={{ backgroundColor: item.hex }}
                  />
                  {active && <Check className="w-3.5 h-3.5 text-accent" />}
                </div>
                <div className="text-xs font-semibold text-white">{item.name}</div>
                <div className="text-[10.5px] text-zinc-500 mt-0.5">{item.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Unlimited Custom Color Picker */}
        <div className="p-3.5 rounded-xl bg-[#111118] border border-white/[0.07] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/35 flex items-center justify-center text-accent shrink-0">
              <Pipette className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Couleur 100% personnalisée</div>
              <div className="text-[11px] text-zinc-400">
                Choisis n'importe quelle teinte librement (palette ou code HEX)
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <label className="relative cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-xs font-semibold text-white">
              <span
                className="w-4 h-4 rounded-full border border-white/25"
                style={{ backgroundColor: settings.customAccentHex || accentHex }}
              />
              <span>Choisir</span>
              <input
                type="color"
                value={settings.customAccentHex || accentHex}
                onChange={(e) =>
                  onUpdateSettings({ accent: 'custom', customAccentHex: e.target.value })
                }
                className="sr-only"
              />
            </label>
            <input
              type="text"
              value={settings.customAccentHex || accentHex}
              maxLength={7}
              onChange={(e) => {
                const v = e.target.value;
                onUpdateSettings({
                  accent: 'custom',
                  customAccentHex: v.startsWith('#') ? v : `#${v}`,
                });
              }}
              className="w-24 px-2.5 py-1.5 rounded-xl bg-[#09090F] border border-white/[0.1] text-xs font-mono text-zinc-200 text-center focus:border-accent/60 focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* 2. BACKGROUND THEME + GLOW */}
      <section className="rounded-2xl bg-[#0D0D13] border border-white/[0.06] p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-white">Ambiance & Fond sombre</h2>
          </div>

          <button
            onClick={() => onUpdateSettings({ glowEnabled: settings.glowEnabled === false })}
            className="flex items-center gap-2 text-xs text-zinc-300"
          >
            <span>Halo lumineux</span>
            <span
              className={`w-9 h-5 rounded-full p-0.5 transition-colors inline-flex ${
                settings.glowEnabled !== false ? 'bg-accent justify-end' : 'bg-zinc-700 justify-start'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-black block" />
            </span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {BACKGROUNDS.map((bg) => {
            const active = (settings.background || 'obsidian') === bg.id;
            return (
              <button
                key={bg.id}
                onClick={() => onUpdateSettings({ background: bg.id })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  active
                    ? 'bg-white/[0.07] border-accent/65'
                    : 'bg-[#121219] border-white/[0.06] hover:border-white/[0.14]'
                }`}
              >
                <div
                  className="h-8 rounded-lg border border-white/15 mb-2 flex items-center justify-end px-1.5"
                  style={{ backgroundColor: bg.swatch }}
                >
                  {active && <Check className="w-3.5 h-3.5 text-accent" />}
                </div>
                <div className="text-xs font-semibold text-white">{bg.name}</div>
                <div className="text-[10.5px] text-zinc-500">{bg.desc}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. SHAPES, CARD STYLE, DENSITY & FONT SCALE */}
      <section className="rounded-2xl bg-[#0D0D13] border border-white/[0.06] p-5 space-y-5">
        <div className="flex items-center gap-2.5">
          <Shapes className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-white">Formes, matériaux & taille</h2>
        </div>

        {/* Shapes */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-zinc-400">Forme des cartes & boutons</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {SHAPES.map((s) => {
              const active = (settings.shape || 'rounded') === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => onUpdateSettings({ shape: s.id })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    active
                      ? 'bg-white/[0.07] border-accent/65'
                      : 'bg-[#121219] border-white/[0.06] hover:border-white/[0.14]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className="w-10 h-6 border-2 border-accent/70 bg-accent/15"
                      style={{ borderRadius: s.previewRadius }}
                    />
                    {active && <Check className="w-3.5 h-3.5 text-accent" />}
                  </div>
                  <div className="text-xs font-semibold text-white">{s.name}</div>
                  <div className="text-[10.5px] text-zinc-500">{s.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Card Style */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-zinc-400">Style des cartes</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {CARD_STYLES.map((c) => {
              const active = (settings.cardStyle || 'solid') === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => onUpdateSettings({ cardStyle: c.id })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    active
                      ? 'bg-white/[0.07] border-accent/65'
                      : 'bg-[#121219] border-white/[0.06] hover:border-white/[0.14]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">{c.name}</span>
                    {active && <Check className="w-3.5 h-3.5 text-accent" />}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{c.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Density + Font scale */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="space-y-2">
            <div className="text-xs font-medium text-zinc-400">Densité d'affichage</div>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#09090E] border border-white/[0.06] text-xs">
              {(
                [
                  { id: 'compact', label: 'Compact' },
                  { id: 'normal', label: 'Confort' },
                  { id: 'spacious', label: 'Aéré' },
                ] as Array<{ id: DensityStyle; label: string }>
              ).map((d) => (
                <button
                  key={d.id}
                  onClick={() => onUpdateSettings({ density: d.id })}
                  className={`py-1.5 rounded-lg font-medium transition-all ${
                    (settings.density || 'normal') === d.id
                      ? 'bg-accent text-black font-semibold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-zinc-400">Taille du texte</div>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#09090E] border border-white/[0.06] text-xs">
              {(
                [
                  { id: 'sm', label: 'Petite' },
                  { id: 'md', label: 'Normale' },
                  { id: 'lg', label: 'Grande' },
                ] as Array<{ id: FontScale; label: string }>
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => onUpdateSettings({ fontScale: f.id })}
                  className={`py-1.5 rounded-lg font-medium transition-all ${
                    (settings.fontScale || 'md') === f.id
                      ? 'bg-accent text-black font-semibold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. LAYOUT & DASHBOARD WIDGETS */}
      <section className="rounded-2xl bg-[#0D0D13] border border-white/[0.06] p-5 space-y-5">
        <div className="flex items-center gap-2.5">
          <LayoutGrid className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-white">Disposition de l'interface</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Sidebar Position */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-zinc-400">Position du menu</div>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#09090E] border border-white/[0.06] text-xs">
              {(
                [
                  { id: 'left', label: 'À gauche' },
                  { id: 'right', label: 'À droite' },
                ] as Array<{ id: SidebarPosition; label: string }>
              ).map((p) => (
                <button
                  key={p.id}
                  onClick={() => onUpdateSettings({ sidebarPosition: p.id })}
                  className={`py-1.5 rounded-lg font-medium transition-all ${
                    (settings.sidebarPosition || 'left') === p.id
                      ? 'bg-accent text-black font-semibold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sidebar Compact */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-zinc-400">Largeur du menu</div>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#09090E] border border-white/[0.06] text-xs">
              <button
                onClick={() => onUpdateSettings({ sidebarCompact: false })}
                className={`py-1.5 rounded-lg font-medium transition-all ${
                  !settings.sidebarCompact ? 'bg-accent text-black font-semibold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Complet
              </button>
              <button
                onClick={() => onUpdateSettings({ sidebarCompact: true })}
                className={`py-1.5 rounded-lg font-medium transition-all ${
                  settings.sidebarCompact ? 'bg-accent text-black font-semibold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Icônes
              </button>
            </div>
          </div>

          {/* Dashboard Layout */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-zinc-400">Disposition Accueil</div>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#09090E] border border-white/[0.06] text-xs">
              {(
                [
                  { id: 'bento', label: '2 colonnes' },
                  { id: 'stacked', label: '1 colonne' },
                ] as Array<{ id: DashboardLayout; label: string }>
              ).map((l) => (
                <button
                  key={l.id}
                  onClick={() => onUpdateSettings({ dashboardLayout: l.id })}
                  className={`py-1.5 rounded-lg font-medium transition-all ${
                    (settings.dashboardLayout || 'bento') === l.id
                      ? 'bg-accent text-black font-semibold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dashboard Widgets Toggles */}
        <div className="space-y-2 pt-1">
          <div className="text-xs font-medium text-zinc-400">Blocs visibles sur l'Accueil</div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: 'showKpis', label: 'Compteurs rapides (KPI)' },
                { key: 'showTimetable', label: 'Emploi du temps' },
                { key: 'showHomework', label: 'Prochains devoirs' },
                { key: 'showGrades', label: 'Dernières notes' },
                { key: 'showNews', label: 'Infos récentes' },
              ] as const
            ).map((w) => {
              const enabled = widgets[w.key];
              return (
                <button
                  key={w.key}
                  onClick={() => toggleWidget(w.key)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-all ${
                    enabled
                      ? 'bg-accent/15 border-accent/40 text-white'
                      : 'bg-[#121219] border-white/[0.06] text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {enabled && <Check className="w-3.5 h-3.5 text-accent" />}
                  <span>{w.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. TIMETABLE PREFERENCES */}
      <section className="rounded-2xl bg-[#0D0D13] border border-white/[0.06] p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <CalendarDays className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-white">Style de l'Emploi du temps</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="text-xs font-medium text-zinc-400">Affichage par défaut</div>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#09090E] border border-white/[0.06] text-xs">
              <button
                onClick={() => onUpdateSettings({ defaultTimetableView: 'week' })}
                className={`py-1.5 rounded-lg font-medium ${
                  (settings.defaultTimetableView || 'week') === 'week'
                    ? 'bg-accent text-black font-semibold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Semaine
              </button>
              <button
                onClick={() => onUpdateSettings({ defaultTimetableView: 'day' })}
                className={`py-1.5 rounded-lg font-medium ${
                  settings.defaultTimetableView === 'day'
                    ? 'bg-accent text-black font-semibold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Jour
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-zinc-400">Style des blocs cours</div>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#09090E] border border-white/[0.06] text-[11px]">
              {(
                [
                  { id: 'left', label: 'Barre' },
                  { id: 'border', label: 'Contour' },
                  { id: 'tinted', label: 'Teinté' },
                ] as Array<{ id: CourseCardStyle; label: string }>
              ).map((c) => (
                <button
                  key={c.id}
                  onClick={() => onUpdateSettings({ courseCardStyle: c.id })}
                  className={`py-1.5 rounded-lg font-medium ${
                    (settings.courseCardStyle || 'left') === c.id
                      ? 'bg-accent text-black font-semibold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-zinc-400">Pause déjeuner & pauses</div>
            <button
              onClick={() => onUpdateSettings({ showBreaks: settings.showBreaks === false })}
              className={`w-full py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-between transition-all ${
                settings.showBreaks !== false
                  ? 'bg-amber-500/10 border-amber-400/35 text-amber-200'
                  : 'bg-[#121219] border-white/[0.06] text-zinc-400'
              }`}
            >
              <span>Afficher les pauses</span>
              <span className="font-bold">{settings.showBreaks !== false ? 'Oui' : 'Non'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 6. NOTIFICATIONS & REFRESH */}
      <section className="rounded-2xl bg-[#0D0D13] border border-white/[0.06] divide-y divide-white/[0.06]">
        <div className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Bell className="w-4 h-4 text-accent mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-white">Notifications Windows</div>
              <div className="text-xs text-zinc-400 mt-0.5">
                Recevez une alerte lors d'une nouvelle note ou d'un cours annulé.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() =>
                window.pronoteAPI.system.notify(
                  'Noctis',
                  'Les notifications Windows fonctionnent parfaitement !'
                )
              }
              className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs text-zinc-300 transition-colors"
            >
              Tester
            </button>
            <button
              onClick={() =>
                onUpdateSettings({ notificationsEnabled: !settings.notificationsEnabled })
              }
              className={`w-11 h-6 rounded-full p-0.5 transition-colors ${
                settings.notificationsEnabled ? 'bg-accent' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-black transition-transform ${
                  settings.notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <RefreshCw className="w-4 h-4 text-accent mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-white">Actualisation automatique</div>
              <div className="text-xs text-zinc-400 mt-0.5">
                Synchronisation silencieuse en arrière-plan.
              </div>
            </div>
          </div>
          <select
            value={settings.refreshIntervalMinutes}
            onChange={(e) =>
              onUpdateSettings({ refreshIntervalMinutes: Number(e.target.value) })
            }
            className="px-3 py-1.5 rounded-xl bg-[#14141C] border border-white/[0.08] text-xs text-zinc-200 focus:border-accent/60 focus:outline-none"
          >
            <option value={5}>Toutes les 5 min</option>
            <option value={10}>Toutes les 10 min</option>
            <option value={20}>Toutes les 20 min</option>
            <option value={0}>Manuel uniquement</option>
          </select>
        </div>

        <div className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sliders className="w-4 h-4 text-accent mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-white">Mises à jour Noctis (v{appVersion})</div>
              <div className="text-xs text-zinc-400 mt-0.5">
                Vérification automatique sur GitHub Releases à chaque démarrage.
              </div>
              {updateFeedback && (
                <div className="text-xs text-emerald-300 mt-1.5">{updateFeedback}</div>
              )}
            </div>
          </div>
          <button
            onClick={onCheckUpdates}
            disabled={checkingUpdate}
            className="px-3.5 py-2 rounded-xl bg-accent/15 hover:bg-accent/25 border border-accent/30 text-xs font-semibold text-accent inline-flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-50"
          >
            {checkingUpdate ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <DownloadCloud className="w-3.5 h-3.5" />
            )}
            <span>Vérifier</span>
          </button>
        </div>
      </section>

      {/* 7. ACCOUNT & PRIVACY */}
      <section className="rounded-2xl bg-[#0D0D13] border border-white/[0.06] p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">Compte & Confidentialité</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-[#121219] border border-white/[0.05]">
            <div className="text-zinc-500">Élève</div>
            <div className="text-white font-semibold mt-0.5">{profile.name}</div>
            <div className="text-zinc-400 mt-0.5">{profile.className}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#121219] border border-white/[0.05]">
            <div className="text-zinc-500">Établissement</div>
            <div className="text-white font-semibold mt-0.5 truncate">
              {profile.establishmentName}
            </div>
            <button
              onClick={() => window.pronoteAPI.system.openExternal(profile.instanceUrl)}
              className="text-accent hover:underline mt-0.5 inline-flex items-center gap-1 truncate max-w-full"
            >
              Ouvrir sur le navigateur <ExternalLink className="w-3 h-3 shrink-0" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/[0.06]">
          <p className="text-[11.5px] text-zinc-500">
            Session chiffrée localement via Windows DPAPI. Aucune donnée envoyée à un serveur tiers.
          </p>
          <button
            onClick={onLogout}
            className="px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-semibold text-rose-300 inline-flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Se déconnecter
          </button>
        </div>
      </section>
    </div>
  );
};
