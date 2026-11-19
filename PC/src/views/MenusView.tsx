import React, { useMemo, useState } from 'react';
import {
  UtensilsCrossed,
  Loader2,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import type { MealDTO, MenuDayDTO } from '@shared/types';
import { formatDateFull, isSameDay } from '@/utils/format';

interface MenusViewProps {
  menus: MenuDayDTO[];
  selectedDate: Date;
  loading: boolean;
  onChangeDate: (date: Date) => void;
}

type MealFilter = 'both' | 'lunch' | 'dinner';

const MealCard: React.FC<{
  kind: 'lunch' | 'dinner';
  meal?: MealDTO;
}> = ({ kind, meal }) => {
  const isLunch = kind === 'lunch';

  const courses = meal
    ? [
        { label: 'Entrée', items: meal.entry },
        { label: 'Plat principal', items: meal.main },
        { label: 'Accompagnement', items: meal.side },
        { label: 'Fromage', items: meal.fromage },
        { label: 'Dessert', items: meal.dessert },
        { label: 'Boisson', items: meal.drink },
      ].filter((c) => c.items.length > 0)
    : [];

  return (
    <div
      className={`rounded-2xl border p-4 flex flex-col gap-3 ${
        isLunch
          ? 'bg-gradient-to-b from-amber-500/[0.06] to-[#111118] border-amber-500/20'
          : 'bg-gradient-to-b from-accent/[0.08] to-[#111118] border-accent/25'
      }`}
    >
      <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              isLunch
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                : 'bg-accent/15 text-accent border border-accent/30'
            }`}
          >
            {isLunch ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </div>
          <div>
            <div className="text-[13.5px] font-bold text-white">
              {isLunch ? 'Midi' : 'Soir · Internat'}
            </div>
            <div className="text-[11px] text-zinc-500">
              {isLunch ? 'Déjeuner (demi-pension / interne)' : 'Dîner (internes)'}
            </div>
          </div>
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="py-6 text-center text-xs text-zinc-500">
          Aucun menu renseigné pour {isLunch ? 'le midi' : 'le soir'}.
        </div>
      ) : (
        <div className="space-y-2.5">
          {courses.map((c) => (
            <div
              key={c.label}
              className="p-3 rounded-xl bg-black/25 border border-white/[0.05] space-y-1.5"
            >
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">
                {c.label}
              </div>
              {c.items.map((food, idx) => (
                <div key={idx} className="text-[13px] text-zinc-100 leading-snug">
                  <span>{food.name}</span>
                  {(food.labels.length > 0 || food.allergens.length > 0) && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {food.labels.map((l, li) => (
                        <span
                          key={`l-${li}`}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                        >
                          {l.name}
                        </span>
                      ))}
                      {food.allergens.map((a, ai) => (
                        <span
                          key={`a-${ai}`}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-500/12 text-rose-300 border border-rose-500/20"
                        >
                          {a.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const MenusView: React.FC<MenusViewProps> = ({
  menus,
  selectedDate,
  loading,
  onChangeDate,
}) => {
  const [filter, setFilter] = useState<MealFilter>('both');
  const now = new Date();

  const hasAnyDinner = useMemo(() => menus.some((d) => Boolean(d.dinner)), [menus]);

  const shiftWeek = (deltaWeeks: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + deltaWeeks * 7);
    onChangeDate(next);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto space-y-6 animate-fade-in">
      {/* Header + Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Menus de la cantine</h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Séparation claire entre le repas du Midi et le repas du Soir (Internat)
            </p>
          </div>
          {loading && <Loader2 className="w-4 h-4 text-accent animate-spin" />}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Midi / Soir Filter */}
          <div className="p-1 rounded-xl bg-[#0D0D12] border border-white/[0.06] flex items-center gap-1 text-xs">
            <button
              onClick={() => setFilter('both')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filter === 'both'
                  ? 'bg-accent text-black font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Midi & Soir
            </button>
            <button
              onClick={() => setFilter('lunch')}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                filter === 'lunch'
                  ? 'bg-amber-400 text-black font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Midi</span>
            </button>
            <button
              onClick={() => setFilter('dinner')}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                filter === 'dinner'
                  ? 'bg-accent text-black font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Soir (Internat)</span>
            </button>
          </div>

          {/* Week Switcher */}
          <div className="flex items-center bg-[#0D0D12] border border-white/[0.06] rounded-xl p-1 gap-1">
            <button
              onClick={() => shiftWeek(-1)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06]"
              title="Semaine précédente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onChangeDate(new Date())}
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-200 hover:bg-white/[0.06] flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-accent" />
              <span>
                Semaine du{' '}
                {selectedDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
            </button>
            <button
              onClick={() => shiftWeek(1)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06]"
              title="Semaine suivante"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {menus.length === 0 ? (
        <div className="rounded-2xl bg-[#0D0D12] border border-white/[0.06] py-16 text-center">
          <UtensilsCrossed className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm font-semibold text-zinc-300">Aucun menu publié cette semaine</p>
          <p className="text-xs text-zinc-500 mt-1">
            Essayez la semaine suivante ou précédente avec les flèches ci-dessus.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {menus.map((day) => {
            const isToday = isSameDay(new Date(day.date), now);
            const showLunch = filter === 'both' || filter === 'lunch';
            const showDinner = (filter === 'both' && hasAnyDinner) || filter === 'dinner';

            return (
              <section
                key={day.date}
                className={`rounded-2xl bg-[#0C0C12] border p-5 space-y-4 ${
                  isToday ? 'border-accent/40 shadow-glow' : 'border-white/[0.06]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-bold text-white">
                      {formatDateFull(day.date)}
                    </h2>
                    {isToday && (
                      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-accent/20 text-accent border border-accent/30">
                        Aujourd'hui
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className={`grid gap-4 ${
                    showLunch && showDinner ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
                  }`}
                >
                  {showLunch && <MealCard kind="lunch" meal={day.lunch} />}
                  {showDinner && <MealCard kind="dinner" meal={day.dinner} />}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
