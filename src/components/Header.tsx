import React, { useState, useEffect } from 'react';
import { LoginUserCard } from './LoginUserCard';
import { StaffUser } from '../types';
import { 
  Building2, 
  LayoutDashboard,
  Search, 
  CalendarDays, 
  BookOpen, 
  Lock,
  QrCode, 
  SlidersHorizontal, 
  ShieldCheck, 
  Menu,
  X,
  User,
  ChevronDown
} from 'lucide-react';

export type ActiveTab = 'dashboard' | 'search' | 'matrix' | 'academic' | 'mybookings' | 'directory' | 'admin';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  pendingCount: number;
  staffList?: StaffUser[];
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, pendingCount, staffList }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setUserMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Standard navigation items (horizontal sequence)
  const mainNavItems = [
    { id: 'dashboard' as ActiveTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'search' as ActiveTab, label: 'Cari & Tempah', icon: Search },
    { id: 'matrix' as ActiveTab, label: 'Calendar', icon: CalendarDays },
    { id: 'academic' as ActiveTab, label: 'Locked', icon: Lock },
    { id: 'mybookings' as ActiveTab, label: 'My Booking', icon: QrCode },
    { id: 'directory' as ActiveTab, label: 'Direktori', icon: SlidersHorizontal },
  ];

  const handleTabClick = (tab: ActiveTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* 1. Left: Brand Logo & Title */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleTabClick('dashboard')}
              className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 active:scale-95 transition-all text-left bg-transparent border-0 p-0"
              title="Kembali ke Dashboard Utama"
            >
              <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-md shadow-blue-900/50">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div className="leading-tight">
                <span className="font-bold text-base tracking-tight">
                  <span className="text-white">Book</span>
                  <span className="text-blue-400">BK</span>
                </span>
                <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 bg-slate-800 text-blue-300 rounded border border-slate-700">
                  KPMBP
                </span>
              </div>
            </button>
          </div>

          {/* 2. Middle: Horizontal Navigation Links (Desktop & Tablet) */}
          <nav className="hidden xl:flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/40'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* For Medium screens (Laptop/Tablet): Compact Horizontal Nav */}
          <nav className="hidden md:flex xl:hidden items-center gap-1 overflow-x-auto no-scrollbar py-1">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  title={item.label}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* 3. Right: Admin Access (Distinct Amber Style) & Profile Card / Mobile Toggle */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            
            {/* Admin Access Button (Paling Hujung Kanan dengan warna khas berbeza) */}
            <button
              onClick={() => handleTabClick('admin')}
              className={`px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer border ${
                activeTab === 'admin'
                  ? 'bg-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-400/50 shadow-md shadow-amber-900/30'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 hover:border-amber-300'
              }`}
              title="Akses Kawalan Pentadbir KPMBP"
            >
              <ShieldCheck className="w-4 h-4 text-slate-950" />
              <span>Admin Access</span>
              {pendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-red-600 text-white font-extrabold rounded-full text-[10px]">
                  {pendingCount}
                </span>
              )}
            </button>

            {/* Profile Dropdown Toggle */}
            <div className="relative hidden sm:block">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1 text-xs"
                title="Tetapan Akaun Staf"
              >
                <User className="w-4 h-4 text-blue-400" />
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Akaun Staf Pengguna</span>
                    <button onClick={() => setUserMenuOpen(false)} className="text-slate-400 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <LoginUserCard staffList={staffList} compact={true} onProfileChange={() => setUserMenuOpen(false)} />
                </div>
              )}
            </div>

            {/* Mobile Nav Hamburger Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
              aria-label="Buka Menu Navigasi"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer / Dropdown Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-900 px-4 py-4 space-y-3 animate-in slide-in-from-top duration-200">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-2">
            Menu Navigasi
          </div>
          <div className="grid grid-cols-1 gap-1">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`w-full px-3 py-2.5 rounded-lg flex items-center justify-between text-left transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-slate-300 hover:bg-slate-800 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span className="text-xs">{item.label}</span>
                  </div>
                </button>
              );
            })}

            {/* Admin in mobile menu */}
            <button
              onClick={() => handleTabClick('admin')}
              className={`w-full px-3 py-2.5 rounded-lg flex items-center justify-between text-left transition-all mt-2 border ${
                activeTab === 'admin'
                  ? 'bg-amber-400 text-slate-950 font-bold border-amber-300'
                  : 'bg-amber-500 text-slate-950 font-bold border-amber-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs">Admin Access</span>
              </div>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 bg-red-600 text-white font-extrabold rounded-full text-[10px]">
                  {pendingCount} Menunggu
                </span>
              )}
            </button>
          </div>

          <div className="pt-3 border-t border-slate-800">
            <LoginUserCard staffList={staffList} compact={true} onProfileChange={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}
    </header>
  );
};

