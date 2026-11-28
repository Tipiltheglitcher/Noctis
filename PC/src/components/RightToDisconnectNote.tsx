import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Info, X } from 'lucide-react';
import type { HolidayDTO } from '@shared/types';
import { getRightToDisconnectInfo } from '@/utils/schoolTime';

interface RightToDisconnectNoteProps {
  holidays?: HolidayDTO[];
  className?: string;
}

const DISMISS_STORAGE_KEY = 'noctis_rtd_dismissed_window';

function readDismissedWindow(): string | null {
  try {
    return sessionStorage.getItem(DISMISS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeDismissedWindow(key: string): void {
  try {
    sessionStorage.setItem(DISMISS_STORAGE_KEY, key);
  } catch {
    // ignore
  }
}

export const RightToDisconnectNote: React.FC<RightToDisconnectNoteProps> = ({
  holidays,
  className = '',
}) => {
  const [now, setNow] = useState(() => new Date());
  const [expanded, setExpanded] = useState(false);
  const [dismissedKey, setDismissedKey] = useState<string | null>(() => readDismissedWindow());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const info = getRightToDisconnectInfo(now, holidays);
  if (!info.active || dismissedKey === info.windowKey) return null;

  const handleDismiss = () => {
    writeDismissedWindow(info.windowKey);
    setDismissedKey(info.windowKey);
  };

  return (
    <div
      className={`rounded-2xl bg-sky-500/[0.08] border border-sky-400/25 px-4 py-3 text-xs text-sky-100/90 space-y-2.5 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0 leading-relaxed">
          <div className="w-6 h-6 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300 shrink-0 mt-0.5">
            <Info className="w-3.5 h-3.5" />
          </div>
          <p className="text-[12.5px] text-sky-100/90">
            Vous êtes actuellement dans une plage horaire où{' '}
            <strong className="font-semibold text-white">
              certaines informations sont masquées
            </strong>{' '}
            afin de respecter le{' '}
            <strong className="font-semibold text-white">droit à la déconnexion</strong>.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          title="Fermer"
          className="p-1 rounded-lg text-sky-300/75 hover:text-white hover:bg-sky-400/15 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {expanded && (
        <ul className="pl-8 pr-2 space-y-1.5 text-[12px] text-sky-100/80 list-disc leading-relaxed">
          <li>
            Les <strong className="text-white font-semibold">nouvelles notes</strong> seront
            visibles à partir de <strong className="text-white font-semibold">7h</strong>, 1 jour
            après leur publication.
          </li>
          <li>
            <strong className="text-white font-semibold">Aucun nouveau travail à faire</strong> ne
            sera publié de <strong className="text-white font-semibold">20h à 7h</strong>.
          </li>
          <li>
            Les{' '}
            <strong className="text-white font-semibold">
              nouveaux messages, informations et sondages
            </strong>{' '}
            ne seront pas publiés :
            <ul className="pl-4 mt-1 space-y-0.5 list-none text-sky-100/75">
              <li>
                - entre <strong className="text-white font-semibold">20h</strong> et{' '}
                <strong className="text-white font-semibold">7h</strong> les{' '}
                <strong className="text-white font-semibold">
                  lundi, mardi, mercredi, jeudi
                </strong>{' '}
                et <strong className="text-white font-semibold">vendredi</strong>
              </li>
              <li>
                - les <strong className="text-white font-semibold">samedi</strong> et{' '}
                <strong className="text-white font-semibold">dimanche</strong>
              </li>
              <li>
                - les <strong className="text-white font-semibold">jours fériés</strong>
              </li>
              <li>
                - pendant les{' '}
                <strong className="text-white font-semibold">vacances scolaires</strong>
                {info.holidayName ? ` (${info.holidayName})` : ''}
              </li>
            </ul>
          </li>
        </ul>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="px-3 py-1 rounded-full bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 text-[11px] font-semibold text-sky-200 inline-flex items-center gap-1.5 transition-colors"
        >
          {expanded ? (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              <span>Voir moins</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5" />
              <span>Voir plus</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
