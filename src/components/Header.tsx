import React, { useState, useEffect } from 'react';
import { LoginUserCard } from './LoginUserCard';
import { CloudSyncModal } from './CloudSyncModal';
import { StaffUser } from '../types';
import { getStoredActiveUser, clearActiveUser, subscribeToActiveUser } from '../utils/storage';
import { 
  LayoutDashboard,
  CalendarDays, 
  BookOpen, 
  Lock,
  QrCode, 
  SlidersHorizontal, 
  ShieldCheck, 
  Menu,
  X,
  User,
  ChevronDown,
  Cloud,
  LogOut
} from 'lucide-react';

export type ActiveTab = 'dashboard' | 'matrix' | 'academic' | 'mybookings' | 'directory' | 'admin';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  pendingCount: number;
  staffList?: StaffUser[];
  isAdmin?: boolean;
  onLogoutAdmin?: () => void;
  onRequirePinChange?: (staff: StaffUser) => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  activeTab, 
  setActiveTab, 
  pendingCount, 
  staffList, 
  isAdmin = false,
  onLogoutAdmin,
  onRequirePinChange
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showCloudSyncModal, setShowCloudSyncModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => getStoredActiveUser());

  useEffect(() => {
    const handleSync = () => {
      setCurrentUser(getStoredActiveUser());
    };
    handleSync();
    const unsubscribe = subscribeToActiveUser((user) => {
      setCurrentUser(user);
    });
    return () => {
      unsubscribe();
    };
  }, [userMenuOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setUserMenuOpen(false);
        setShowCloudSyncModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Standard navigation items (horizontal sequence)
  const mainNavItems = [
    { id: 'dashboard' as ActiveTab, label: 'Dashboard', icon: LayoutDashboard },
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
              onClick={() => handleTabClick('matrix')}
              className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 active:scale-95 transition-all text-left bg-transparent border-0 p-0"
              title="Papar Kalendar Ketersediaan Ruang (Calendar)"
            >
              <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center bg-slate-800 border border-slate-700/80 shadow-md shadow-blue-900/30 shrink-0">
                <img
                  src="https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/logo/BookBK/icon-192x192.png"
                  alt="Logo BookBK KPMBP"
                  className="w-full h-full object-contain p-0.5"
                />
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
            
            {/* Cloud Sync Live Status Indicator (Disembunyikan dari paparan atas permintaan pengguna, fungsi kekal aktif di latar belakang) */}
            <button
              onClick={() => setShowCloudSyncModal(true)}
              className="hidden items-center gap-1.5 px-2.5 py-1.5 sm:py-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition cursor-pointer shadow-xs"
              title="Status Firebase Cloud Sync (Penyegerakan Real-time Pelbagai Peranti)"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Cloud className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Cloud Sync</span>
            </button>

            {/* Butang Admin Access telah dipadamkan daripada bar pengepala utama mengikut permintaan, fungsi kawalan pentadbir kekal aktif sepenuhnya */}

            {/* Quick Logout Button when staff is active */}
            {currentUser && (
              <button
                id="btn-header-quick-logout"
                onClick={() => {
                  clearActiveUser();
                  setCurrentUser(null);
                  setUserMenuOpen(false);
                }}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-md shadow-orange-950/40 transition cursor-pointer"
                title={`Log keluar daripada ${currentUser.applicantName} (kembali ke default view)`}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Keluar</span>
              </button>
            )}

            {/* Profile Dropdown Toggle */}
            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={`group px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-all duration-150 cursor-pointer shadow-md ${
                  currentUser
                    ? 'bg-gradient-to-r from-blue-900/80 via-indigo-900/70 to-slate-900 border-blue-500/50 hover:border-blue-400 text-white shadow-blue-950/40 ring-1 ring-blue-500/30 hover:ring-blue-400/60'
                    : 'bg-gradient-to-r from-slate-800 via-slate-800 to-blue-950/80 hover:from-slate-700 hover:to-blue-900 text-slate-100 border-blue-500/40 hover:border-blue-400 shadow-slate-950/40 ring-1 ring-blue-500/20 hover:ring-blue-400/50'
                } ${userMenuOpen ? 'ring-2 ring-blue-400 border-blue-400' : ''}`}
                title={currentUser ? `Akaun Staf: ${currentUser.applicantName}` : "Tetapan & Log Masuk Akaun Staf"}
              >
                <div className="relative flex items-center justify-center">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors ${
                    currentUser 
                      ? 'bg-blue-600 text-white border-blue-400 shadow-xs' 
                      : 'bg-blue-500/20 text-blue-300 border-blue-400/40 group-hover:bg-blue-500/30'
                  }`}>
                    <User className="w-3.5 h-3.5" />
                  </div>
                  {currentUser && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
                  )}
                </div>

                <div className="flex flex-col text-left leading-tight">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300/90">
                    {currentUser ? 'Staf Aktif' : 'Akaun Staf'}
                  </span>
                  <span className="text-xs font-extrabold text-white max-w-[130px] sm:max-w-[150px] truncate">
                    {currentUser ? currentUser.applicantName : 'Log Masuk'}
                  </span>
                </div>

                <ChevronDown className={`w-3.5 h-3.5 text-blue-300/80 transition-transform duration-200 ml-0.5 ${userMenuOpen ? 'rotate-180 text-blue-200' : 'group-hover:translate-y-0.5'}`} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Akaun Staf Pengguna</span>
                    <div className="flex items-center gap-2">
                      {currentUser && (
                        <button
                          type="button"
                          id="btn-dropdown-logout-orange"
                          onClick={() => {
                            clearActiveUser();
                            setCurrentUser(null);
                            setUserMenuOpen(false);
                          }}
                          className="text-[10px] font-bold text-white bg-orange-500 hover:bg-orange-600 active:bg-orange-700 px-2 py-0.5 rounded flex items-center gap-1 transition"
                          title="Log keluar ke paparan lalai"
                        >
                          <LogOut className="w-3 h-3" />
                          <span>Log Keluar</span>
                        </button>
                      )}
                      <button onClick={() => setUserMenuOpen(false)} className="text-slate-400 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <LoginUserCard 
                    staffList={staffList} 
                    compact={true} 
                    onProfileChange={() => {
                      setCurrentUser(getStoredActiveUser());
                      setUserMenuOpen(false);
                    }} 
                    isAdmin={isAdmin}
                    onRequirePinChange={onRequirePinChange}
                  />
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
              onClick={() => {
                if (activeTab === 'admin' && isAdmin) {
                  if (onLogoutAdmin) {
                    onLogoutAdmin();
                  } else {
                    handleTabClick('dashboard');
                  }
                  setMobileMenuOpen(false);
                } else {
                  handleTabClick('admin');
                }
              }}
              className={`w-full px-3 py-2.5 rounded-lg flex items-center justify-between text-left transition-all mt-2 border ${
                activeTab === 'admin'
                  ? 'bg-amber-400 text-slate-950 font-bold border-amber-300'
                  : 'bg-amber-500 text-slate-950 font-bold border-amber-400'
              }`}
            >
              <div className="flex items-center gap-3">
                {activeTab === 'admin' && isAdmin ? (
                  <>
                    <LogOut className="w-4 h-4" />
                    <span className="text-xs">Logout Admin</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-xs">Admin Access</span>
                  </>
                )}
              </div>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 bg-red-600 text-white font-extrabold rounded-full text-[10px]">
                  {pendingCount} Menunggu
                </span>
              )}
            </button>
          </div>

          <div className="pt-3 border-t border-slate-800">
            <LoginUserCard 
              staffList={staffList} 
              compact={true} 
              onProfileChange={() => {
                setCurrentUser(getStoredActiveUser());
                setMobileMenuOpen(false);
              }} 
              isAdmin={isAdmin}
              onRequirePinChange={onRequirePinChange}
            />
          </div>
        </div>
      )}

      {/* Cloud Sync Status & Multi-Device Details Modal */}
      <CloudSyncModal 
        isOpen={showCloudSyncModal} 
        onClose={() => setShowCloudSyncModal(false)} 
      />
    </header>
  );
};

