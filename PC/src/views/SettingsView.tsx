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
} from 'lucide-react';
import type { AccentTheme, AppSettings, StudentProfile } from '@shared/types';

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

const ACCENTS: Array<{ id: AccentTheme; name: string; swatch: string; desc: string }> = [
  { id: 'violet', name: 'Violet Nocturne', swatch: '#8B74FF', desc: 'Moderne & lumineux' },
  { id: 'emerald', name: 'Émeraude', swatch: '#10B981', desc: 'Frais & équilibré' },
  { id: 'cyan', name: 'Cyan Polaire', swatch: '#22D3EE', desc: 'Net & futuriste' },
  { id: 'mono', name: 'Obsidian Blanc', swatch: '#F4F4F5', desc: 'Minimaliste pur noir' },
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
  return (
    <div className="p-6 lg:p-8 max-w-[880px] mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Paramètres</h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Personnalisez votre application Noctis
        </p>
      </div>

      {/* Accent Theme */}
      <section className="rounded-2xl bg-[#0D0D13] border border-white/[0.06] p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <Palette className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-white">Couleur d'accentuation (Mode Noir)</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ACCENTS.map((item) => {
            const active = settings.accent === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onUpdateSettings({ accent: item.id })}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  active
                    ? 'bg-white/[0.06] border-accent/60'
                    : 'bg-[#121219] border-white/[0.06] hover:border-white/[0.14]'
                }`}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span
                    className="w-6 h-6 rounded-full border border-white/20"
                    style={{ backgroundColor: item.swatch }}
                  />
                  {active && <Check className="w-4 h-4 text-accent" />}
                </div>
                <div className="text-xs font-semibold text-white">{item.name}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">{item.desc}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Notifications & Refresh */}
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
      </section>

      {/* Account & Security */}
      <section className="rounded-2xl bg-[#0D0D13] border border-white/[0.06] p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">Compte connecté</h2>
        </div>

        <div className="p-4 rounded-xl bg-[#12121A] border border-white/[0.05] flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-white">
              {profile.name} · <span className="text-zinc-400 font-normal">{profile.className}</span>
            </div>
            <div className="text-xs text-zinc-400 mt-0.5">{profile.establishmentName}</div>
            <div className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5">
              <span>{profile.instanceUrl}</span>
              <button
                onClick={() => window.pronoteAPI.system.openExternal(profile.instanceUrl)}
                className="text-accent hover:underline inline-flex items-center gap-0.5"
              >
                Ouvrir <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Se déconnecter / Changer de compte
          </button>
        </div>

        <p className="text-[11.5px] text-zinc-500">
          Votre jeton de session PRONOTE est chiffré localement via le coffre sécurisé Windows (DPAPI) et n'est jamais envoyé à aucun serveur tiers.
        </p>
      </section>

      {/* Updates & About */}
      <section className="rounded-2xl bg-[#0D0D13] border border-white/[0.06] p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <DownloadCloud className="w-4 h-4 text-accent mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-white">
                Mises à jour automatiques ·{' '}
                <span className="font-mono text-accent">v{appVersion}</span>
              </div>
              <div className="text-xs text-zinc-400 mt-0.5">
                Noctis vérifie automatiquement les nouvelles versions sur GitHub à chaque démarrage.
              </div>
              {updateFeedback && (
                <div className="text-xs text-emerald-300 mt-1.5">{updateFeedback}</div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onCheckUpdates}
              disabled={checkingUpdate}
              className="px-3.5 py-2 rounded-xl bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {checkingUpdate ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>Vérifier</span>
            </button>
            <button
              onClick={() =>
                window.pronoteAPI.system.openExternal('https://tipiltheglitcher.github.io/Noctis/')
              }
              className="px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs text-zinc-300 inline-flex items-center gap-1 transition-colors"
            >
              <span>Site</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
