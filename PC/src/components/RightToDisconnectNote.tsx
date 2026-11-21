import React, { useEffect, useState } from 'react';
import { MoonStar } from 'lucide-react';
import { getRightToDisconnectInfo } from '@/utils/schoolTime';

interface RightToDisconnectNoteProps {
  serverDisabled?: boolean;
  /** When true, only renders if currently inside disconnect hours or serverDisabled */
  onlyWhenActive?: boolean;
  className?: string;
}

export const RightToDisconnectNote: React.FC<RightToDisconnectNoteProps> = ({
  serverDisabled = false,
  onlyWhenActive = false,
  className = '',
}) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const info = getRightToDisconnectInfo(now, serverDisabled);
  if (onlyWhenActive && !info.active) return null;

  if (info.active) {
    return (
      <div
        className={`rounded-2xl bg-indigo-500/[0.08] border border-indigo-400/25 px-4 py-3 flex items-start gap-3 ${className}`}
      >
        <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0 mt-0.5">
          <MoonStar className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0 text-xs leading-relaxed">
          <div className="font-semibold text-indigo-200">{info.title}</div>
          <p className="text-indigo-200/75 mt-0.5">{info.description}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl bg-white/[0.025] border border-white/[0.06] px-3.5 py-2 flex items-center gap-2.5 text-[11.5px] text-zinc-400 ${className}`}
    >
      <MoonStar className="w-3.5 h-3.5 text-indigo-400/80 shrink-0" />
      <span>{info.description}</span>
    </div>
  );
};
