import React from 'react';
import { Download, RefreshCw, Scale } from 'lucide-react';
import type { StudentProfile } from '@shared/types';

interface WebTopBarProps {
  profile: StudentProfile | null;
  refreshing: boolean;
  onRefresh?: () => void;
}

export const WebTopBar: React.FC<WebTopBarProps> = ({ profile, refreshing, onRefresh }) => {
  return (
    <header className="h-12 shrink-0 bg-[#08080C] border-b border-white/[0.06] flex items-center justify-between px-4 select-none z-50">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent/90 to-accent/40 flex items-center justify-center shadow-glow border border-white/15 shrink-0">
          <span className="text-[13px] font-bold text-white leading-none">N</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[14px] font-bold tracking-tight text-white">Noctis</span>
          <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent border border-accent/25 text-[10px] font-semibold uppercase tracking-wider">
            Web
          </span>
          {profile && (
            <>
              <span className="text-zinc-700 hidden sm:inline">/</span>
              <span className="text-[12px] text-zinc-400 truncate max-w-[260px] hidden sm:inline">
                {profile.establishmentName}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {profile && onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="h-8 px-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-accent' : ''}`} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        )}

        <a
          href="./legal.html"
          title="Mentions légales & Confidentialité"
          className="h-8 px-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-400 hover:text-white text-xs font-medium hidden md:flex items-center gap-1.5 transition-all"
        >
          <Scale className="w-3.5 h-3.5" />
          <span>Mentions légales</span>
        </a>

        <a
          href="./download.html"
          className="h-8 px-3 rounded-lg bg-accent hover:opacity-90 text-black text-xs font-bold flex items-center gap-1.5 shadow-glow transition-opacity shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Télécharger PC / Android</span>
          <span className="sm:hidden">Télécharger</span>
        </a>
      </div>
    </header>
  );
};
