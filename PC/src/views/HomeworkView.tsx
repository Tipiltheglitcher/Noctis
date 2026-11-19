import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Paperclip,
  ExternalLink,
  Clock,
  BookOpen,
  Search,
  Loader2,
} from 'lucide-react';
import type { HomeworkDTO } from '@shared/types';
import {
  formatDateRelative,
  formatDurationMinutes,
  normalizeHexColor,
  sanitizeHtml,
  toDateKey,
} from '@/utils/format';

interface HomeworkViewProps {
  homework: HomeworkDTO[];
  loading: boolean;
  onToggleDone: (id: string, done: boolean) => void;
}

type StatusFilter = 'todo' | 'done' | 'all';

const DIFFICULTY_LABELS: Record<number, { label: string; cls: string }> = {
  1: { label: 'Facile', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20' },
  2: { label: 'Moyen', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/20' },
  3: { label: 'Difficile', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/20' },
};

const RETURN_KIND_LABELS: Record<number, string> = {
  1: 'Rendu papier',
  2: 'À rendre sur PRONOTE',
  3: 'Kiosque',
  4: 'Enregistrement audio',
};

export const HomeworkView: React.FC<HomeworkViewProps> = ({
  homework,
  loading,
  onToggleDone,
}) => {
  const [filter, setFilter] = useState<StatusFilter>('todo');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const subjects = useMemo(() => {
    const set = new Set(homework.map((h) => h.subject));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [homework]);

  const counts = useMemo(() => {
    const todo = homework.filter((h) => !h.done).length;
    return { todo, done: homework.length - todo, all: homework.length };
  }, [homework]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = homework.filter((h) => {
      if (filter === 'todo' && h.done) return false;
      if (filter === 'done' && !h.done) return false;
      if (subjectFilter !== 'ALL' && h.subject !== subjectFilter) return false;
      if (
        q &&
        !h.subject.toLowerCase().includes(q) &&
        !h.description.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    const map = new Map<string, { deadlineISO: string; items: HomeworkDTO[] }>();
    for (const item of filtered) {
      const key = toDateKey(item.deadline);
      if (!map.has(key)) {
        map.set(key, { deadlineISO: item.deadline, items: [] });
      }
      map.get(key)!.items.push(item);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, val]) => val);
  }, [homework, filter, subjectFilter, search]);

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Cahier de textes</h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Vos devoirs des prochaines semaines, synchronisés avec PRONOTE
            </p>
          </div>
          {loading && <Loader2 className="w-4 h-4 text-accent animate-spin" />}
        </div>

        {/* Status Filter Pills */}
        <div className="p-1 rounded-xl bg-[#0D0D12] border border-white/[0.06] flex items-center gap-1 text-xs">
          {(
            [
              { id: 'todo', label: 'À faire', count: counts.todo },
              { id: 'done', label: 'Terminés', count: counts.done },
              { id: 'all', label: 'Tous', count: counts.all },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                filter === f.id
                  ? 'bg-accent text-black font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span>{f.label}</span>
              <span
                className={`text-[10.5px] px-1.5 py-0.2 rounded-full tabular-nums ${
                  filter === f.id ? 'bg-black/20 text-black' : 'bg-white/[0.07] text-zinc-300'
                }`}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Search & Subject Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un devoir ou une matière…"
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#0E0E14] border border-white/[0.07] focus:border-accent/50 focus:outline-none text-sm text-white placeholder:text-zinc-500"
          />
        </div>

        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="px-3.5 py-2 rounded-xl bg-[#0E0E14] border border-white/[0.07] focus:border-accent/50 focus:outline-none text-sm text-zinc-200"
        >
          <option value="ALL">Toutes les matières</option>
          {subjects.map((sub) => (
            <option key={sub} value={sub}>
              {sub}
            </option>
          ))}
        </select>
      </div>

      {/* Grouped Homework List */}
      {grouped.length === 0 ? (
        <div className="rounded-2xl bg-[#0D0D12] border border-white/[0.06] py-16 text-center">
          <BookOpen className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm font-semibold text-zinc-300">
            {filter === 'todo'
              ? 'Aucun devoir restant !'
              : 'Aucun devoir ne correspond à vos filtres.'}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {filter === 'todo' ? 'Beau travail, tout est coché.' : 'Essayez un autre filtre.'}
          </p>
        </div>
      ) : (
        <div className="space-y-7">
          {grouped.map((group) => (
            <div key={group.deadlineISO} className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-accent">
                  Pour {formatDateRelative(group.deadlineISO)}
                </span>
                <div className="h-px flex-1 bg-white/[0.06]" />
                <span className="text-[11px] text-zinc-500 tabular-nums">
                  {group.items.length} devoir{group.items.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-2.5">
                {group.items.map((hw) => {
                  const color = normalizeHexColor(hw.backgroundColor);
                  const diff = DIFFICULTY_LABELS[hw.difficulty];
                  return (
                    <article
                      key={hw.id}
                      className={`rounded-2xl border p-4 transition-all ${
                        hw.done
                          ? 'bg-[#0B0B0F] border-white/[0.04] opacity-65'
                          : 'bg-[#101017] border-white/[0.07] hover:border-white/[0.13]'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <button
                          onClick={() => onToggleDone(hw.id, !hw.done)}
                          className="mt-0.5 text-zinc-500 hover:text-accent transition-colors shrink-0"
                          title={hw.done ? 'Marquer comme non fait' : 'Marquer comme fait'}
                        >
                          {hw.done ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <Circle className="w-5 h-5" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: color }}
                              />
                              <h3
                                className={`text-[14.5px] font-semibold ${
                                  hw.done ? 'line-through text-zinc-400' : 'text-white'
                                }`}
                              >
                                {hw.subject}
                              </h3>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              {RETURN_KIND_LABELS[hw.returnKind] && (
                                <span className="px-2 py-0.5 rounded-md bg-accent/15 text-accent border border-accent/25 text-[10.5px] font-semibold">
                                  {RETURN_KIND_LABELS[hw.returnKind]}
                                </span>
                              )}
                              {hw.themes.map((t, ti) => (
                                <span
                                  key={ti}
                                  className="px-2 py-0.5 rounded-md bg-white/[0.05] text-zinc-300 text-[10.5px]"
                                >
                                  {t}
                                </span>
                              ))}
                              {hw.lengthMinutes && hw.lengthMinutes > 0 && (
                                <span className="px-2 py-0.5 rounded-md bg-white/[0.05] text-[11px] text-zinc-400 inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDurationMinutes(hw.lengthMinutes)}
                                </span>
                              )}
                              {diff && (
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${diff.cls}`}
                                >
                                  {diff.label}
                                </span>
                              )}
                            </div>
                          </div>

                          <div
                            className="pronote-html"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(hw.description) }}
                          />

                          {hw.attachments.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-white/[0.05] flex flex-wrap gap-2">
                              {hw.attachments.map((att) => (
                                <button
                                  key={att.id}
                                  onClick={() => window.pronoteAPI.system.openExternal(att.url)}
                                  className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.07] text-xs text-zinc-200 inline-flex items-center gap-1.5 transition-colors"
                                >
                                  {att.kind === 'link' ? (
                                    <ExternalLink className="w-3.5 h-3.5 text-accent" />
                                  ) : (
                                    <Paperclip className="w-3.5 h-3.5 text-accent" />
                                  )}
                                  <span className="max-w-[260px] truncate">{att.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
