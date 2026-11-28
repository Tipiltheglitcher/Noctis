import React, { useMemo, useState } from 'react';
import {
  Award,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Calculator,
  Plus,
  Trash2,
  Paperclip,
  Loader2,
  Sparkles,
} from 'lucide-react';
import type { GradeDTO, GradesOverviewDTO, HolidayDTO, PeriodDTO } from '@shared/types';
import {
  formatDateShort,
  formatGradeNumber,
  getGradeColorClass,
  normalizeHexColor,
} from '@/utils/format';
import { RightToDisconnectNote } from '../components/RightToDisconnectNote';

interface GradesViewProps {
  grades: GradesOverviewDTO | null;
  periods: PeriodDTO[];
  selectedPeriodId: string;
  loading: boolean;
  holidays?: HolidayDTO[];
  onSelectPeriod: (periodId: string) => void;
}

interface SimulatedGrade {
  id: string;
  subjectId: string;
  subject: string;
  value: number;
  outOf: number;
  coefficient: number;
}

export const GradesView: React.FC<GradesViewProps> = ({
  grades,
  periods,
  selectedPeriodId,
  loading,
  holidays,
  onSelectPeriod,
}) => {
  const [viewTab, setViewTab] = useState<'subjects' | 'chronological'>('subjects');
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});
  const [simOpen, setSimOpen] = useState(false);
  const [simGrades, setSimGrades] = useState<SimulatedGrade[]>([]);
  const [simSubjectId, setSimSubjectId] = useState('');
  const [simValue, setSimValue] = useState('16');
  const [simOutOf, setSimOutOf] = useState('20');
  const [simCoeff, setSimCoeff] = useState('1');

  const toggleSubject = (subjectId: string) => {
    setExpandedSubjects((prev) => ({ ...prev, [subjectId]: prev[subjectId] === false ? true : !prev[subjectId] }));
  };

  // Compute subject averages including any simulated grades
  const computed = useMemo(() => {
    const subjects = grades?.subjectsAverages ?? [];
    const allGrades = grades?.grades ?? [];

    const bySubject = new Map<string, GradeDTO[]>();
    for (const g of allGrades) {
      if (!bySubject.has(g.subjectId)) bySubject.set(g.subjectId, []);
      bySubject.get(g.subjectId)!.push(g);
    }

    const simBySubject = new Map<string, SimulatedGrade[]>();
    for (const sg of simGrades) {
      if (!simBySubject.has(sg.subjectId)) simBySubject.set(sg.subjectId, []);
      simBySubject.get(sg.subjectId)!.push(sg);
    }

    const enrichedSubjects = subjects.map((sa) => {
      const realList = bySubject.get(sa.subjectId) ?? [];
      const sims = simBySubject.get(sa.subjectId) ?? [];

      let displayAvg = sa.student;
      if (sims.length > 0) {
        let weightedSum = 0;
        let coeffSum = 0;
        for (const g of realList) {
          if (g.value.kind === 0 && g.outOf > 0) {
            const on20 = (g.value.points / g.outOf) * 20;
            weightedSum += on20 * (g.coefficient || 1);
            coeffSum += g.coefficient || 1;
          }
        }
        // Fallback if subject has an official average but no individual grade breakdown
        if (coeffSum === 0 && sa.student !== undefined) {
          weightedSum = sa.student;
          coeffSum = 1;
        }
        for (const sg of sims) {
          if (sg.outOf > 0) {
            const on20 = (sg.value / sg.outOf) * 20;
            weightedSum += on20 * (sg.coefficient || 1);
            coeffSum += sg.coefficient || 1;
          }
        }
        displayAvg = coeffSum > 0 ? weightedSum / coeffSum : sa.student;
      }

      return {
        ...sa,
        grades: realList,
        simulated: sims,
        simulatedAverage: displayAvg,
      };
    });

    const validAvgs = enrichedSubjects
      .map((s) => s.simulatedAverage)
      .filter((v): v is number => v !== undefined);

    const simulatedOverall =
      simGrades.length > 0 && validAvgs.length > 0
        ? validAvgs.reduce((acc, v) => acc + v, 0) / validAvgs.length
        : grades?.overallAverage;

    return { enrichedSubjects, simulatedOverall };
  }, [grades, simGrades]);

  // SVG chart points (chronological grades normalized to /20)
  const chartPoints = useMemo(() => {
    const valid = [...(grades?.grades ?? [])]
      .filter((g) => g.value.kind === 0 && g.outOf > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (valid.length < 2) return null;

    const w = 520;
    const h = 110;
    const padX = 12;
    const padY = 14;
    const pts = valid.map((g, i) => {
      const val = (g.value.points / g.outOf) * 20;
      const x = padX + (i / (valid.length - 1)) * (w - padX * 2);
      const y = h - padY - (Math.max(0, Math.min(20, val)) / 20) * (h - padY * 2);
      return { x, y, val, label: `${g.subject} : ${g.value.label}/${g.outOf}` };
    });

    const polyline = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const areaPath = `M ${pts[0].x},${h - padY} L ${pts
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' L ')} L ${pts[pts.length - 1].x},${h - padY} Z`;

    return { w, h, pts, polyline, areaPath };
  }, [grades]);

  const addSimulatedGrade = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(simValue.replace(',', '.'));
    const out = parseFloat(simOutOf.replace(',', '.'));
    const coef = parseFloat(simCoeff.replace(',', '.'));
    if (Number.isNaN(val) || Number.isNaN(out) || out <= 0 || Number.isNaN(coef) || coef <= 0) {
      return;
    }
    const targetSubject =
      computed.enrichedSubjects.find((s) => s.subjectId === simSubjectId) ||
      computed.enrichedSubjects[0];
    if (!targetSubject) return;

    setSimGrades((prev) => [
      ...prev,
      {
        id: `sim-${Date.now()}`,
        subjectId: targetSubject.subjectId,
        subject: targetSubject.subject,
        value: Math.max(0, Math.min(out, val)),
        outOf: out,
        coefficient: coef,
      },
    ]);
  };

  const overallDelta =
    simGrades.length > 0 &&
    computed.simulatedOverall !== undefined &&
    grades?.overallAverage !== undefined
      ? computed.simulatedOverall - grades.overallAverage
      : null;

  return (
    <div className="p-6 lg:p-8 max-w-[1250px] mx-auto space-y-6 animate-fade-in">
      {/* Header + Period Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Notes & Moyennes</h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Suivi de vos résultats, moyennes par matière et simulateur
            </p>
          </div>
          {loading && <Loader2 className="w-4 h-4 text-accent animate-spin" />}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {periods.length > 0 && (
            <select
              value={selectedPeriodId}
              onChange={(e) => {
                setSimGrades([]);
                onSelectPeriod(e.target.value);
              }}
              className="px-3.5 py-2 rounded-xl bg-[#0F0F15] border border-white/[0.08] text-xs font-medium text-zinc-100 focus:border-accent/60 focus:outline-none"
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setSimOpen((v) => !v)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              simOpen || simGrades.length > 0
                ? 'bg-accent/20 text-accent border-accent/35'
                : 'bg-[#0F0F15] hover:bg-[#161620] text-zinc-200 border-white/[0.08]'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Simulateur{simGrades.length > 0 ? ` (${simGrades.length})` : ''}</span>
          </button>
        </div>
      </div>

      {/* Hero Stats + Evolution Chart */}
      <RightToDisconnectNote holidays={holidays} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 rounded-2xl bg-[#0D0D13] border border-white/[0.07] p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-medium text-zinc-400">
                {simGrades.length > 0 ? 'Moyenne simulée' : 'Moyenne générale'}
              </span>
              <div className="flex items-baseline gap-2 mt-1 tabular-nums">
                <span
                  className={`text-4xl font-extrabold tracking-tight ${
                    computed.simulatedOverall !== undefined
                      ? getGradeColorClass(computed.simulatedOverall)
                      : 'text-white'
                  }`}
                >
                  {formatGradeNumber(computed.simulatedOverall)}
                </span>
                <span className="text-base text-zinc-500 font-medium">/20</span>
                {overallDelta !== null && (
                  <span
                    className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      overallDelta >= 0
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-rose-500/15 text-rose-300'
                    }`}
                  >
                    {overallDelta >= 0 ? '+' : ''}
                    {overallDelta.toFixed(2).replace('.', ',')}
                  </span>
                )}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent">
              <Award className="w-5 h-5" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-white/[0.06]">
            <div>
              <div className="text-[11px] text-zinc-500">Moyenne de classe</div>
              <div className="text-base font-bold text-zinc-200 tabular-nums mt-0.5">
                {grades?.classAverage !== undefined
                  ? `${formatGradeNumber(grades.classAverage)} /20`
                  : '—'}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-zinc-500">Notes enregistrées</div>
              <div className="text-base font-bold text-zinc-200 tabular-nums mt-0.5">
                {grades?.grades.length ?? 0}
              </div>
            </div>
          </div>
        </div>

        {/* SVG Sparkline Card */}
        <div className="lg:col-span-7 rounded-2xl bg-[#0D0D13] border border-white/[0.07] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
              <TrendingUp className="w-4 h-4 text-accent" />
              <span>Évolution des notes (ramenées sur 20)</span>
            </div>
            <span className="text-[11px] text-zinc-500">{grades?.periodName}</span>
          </div>

          {chartPoints ? (
            <svg
              viewBox={`0 0 ${chartPoints.w} ${chartPoints.h}`}
              className="w-full h-[112px] overflow-visible"
            >
              <defs>
                <linearGradient id="gradeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(var(--accent-rgb))" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="rgb(var(--accent-rgb))" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* 10/20 reference line */}
              <line
                x1="12"
                y1={chartPoints.h / 2}
                x2={chartPoints.w - 12}
                y2={chartPoints.h / 2}
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="4 4"
              />
              <path d={chartPoints.areaPath} fill="url(#gradeAreaGrad)" />
              <polyline
                fill="none"
                stroke="rgb(var(--accent-rgb))"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={chartPoints.polyline}
              />
              {chartPoints.pts.map((p, idx) => (
                <circle
                  key={idx}
                  cx={p.x}
                  cy={p.y}
                  r="3.2"
                  fill="#0D0D13"
                  stroke="rgb(var(--accent-rgb))"
                  strokeWidth="2"
                >
                  <title>{p.label}</title>
                </circle>
              ))}
            </svg>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-zinc-500 py-8">
              Au moins 2 notes sont nécessaires pour afficher la courbe d'évolution.
            </div>
          )}
        </div>
      </div>

      {/* Simulator Drawer */}
      {simOpen && (
        <div className="rounded-2xl bg-[#10101A] border border-accent/25 p-5 space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold text-white">Simulateur de moyenne</h2>
              <span className="text-xs text-zinc-400">
                (n'affecte pas vos vraies notes PRONOTE)
              </span>
            </div>
            {simGrades.length > 0 && (
              <button
                onClick={() => setSimGrades([])}
                className="text-xs text-rose-400 hover:text-rose-300"
              >
                Tout réinitialiser
              </button>
            )}
          </div>

          <form onSubmit={addSimulatedGrade} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <select
              value={simSubjectId || computed.enrichedSubjects[0]?.subjectId || ''}
              onChange={(e) => setSimSubjectId(e.target.value)}
              className="sm:col-span-5 px-3 py-2 rounded-xl bg-[#09090E] border border-white/[0.08] text-xs text-white focus:border-accent/60 focus:outline-none"
            >
              {computed.enrichedSubjects.map((s) => (
                <option key={s.subjectId} value={s.subjectId}>
                  {s.subject}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={simValue}
              onChange={(e) => setSimValue(e.target.value)}
              placeholder="Note (ex: 16)"
              className="sm:col-span-2 px-3 py-2 rounded-xl bg-[#09090E] border border-white/[0.08] text-xs text-white text-center tabular-nums focus:border-accent/60 focus:outline-none"
            />
            <input
              type="text"
              value={simOutOf}
              onChange={(e) => setSimOutOf(e.target.value)}
              placeholder="Sur (20)"
              className="sm:col-span-2 px-3 py-2 rounded-xl bg-[#09090E] border border-white/[0.08] text-xs text-white text-center tabular-nums focus:border-accent/60 focus:outline-none"
            />
            <input
              type="text"
              value={simCoeff}
              onChange={(e) => setSimCoeff(e.target.value)}
              placeholder="Coeff (1)"
              className="sm:col-span-1 px-2 py-2 rounded-xl bg-[#09090E] border border-white/[0.08] text-xs text-white text-center tabular-nums focus:border-accent/60 focus:outline-none"
            />
            <button
              type="submit"
              className="sm:col-span-2 px-3 py-2 rounded-xl bg-accent text-black font-semibold text-xs flex items-center justify-center gap-1 hover:opacity-90"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter
            </button>
          </form>

          {simGrades.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {simGrades.map((sg) => (
                <span
                  key={sg.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-accent/15 border border-accent/25 text-xs text-zinc-100"
                >
                  <span className="font-medium">{sg.subject}</span>
                  <span className="font-bold text-accent tabular-nums">
                    {sg.value}/{sg.outOf}
                  </span>
                  <span className="text-zinc-400 text-[11px]">(coeff {sg.coefficient})</span>
                  <button
                    onClick={() => setSimGrades((prev) => prev.filter((x) => x.id !== sg.id))}
                    className="text-zinc-400 hover:text-rose-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* View Switcher */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-3">
        <button
          onClick={() => setViewTab('subjects')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            viewTab === 'subjects'
              ? 'bg-white/[0.1] text-white'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Par matière ({computed.enrichedSubjects.length})
        </button>
        <button
          onClick={() => setViewTab('chronological')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            viewTab === 'chronological'
              ? 'bg-white/[0.1] text-white'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Toutes les notes ({grades?.grades.length ?? 0})
        </button>
      </div>

      {/* Subject Breakdown */}
      {viewTab === 'subjects' ? (
        computed.enrichedSubjects.length === 0 ? (
          <div className="rounded-2xl bg-[#0D0D12] border border-white/[0.06] py-14 text-center text-sm text-zinc-500">
            Aucune note enregistrée pour cette période.
          </div>
        ) : (
          <div className="space-y-2.5">
            {computed.enrichedSubjects.map((sa) => {
              const expanded = expandedSubjects[sa.subjectId] ?? true;
              const color = normalizeHexColor(sa.backgroundColor);
              const displayAvg = sa.simulatedAverage;
              const pct =
                displayAvg !== undefined && sa.outOf > 0
                  ? Math.max(0, Math.min(100, (displayAvg / sa.outOf) * 100))
                  : 0;
              const classPct =
                sa.classAverage !== undefined && sa.outOf > 0
                  ? Math.max(0, Math.min(100, (sa.classAverage / sa.outOf) * 100))
                  : null;

              return (
                <div
                  key={sa.subjectId}
                  className="rounded-2xl bg-[#0D0D13] border border-white/[0.06] overflow-hidden"
                >
                  <button
                    onClick={() => toggleSubject(sa.subjectId)}
                    className="w-full px-5 py-3.5 hover:bg-white/[0.025] flex items-center justify-between gap-4 text-left transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold text-white truncate">
                          {sa.subject}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 max-w-xs">
                          <div className="relative flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-visible">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: color }}
                            />
                            {classPct !== null && (
                              <div
                                title={`Moyenne classe : ${formatGradeNumber(sa.classAverage)}`}
                                className="absolute -top-0.5 w-0.5 h-2.5 bg-white/70 rounded-full"
                                style={{ left: `${classPct}%` }}
                              />
                            )}
                          </div>
                          <span className="text-[11px] text-zinc-500 tabular-nums shrink-0">
                            Classe {formatGradeNumber(sa.classAverage)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right tabular-nums">
                        <div
                          className={`text-lg font-bold ${
                            displayAvg !== undefined
                              ? getGradeColorClass((displayAvg / (sa.outOf || 20)) * 20)
                              : 'text-zinc-400'
                          }`}
                        >
                          {formatGradeNumber(displayAvg)}
                          <span className="text-xs font-normal text-zinc-500">/{sa.outOf}</span>
                        </div>
                        {sa.min !== undefined && sa.max !== undefined && (
                          <div className="text-[10.5px] text-zinc-500">
                            Min {formatGradeNumber(sa.min)} · Max {formatGradeNumber(sa.max)}
                          </div>
                        )}
                      </div>
                      {expanded ? (
                        <ChevronUp className="w-4 h-4 text-zinc-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-500" />
                      )}
                    </div>
                  </button>

                  {expanded && (sa.grades.length > 0 || sa.simulated.length > 0) && (
                    <div className="border-t border-white/[0.05] divide-y divide-white/[0.04] bg-[#0A0A0F]">
                      {sa.simulated.map((sg) => (
                        <div
                          key={sg.id}
                          className="px-5 py-2.5 flex items-center justify-between gap-4 bg-accent/[0.05]"
                        >
                          <div className="flex items-center gap-2 text-xs text-accent">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Note simulée · Coeff {sg.coefficient}</span>
                          </div>
                          <div className="font-bold text-sm text-accent tabular-nums">
                            {sg.value}
                            <span className="text-xs font-normal text-zinc-400">/{sg.outOf}</span>
                          </div>
                        </div>
                      ))}

                      {sa.grades.map((g) => {
                        const norm20 = g.outOf > 0 ? (g.value.points / g.outOf) * 20 : 0;
                        return (
                          <div
                            key={g.id}
                            className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-white/[0.02]"
                          >
                            <div className="min-w-0">
                              <div className="text-[13px] font-medium text-zinc-200 truncate">
                                {g.comment || 'Évaluation'}
                              </div>
                              {g.commentaireSurNote && (
                                <div className="text-[11.5px] text-zinc-300 italic mt-0.5">
                                  « {g.commentaireSurNote} »
                                </div>
                              )}
                              <div className="flex flex-wrap items-center gap-2.5 mt-0.5 text-[11.5px] text-zinc-500">
                                <span>{formatDateShort(g.date)}</span>
                                <span>Coeff {g.coefficient}</span>
                                {g.average !== undefined && (
                                  <span>Classe {formatGradeNumber(g.average)}</span>
                                )}
                                {g.min !== undefined && g.max !== undefined && (
                                  <span>
                                    Min {formatGradeNumber(g.min)} · Max {formatGradeNumber(g.max)}
                                  </span>
                                )}
                                {g.isBonus && (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 text-[10px]">
                                    Bonus
                                  </span>
                                )}
                                {g.isOptional && (
                                  <span className="px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-300 text-[10px]">
                                    Facultatif
                                  </span>
                                )}
                                {g.subjectFile && (
                                  <button
                                    onClick={() =>
                                      window.pronoteAPI.system.openExternal(g.subjectFile!.url)
                                    }
                                    className="text-accent hover:underline inline-flex items-center gap-1"
                                  >
                                    <Paperclip className="w-3 h-3" /> Sujet
                                  </button>
                                )}
                                {g.correctionFile && (
                                  <button
                                    onClick={() =>
                                      window.pronoteAPI.system.openExternal(g.correctionFile!.url)
                                    }
                                    className="text-emerald-400 hover:underline inline-flex items-center gap-1"
                                  >
                                    <Paperclip className="w-3 h-3" /> Corrigé
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0 tabular-nums">
                              <span
                                className={`text-[15px] font-bold ${
                                  g.value.kind === 0
                                    ? getGradeColorClass(norm20)
                                    : 'text-zinc-400'
                                }`}
                              >
                                {g.value.label}
                              </span>
                              {g.value.kind === 0 && (
                                <span className="text-xs text-zinc-500">/{g.outOf}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="rounded-2xl bg-[#0D0D13] border border-white/[0.06] divide-y divide-white/[0.05] overflow-hidden">
          {(grades?.grades ?? []).length === 0 ? (
            <div className="py-14 text-center text-sm text-zinc-500">Aucune note disponible.</div>
          ) : (
            (grades?.grades ?? []).map((g) => {
              const norm20 = g.outOf > 0 ? (g.value.points / g.outOf) * 20 : 0;
              return (
                <div
                  key={g.id}
                  className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.02]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-semibold text-white truncate">
                        {g.subject}
                      </span>
                      <span className="text-[11px] text-zinc-500">{formatDateShort(g.date)}</span>
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5 truncate">
                      {g.comment || 'Évaluation'} · Coeff {g.coefficient}
                      {g.average !== undefined ? ` · Classe ${formatGradeNumber(g.average)}` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    <span
                      className={`text-base font-bold ${
                        g.value.kind === 0 ? getGradeColorClass(norm20) : 'text-zinc-400'
                      }`}
                    >
                      {g.value.label}
                    </span>
                    {g.value.kind === 0 && (
                      <span className="text-xs text-zinc-500">/{g.outOf}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
