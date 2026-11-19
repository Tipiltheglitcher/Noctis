import React, { useEffect, useState } from 'react';
import { Minus, Square, Copy, X, RefreshCw, Sparkles } from 'lucide-react';
import type { StudentProfile } from '@shared/types';

interface TitleBarProps {
  profile: StudentProfile | null;
  refreshing: boolean;
  lastUpdated: Date | null;
  onRefresh?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  profile,
  refreshing,
  lastUpdated,
  onRefresh,
}) => {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    window.pronoteAPI.window.isMaximized().then(setMaximized).catch(() => {});
    return window.pronoteAPI.window.onMaximizedChange(setMaximized);
  }, []);

  const updatedLabel = lastUpdated
    ? `Mis à jour à ${lastUpdated.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : null;

  return (
    <header className="app-drag h-11 shrink-0 bg-[#08080C] border-b border-white/[0.06] flex items-center justify-between pl-4 pr-0 select-none z-50">
      {/* Left: Brand + School */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-accent/90 to-accent/40 flex items-center justify-center shadow-glow border border-white/15 shrink-0">
          <span className="text-[12px] font-bold text-white tracking-tight leading-none">N</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[13px] font-semibold tracking-tight text-white">Noctis</span>
          {profile && (
            <>
              <span className="text-zinc-700">/</span>
              <span className="text-[12px] text-zinc-400 truncate max-w-[300px]">
                {profile.establishmentName}
              </span>
              {profile.isDemo && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/25">
                  <Sparkles className="w-2.5 h-2.5" />
                  DÉMO
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right: Sync + Window Controls */}
      <div className="app-no-drag flex items-center h-full">
        {profile && onRefresh && (
          <div className="flex items-center gap-2.5 mr-3">
            {updatedLabel && (
              <span className="text-[11px] text-zinc-500 hidden sm:inline tabular-nums">
                {updatedLabel}
              </span>
            )}
            <button
              onClick={onRefresh}
              disabled={refreshing}
              title="Actualiser les données (Ctrl+R)"
              className="h-7 px-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 hover:text-white text-[11.5px] font-medium flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-accent' : ''}`} />
              <span>Actualiser</span>
            </button>
          </div>
        )}

        <button
          onClick={() => window.pronoteAPI.window.minimize()}
          title="Réduire"
          className="h-full w-11 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => window.pronoteAPI.window.toggleMaximize()}
          title={maximized ? 'Restaurer' : 'Agrandir'}
          className="h-full w-11 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          {maximized ? <Copy className="w-3 h-3" /> : <Square className="w-3 h-3" />}
        </button>

        <button
          onClick={() => window.pronoteAPI.window.close()}
          title="Fermer"
          className="h-full w-12 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-rose-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
