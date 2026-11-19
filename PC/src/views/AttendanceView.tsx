import React, { useMemo, useState } from 'react';
import {
  UserX,
  Clock,
  ShieldAlert,
  MessageCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import type { AttendanceDTO, PeriodDTO } from '@shared/types';
import { formatDateFull, formatDurationMinutes, formatTime } from '@/utils/format';

interface AttendanceViewProps {
  attendance: AttendanceDTO | null;
  periods: PeriodDTO[];
  selectedPeriodId: string;
  loading: boolean;
  onSelectPeriod: (periodId: string) => void;
}

type Category = 'all' | 'absences' | 'delays' | 'punishments' | 'observations';

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  attendance,
  periods,
  selectedPeriodId,
  loading,
  onSelectPeriod,
}) => {
  const [category, setCategory] = useState<Category>('all');

  const totalAbsenceMinutes = useMemo(() => {
    if (!attendance) return 0;
    return attendance.absences.reduce(
      (sum, a) => sum + a.hoursMissed * 60 + a.minutesMissed,
      0
    );
  }, [attendance]);

  const totalDelayMinutes = useMemo(() => {
    if (!attendance) return 0;
    return attendance.delays.reduce((sum, d) => sum + d.minutes, 0);
  }, [attendance]);

  const cards = [
    {
      id: 'absences' as const,
      label: 'Absences',
      count: attendance?.absences.length ?? 0,
      sub: totalAbsenceMinutes > 0 ? formatDurationMinutes(totalAbsenceMinutes) : 'Aucune',
      icon: UserX,
      color: 'text-rose-400',
    },
    {
      id: 'delays' as const,
      label: 'Retards',
      count: attendance?.delays.length ?? 0,
      sub: totalDelayMinutes > 0 ? formatDurationMinutes(totalDelayMinutes) : 'Aucun',
      icon: Clock,
      color: 'text-amber-400',
    },
    {
      id: 'punishments' as const,
      label: 'Punitions',
      count: attendance?.punishments.length ?? 0,
      sub: (attendance?.punishments.length ?? 0) === 0 ? 'Rien à signaler' : 'Enregistrée(s)',
      icon: ShieldAlert,
      color: 'text-orange-400',
    },
    {
      id: 'observations' as const,
      label: 'Observations',
      count: attendance?.observations.length ?? 0,
      sub: (attendance?.observations.length ?? 0) === 0 ? 'Aucune' : 'Carnet',
      icon: MessageCircle,
      color: 'text-sky-400',
    },
  ];

  const isEmpty =
    (attendance?.absences.length ?? 0) === 0 &&
    (attendance?.delays.length ?? 0) === 0 &&
    (attendance?.punishments.length ?? 0) === 0 &&
    (attendance?.observations.length ?? 0) === 0;

  return (
    <div className="p-6 lg:p-8 max-w-[1150px] mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Vie scolaire</h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Absences, retards, punitions et observations
            </p>
          </div>
          {loading && <Loader2 className="w-4 h-4 text-accent animate-spin" />}
        </div>

        {periods.length > 0 && (
          <select
            value={selectedPeriodId}
            onChange={(e) => onSelectPeriod(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-[#0F0F15] border border-white/[0.08] text-xs font-medium text-zinc-100 focus:border-accent/60 focus:outline-none"
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {cards.map((c) => {
          const Icon = c.icon;
          const active = category === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setCategory(active ? 'all' : c.id)}
              className={`p-4 rounded-2xl border text-left transition-all ${
                active
                  ? 'bg-accent/15 border-accent/35'
                  : 'bg-[#0E0E14] hover:bg-[#14141D] border-white/[0.06]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-zinc-400">{c.label}</span>
                <Icon className={`w-4 h-4 ${c.color}`} />
              </div>
              <div className="text-2xl font-bold text-white tabular-nums">{c.count}</div>
              <div className="text-[11.5px] text-zinc-500 mt-0.5">{c.sub}</div>
            </button>
          );
        })}
      </div>

      {isEmpty ? (
        <div className="rounded-2xl bg-[#0D0D12] border border-white/[0.06] py-16 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500/70 mx-auto mb-3" />
          <p className="text-sm font-semibold text-zinc-200">Dossier exemplaire !</p>
          <p className="text-xs text-zinc-500 mt-1">
            Aucune absence, retard ou sanction sur cette période.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Absences */}
          {(category === 'all' || category === 'absences') &&
            (attendance?.absences.length ?? 0) > 0 && (
              <section className="space-y-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Absences ({attendance!.absences.length})
                </h2>
                <div className="space-y-2">
                  {attendance!.absences.map((a) => (
                    <div
                      key={a.id}
                      className="p-4 rounded-2xl bg-[#0E0E14] border border-white/[0.06] flex flex-wrap items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-sm font-semibold text-white">
                          Du {formatDateFull(a.startDate)} ({formatTime(a.startDate)}) au{' '}
                          {formatTime(a.endDate)}
                        </div>
                        <div className="text-xs text-zinc-400 mt-1">
                          {a.reason || 'Motif non renseigné'} ·{' '}
                          {formatDurationMinutes(a.hoursMissed * 60 + a.minutesMissed)}
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${
                          a.justified
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                            : 'bg-rose-500/15 text-rose-300 border border-rose-500/25'
                        }`}
                      >
                        {a.justified ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        )}
                        {a.justified ? 'Justifiée' : 'Non justifiée'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

          {/* Delays */}
          {(category === 'all' || category === 'delays') &&
            (attendance?.delays.length ?? 0) > 0 && (
              <section className="space-y-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Retards ({attendance!.delays.length})
                </h2>
                <div className="space-y-2">
                  {attendance!.delays.map((d) => (
                    <div
                      key={d.id}
                      className="p-4 rounded-2xl bg-[#0E0E14] border border-white/[0.06] flex flex-wrap items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {formatDateFull(d.date)} à {formatTime(d.date)} ·{' '}
                          <span className="text-amber-300">{d.minutes} min</span>
                        </div>
                        <div className="text-xs text-zinc-400 mt-1">
                          {d.reason || d.justification || 'Motif non renseigné'}
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          d.justified
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                        }`}
                      >
                        {d.justified ? 'Justifié' : 'Non justifié'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

          {/* Punishments */}
          {(category === 'all' || category === 'punishments') &&
            (attendance?.punishments.length ?? 0) > 0 && (
              <section className="space-y-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Punitions ({attendance!.punishments.length})
                </h2>
                <div className="space-y-2">
                  {attendance!.punishments.map((p) => (
                    <div
                      key={p.id}
                      className="p-4 rounded-2xl bg-rose-500/[0.04] border border-rose-500/20 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-white">{p.title}</span>
                        <span className="text-xs text-zinc-400">
                          {formatDateFull(p.dateGiven)}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-300">
                        Par {p.giver}
                        {p.reasons.length > 0 ? ` · ${p.reasons.join(', ')}` : ''}
                      </div>
                      {p.workToDo && (
                        <div className="text-xs text-zinc-400">Travail : {p.workToDo}</div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

          {/* Observations */}
          {(category === 'all' || category === 'observations') &&
            (attendance?.observations.length ?? 0) > 0 && (
              <section className="space-y-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Observations ({attendance!.observations.length})
                </h2>
                <div className="space-y-2">
                  {attendance!.observations.map((o) => (
                    <div
                      key={o.id}
                      className="p-4 rounded-2xl bg-[#0E0E14] border border-white/[0.06] flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {o.name}
                          {o.subject ? (
                            <span className="text-zinc-400 font-normal"> · {o.subject}</span>
                          ) : null}
                        </div>
                        {o.reason && <div className="text-xs text-zinc-400 mt-1">{o.reason}</div>}
                      </div>
                      <span className="text-xs text-zinc-500 shrink-0">
                        {formatDateFull(o.date)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
        </div>
      )}
    </div>
  );
};
