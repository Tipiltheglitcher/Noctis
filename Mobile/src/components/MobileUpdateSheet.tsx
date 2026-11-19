import React from 'react';
import { Download, Sparkles, X } from 'lucide-react';
import type { MobileUpdateInfo } from '@/types';
import { openExternalUrl } from '@/services/updater';

interface MobileUpdateSheetProps {
  update: MobileUpdateInfo;
  onDismiss: () => void;
}

export const MobileUpdateSheet: React.FC<MobileUpdateSheetProps> = ({ update, onDismiss }) => {
  const sizeMb =
    update.apkSize && update.apkSize > 0
      ? `${(update.apkSize / (1024 * 1024)).toFixed(1)} Mo`
      : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#101018] border border-accent/35 overflow-hidden shadow-2xl">
        <div className="h-1 bg-gradient-to-r from-accent via-accent/60 to-transparent" />
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="text-base font-bold text-white">Mise à jour Noctis</div>
                <div className="text-xs text-zinc-400 font-mono mt-0.5">
                  v{update.currentVersion} →{' '}
                  <span className="text-accent font-semibold">v{update.latestVersion}</span>
                  {sizeMb ? ` · ${sizeMb}` : ''}
                </div>
              </div>
            </div>
            <button onClick={onDismiss} className="p-1.5 text-zinc-500">
              <X className="w-4 h-4" />
            </button>
          </div>

          {update.releaseNotes && (
            <div className="max-h-36 overflow-y-auto p-3 rounded-xl bg-[#08080D] border border-white/[0.06] text-xs text-zinc-300 whitespace-pre-wrap">
              {update.releaseNotes}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onDismiss}
              className="flex-1 py-2.5 rounded-xl bg-white/[0.06] text-xs font-semibold text-zinc-300"
            >
              Plus tard
            </button>
            <button
              onClick={() => openExternalUrl(update.apkUrl || update.releaseUrl)}
              className="flex-[1.5] py-2.5 rounded-xl bg-accent text-black text-xs font-bold flex items-center justify-center gap-1.5 shadow-glow"
            >
              <Download className="w-4 h-4" />
              Télécharger l'APK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
