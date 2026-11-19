import React, { useEffect, useState } from 'react';
import { Download, Sparkles, X, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import type { UpdateInfoDTO, UpdateProgressDTO } from '@shared/types';

interface UpdateModalProps {
  update: UpdateInfoDTO;
  onDismiss: () => void;
}

function formatMB(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ update, onDismiss }) => {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<UpdateProgressDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return window.pronoteAPI.updater.onDownloadProgress((p) => {
      setProgress(p);
    });
  }, []);

  const handleInstall = async () => {
    if (!update.downloadUrl || !update.assetName) {
      await window.pronoteAPI.system.openExternal(update.releaseUrl);
      return;
    }
    setError(null);
    setDownloading(true);
    setProgress({ percent: 0, downloadedBytes: 0, totalBytes: update.assetSize || 0 });
    const res = await window.pronoteAPI.updater.downloadAndInstall(
      update.downloadUrl,
      update.assetName
    );
    if (!res.ok) {
      setDownloading(false);
      setError(res.error || 'Échec du téléchargement de la mise à jour.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-2xl bg-[#0F0F16] border border-accent/35 shadow-[0_24px_70px_-10px_rgba(0,0,0,0.9)] overflow-hidden animate-slide-up">
        <div className="h-1.5 w-full bg-gradient-to-r from-accent via-accent/60 to-transparent" />

        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Mise à jour disponible !</h2>
                <div className="flex items-center gap-2 mt-0.5 text-xs">
                  <span className="text-zinc-500 font-mono">v{update.currentVersion}</span>
                  <span className="text-zinc-600">→</span>
                  <span className="px-1.5 py-0.5 rounded bg-accent/20 text-accent font-mono font-semibold">
                    v{update.latestVersion}
                  </span>
                  {update.assetSize ? (
                    <span className="text-zinc-500">· {formatMB(update.assetSize)}</span>
                  ) : null}
                </div>
              </div>
            </div>

            {!downloading && (
              <button
                onClick={onDismiss}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {update.releaseNotes && (
            <div className="max-h-40 overflow-y-auto p-3.5 rounded-xl bg-[#09090D] border border-white/[0.06] text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {update.releaseNotes}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {downloading && progress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                  {progress.percent >= 100
                    ? "Lancement de l'installeur…"
                    : 'Téléchargement de la mise à jour…'}
                </span>
                <span className="font-mono text-accent font-semibold tabular-nums">
                  {progress.percent}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/[0.07] overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-150"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              {progress.totalBytes > 0 && (
                <div className="text-[11px] text-zinc-500 text-right tabular-nums">
                  {formatMB(progress.downloadedBytes)} / {formatMB(progress.totalBytes)}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={() => window.pronoteAPI.system.openExternal(update.releaseUrl)}
              className="text-xs text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1"
            >
              <span>Voir sur GitHub</span>
              <ExternalLink className="w-3 h-3" />
            </button>

            <div className="flex items-center gap-2">
              {!downloading && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-zinc-300 transition-colors"
                >
                  Plus tard
                </button>
              )}
              <button
                type="button"
                disabled={downloading}
                onClick={handleInstall}
                className="px-4 py-2 rounded-xl bg-accent hover:opacity-90 disabled:opacity-50 text-black text-xs font-semibold inline-flex items-center gap-1.5 shadow-glow transition-all"
              >
                {downloading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>{downloading ? 'Téléchargement…' : 'Télécharger & installer'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
