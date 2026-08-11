import React, { useState } from 'react';
import { LoginUserCard } from './LoginUserCard';
import { 
  Building2, 
  Search, 
  CalendarDays, 
  BookOpen, 
  QrCode, 
  SlidersHorizontal, 
  ShieldCheck, 
  Layers,
  Menu,
  X,
  Bell,
  CheckCircle2,
  User
} from 'lucide-react';

export type ActiveTab = 'search' | 'matrix' | 'academic' | 'mybookings' | 'directory' | 'admin';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  pendingCount: number;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, pendingCount }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'search' as ActiveTab, label: 'Cari & Tempah', sub: 'Dashboard', icon: Search },
    { id: 'matrix' as ActiveTab, label: 'Matriks Ketersediaan', sub: 'Calendar View', icon: CalendarDays },
    { id: 'academic' as ActiveTab, label: 'Jadual Akademik', sub: 'Integrated Timetable', icon: BookOpen },
    { id: 'mybookings' as ActiveTab, label: 'Tempahan Saya', sub: 'Pas QR Akses', icon: QrCode },
    { id: 'directory' as ActiveTab, label: 'Direktori Ruang', sub: '33 Managed Spaces', icon: SlidersHorizontal },
    { id: 'admin' as ActiveTab, label: 'Block Manager', sub: 'Pentadbir Ruang', icon: ShieldCheck, badge: pendingCount },
  ];

  const handleTabClick = (tab: ActiveTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Sidebar for Desktop */}
      <aside className="hidden lg:flex w-64 bg-slate-900 flex-col text-slate-300 border-r border-slate-800 shrink-0 h-screen sticky top-0">
        {/* Brand Header */}
        <div className="p-5 flex items-center gap-3 border-b border-slate-800 cursor-pointer" onClick={() => handleTabClick('search')}>
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-md shadow-blue-900/50">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div className="leading-tight">
            <h1 className="font-bold text-base tracking-tight flex items-center gap-1.5">
              <span className="text-white">ROOM</span> <span className="text-blue-400">BOOKING</span>
            </h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mt-0.5">
              KPMBP v2.5
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 flex flex-col gap-1 overflow-y-auto">
          <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Menu Utama
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`w-full px-3.5 py-2.5 rounded-lg flex items-center justify-between text-left transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-900/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80 font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <div className="leading-tight">
                    <div className="text-xs font-semibold">{item.label}</div>
                    <div className={`text-[10px] ${isActive ? 'text-blue-100 opacity-90' : 'text-slate-500'}`}>
                      {item.sub}
                    </div>
                  </div>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-extrabold rounded-full text-[10px]">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="mt-6 pt-4 border-t border-slate-800">
            <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Info Institusi
            </div>
            <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-800 text-xs space-y-1 text-slate-400">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                KPM Bandar Penawar
              </div>
              <div className="text-[11px]">Semester 2 2026/2027</div>
              <div className="text-[10px] text-blue-400 font-medium">33 Ruang Aktif Diselia</div>
            </div>
          </div>
        </nav>

        {/* Log Masuk / User Profile Footer */}
        <div className="p-3 border-t border-slate-800">
          <LoginUserCard />
        </div>
      </aside>

      {/* Top Header Bar for Mobile Nav Toggle */}
      <header className="lg:hidden bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2" onClick={() => handleTabClick('search')}>
          <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center font-bold text-white">
            <Building2 className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm tracking-tight"><span className="text-white">ROOM</span> <span className="text-blue-400">BOOKING</span></span>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex flex-col">
          <div className="bg-slate-900 w-full max-w-xs h-full p-5 flex flex-col justify-between border-r border-slate-800 animate-in slide-in-from-left duration-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-bold text-sm"><span className="text-white">ROOM</span> <span className="text-blue-400">BOOKING</span></h2>
                    <p className="text-[10px] text-slate-400">KPMBP SmartHub</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-slate-400 p-1 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="mt-4 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTabClick(item.id)}
                      className={`w-full px-3 py-2.5 rounded-md flex items-center justify-between text-left transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'text-slate-300 hover:bg-slate-800 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4" />
                        <span className="text-xs">{item.label}</span>
                      </div>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="px-2 py-0.5 bg-amber-400 text-slate-950 font-bold rounded-full text-xs">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <LoginUserCard />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

