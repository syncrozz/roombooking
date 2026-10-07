import React from 'react';
import { ActiveTab } from './Header';
import { 
  LayoutDashboard,
  CalendarDays, 
  Lock, 
  QrCode, 
  SlidersHorizontal, 
  ShieldCheck, 
  ArrowRight 
} from 'lucide-react';

interface QuickNavGridProps {
  activeTab: ActiveTab;
  onNavigateTab: (tab: ActiveTab) => void;
  pendingCount?: number;
}

export const QuickNavGrid: React.FC<QuickNavGridProps> = ({
  activeTab,
  onNavigateTab,
  pendingCount = 0
}) => {
  const navItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      color: 'text-slate-800 bg-slate-100 hover:bg-slate-200/90 border-slate-300',
      activeRing: 'ring-2 ring-slate-800 border-slate-400 bg-slate-200/80 shadow-xs',
    },
    {
      id: 'matrix' as ActiveTab,
      label: 'Calendar',
      icon: CalendarDays,
      color: 'text-blue-700 bg-blue-50 hover:bg-blue-100/80 border-blue-200/90',
      activeRing: 'ring-2 ring-blue-600 border-blue-400 bg-blue-100/90 shadow-xs',
    },
    {
      id: 'academic' as ActiveTab,
      label: 'Locked',
      icon: Lock,
      color: 'text-amber-700 bg-amber-50 hover:bg-amber-100/80 border-amber-200/90',
      activeRing: 'ring-2 ring-amber-600 border-amber-400 bg-amber-100/90 shadow-xs',
    },
    {
      id: 'mybookings' as ActiveTab,
      label: 'My Booking',
      icon: QrCode,
      color: 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 border-indigo-200/90',
      activeRing: 'ring-2 ring-indigo-600 border-indigo-400 bg-indigo-100/90 shadow-xs',
    },
    {
      id: 'directory' as ActiveTab,
      label: 'Direktori',
      icon: SlidersHorizontal,
      color: 'text-purple-700 bg-purple-50 hover:bg-purple-100/80 border-purple-200/90',
      activeRing: 'ring-2 ring-purple-600 border-purple-400 bg-purple-100/90 shadow-xs',
    },
    {
      id: 'admin' as ActiveTab,
      label: 'Admin Access',
      icon: ShieldCheck,
      color: 'text-rose-700 bg-rose-50 hover:bg-rose-100/80 border-rose-200/90',
      activeRing: 'ring-2 ring-rose-600 border-rose-400 bg-rose-100/90 shadow-xs',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        const isAdminItem = item.id === 'admin';

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigateTab(item.id)}
            className={`p-2.5 sm:p-3 rounded-xl border transition-all text-left flex items-center justify-between cursor-pointer hover:shadow-xs hover:-translate-y-0.5 group relative ${item.color} ${
              isActive ? item.activeRing : ''
            }`}
            title={`Buka paparan ${item.label}`}
          >
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className={`w-7 h-7 rounded-lg shadow-2xs flex items-center justify-center shrink-0 transition ${
                isActive ? 'bg-white shadow-xs scale-105' : 'bg-white/80'
              }`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className={`text-xs block truncate ${isActive ? 'font-black' : 'font-bold'}`}>
                  {item.label}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0 ml-1">
              {isAdminItem && pendingCount > 0 && (
                <span className="px-1.5 py-0.2 bg-red-600 text-white font-extrabold rounded-full text-[10px] leading-tight animate-pulse">
                  {pendingCount}
                </span>
              )}
              <ArrowRight className={`w-3.5 h-3.5 transition-all ${
                isActive ? 'opacity-100 translate-x-0.5' : 'opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5'
              }`} />
            </div>
          </button>
        );
      })}
    </div>
  );
};
