import React from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  BookCheck,
  Award,
  Clock3,
  MessageSquareText,
  UtensilsCrossed,
  Settings,
  LogOut,
} from 'lucide-react';
import type { NavTab, StudentProfile } from '@shared/types';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  profile: StudentProfile;
  undoneHomeworkCount: number;
  unreadMessagesCount: number;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  profile,
  undoneHomeworkCount,
  unreadMessagesCount,
  onLogout,
}) => {
  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    visible: boolean;
  }> = [
    {
      id: 'dashboard',
      label: 'Accueil',
      icon: LayoutDashboard,
      visible: true,
    },
    {
      id: 'timetable',
      label: 'Emploi du temps',
      icon: CalendarDays,
      visible: profile.availableTabs.timetable,
    },
    {
      id: 'homework',
      label: 'Devoirs',
      icon: BookCheck,
      badge: undoneHomeworkCount,
      visible: profile.availableTabs.homework,
    },
    {
      id: 'grades',
      label: 'Notes & Moyennes',
      icon: Award,
      visible: profile.availableTabs.grades,
    },
    {
      id: 'attendance',
      label: 'Vie scolaire',
      icon: Clock3,
      visible: profile.availableTabs.attendance,
    },
    {
      id: 'messages',
      label: 'Infos & Messages',
      icon: MessageSquareText,
      badge: unreadMessagesCount,
      visible: profile.availableTabs.news || profile.availableTabs.discussions,
    },
    {
      id: 'menus',
      label: 'Cantine',
      icon: UtensilsCrossed,
      visible: profile.availableTabs.menus,
    },
  ];

  const initials = profile.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <aside className="w-[238px] shrink-0 bg-[#09090D] border-r border-white/[0.06] flex flex-col justify-between p-3 select-none">
      {/* Navigation */}
      <div className="space-y-1">
        <div className="px-2.5 pt-1 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
          Navigation
        </div>
        {navItems
          .filter((item) => item.visible)
          .map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`group relative w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-150 ${
                  active
                    ? 'bg-accent/15 text-white border border-accent/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-accent shadow-glow" />
                )}
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-[17px] h-[17px] shrink-0 transition-colors ${
                      active ? 'text-accent' : 'text-zinc-500 group-hover:text-zinc-300'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-full tabular-nums ${
                      active
                        ? 'bg-accent text-black'
                        : 'bg-white/[0.08] text-zinc-200 group-hover:bg-white/[0.14]'
                    }`}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>
            );
          })}
      </div>

      {/* Bottom: Settings + Profile Card */}
      <div className="space-y-2 pt-3 border-t border-white/[0.06]">
        <button
          onClick={() => onSelectTab('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
            activeTab === 'settings'
              ? 'bg-accent/15 text-white border border-accent/25'
              : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04] border border-transparent'
          }`}
        >
          <Settings
            className={`w-4 h-4 ${activeTab === 'settings' ? 'text-accent' : 'text-zinc-500'}`}
          />
          <span>Paramètres</span>
        </button>

        <div className="p-2.5 rounded-xl bg-[#101016] border border-white/[0.06] flex items-center gap-2.5">
          {profile.profilePicture ? (
            <img
              src={profile.profilePicture}
              alt={profile.name}
              className="w-9 h-9 rounded-full object-cover border border-white/10 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent/40 to-accent/10 border border-accent/30 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {initials || 'EL'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-semibold text-white truncate">{profile.name}</div>
            <div className="text-[11px] text-zinc-500 truncate">{profile.className}</div>
          </div>
          <button
            onClick={onLogout}
            title="Se déconnecter"
            className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
