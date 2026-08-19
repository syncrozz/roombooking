import React from 'react';
import { 
  Room, 
  AcademicScheduleSlot, 
  AdHocBooking, 
  InstitutionalBlock, 
  StaffUser,
  PurposeCategory 
} from '../types';
import { ActiveTab } from './Header';
import { 
  Search, 
  CalendarDays, 
  BookOpen, 
  QrCode, 
  SlidersHorizontal, 
  Building2, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  ArrowRight,
  Sparkles,
  Calendar,
  Layers,
  MapPin,
  Laptop,
  GraduationCap,
  Lock
} from 'lucide-react';

interface DashboardOverviewProps {
  rooms: Room[];
  academicSchedule: AcademicScheduleSlot[];
  adhocBookings: AdHocBooking[];
  institutionalBlocks: InstitutionalBlock[];
  staffList: StaffUser[];
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenBookingModal: (room: Room, date: string, startTime: string, endTime: string, purpose: PurposeCategory) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  rooms,
  academicSchedule,
  adhocBookings,
  institutionalBlocks,
  staffList,
  onNavigateTab,
  onOpenBookingModal,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Stats
  const totalRooms = rooms.length;
  const approvedBookings = adhocBookings.filter(b => b.status === 'Approved');
  const pendingBookings = adhocBookings.filter(b => b.status === 'Pending');
  const todayBookings = adhocBookings.filter(b => b.date === todayStr && b.status === 'Approved');
  
  // Room category distribution
  const lectureRoomsCount = rooms.filter(r => r.category === 'Bilik Kuliah').length;
  const labsCount = rooms.filter(r => r.category === 'Makmal Komputer').length;
  const hallsCount = rooms.filter(r => r.category === 'Dewan & Auditorium' || r.category === 'Bilik Mesyuarat').length;
  const studioCount = rooms.filter(r => r.category === 'Studio & Bengkel').length;

  const quickNavItems = [
    {
      id: 'search' as ActiveTab,
      label: 'Cari & Tempah',
      icon: Search,
      color: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border-emerald-200/90',
    },
    {
      id: 'matrix' as ActiveTab,
      label: 'Calendar',
      icon: CalendarDays,
      color: 'text-blue-700 bg-blue-50 hover:bg-blue-100/80 border-blue-200/90',
    },
    {
      id: 'academic' as ActiveTab,
      label: 'Locked',
      icon: Lock,
      color: 'text-amber-700 bg-amber-50 hover:bg-amber-100/80 border-amber-200/90',
    },
    {
      id: 'mybookings' as ActiveTab,
      label: 'My Booking',
      icon: QrCode,
      color: 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 border-indigo-200/90',
    },
    {
      id: 'directory' as ActiveTab,
      label: 'Direktori',
      icon: SlidersHorizontal,
      color: 'text-purple-700 bg-purple-50 hover:bg-purple-100/80 border-purple-200/90',
    },
    {
      id: 'admin' as ActiveTab,
      label: 'Admin Access',
      icon: ShieldCheck,
      color: 'text-rose-700 bg-rose-50 hover:bg-rose-100/80 border-rose-200/90',
    },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      
      {/* 1. Compact Header Bar with Metrics */}
      <div className="bg-slate-900 text-white rounded-xl p-4 sm:p-5 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-sm">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Hab Pengurusan Ruang KPMBP
              </h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/20">
                Sesi 2 2026/2027
              </span>
            </div>
            <p className="text-xs text-slate-400">
              42 ruang terurus merangkumi Bilik Kuliah, Makmal Komputer, Dewan & Studio.
            </p>
          </div>
        </div>

        {/* Dense Key Stats */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0 bg-slate-800/80 px-3.5 py-2 rounded-lg border border-slate-700">
          <div className="text-center px-2 border-r border-slate-700">
            <div className="text-sm sm:text-base font-bold text-white leading-none">{totalRooms}</div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold mt-0.5">Ruang</div>
          </div>
          <div className="text-center px-2 border-r border-slate-700">
            <div className="text-sm sm:text-base font-bold text-emerald-400 leading-none">{approvedBookings.length}</div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold mt-0.5">Tempahan</div>
          </div>
          <div className="text-center px-2 border-r border-slate-700">
            <div className="text-sm sm:text-base font-bold text-amber-400 leading-none">{academicSchedule.length}</div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold mt-0.5">Kuliah</div>
          </div>
          <div className="text-center px-2">
            <div className="text-sm sm:text-base font-bold text-blue-400 leading-none">{staffList.length}</div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold mt-0.5">Staf</div>
          </div>
        </div>
      </div>

      {/* 2. Compact Fast-Action Navigation Grid (Harmonized, Clean) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {quickNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigateTab(item.id)}
              className={`p-2.5 sm:p-3 rounded-xl border transition-all text-left flex items-center justify-between cursor-pointer hover:shadow-xs hover:-translate-y-0.5 group ${item.color}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-white/80 shadow-2xs flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold truncate">{item.label}</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
            </button>
          );
        })}
      </div>

      {/* 3. Compact 2-Column Split: Ruang Ringkas & Tempahan Pantas Hari Ini */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Column (5 cols): Kategori & Statistik Ruang */}
        <div className="lg:col-span-5 bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Kategori Ruang</h2>
            </div>
            <button
              onClick={() => onNavigateTab('directory')}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-700"
            >
              Direktori Penuh →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-medium text-slate-700">Bilik Kuliah</span>
              </div>
              <span className="font-bold text-slate-900">{lectureRoomsCount} unit</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Laptop className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-medium text-slate-700">Makmal Komputer</span>
              </div>
              <span className="font-bold text-slate-900">{labsCount} unit</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                <span className="font-medium text-slate-700">Dewan & Mesyuarat</span>
              </div>
              <span className="font-bold text-slate-900">{hallsCount} unit</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span className="font-medium text-slate-700">Studio & Bengkel</span>
              </div>
              <span className="font-bold text-slate-900">{studioCount} unit</span>
            </div>
          </div>

          {/* Quick Notice */}
          <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-100 flex items-start gap-2 text-[11px] text-blue-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
            <span>Sistem mengesan pertembungan jadual kuliah rasmi & tempahan secara automatik.</span>
          </div>
        </div>

        {/* Right Column (7 cols): Tempahan Segera Ruang Utama */}
        <div className="lg:col-span-7 bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Tempahan Pantas ({todayStr})</h2>
            </div>
            <button
              onClick={() => onNavigateTab('search')}
              className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700"
            >
              Carian Slot Penuh →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {rooms.slice(0, 4).map((r) => (
              <div
                key={r.id}
                className="p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/40 transition flex items-center justify-between"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900">{r.name}</span>
                    {r.name !== r.code && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200 font-semibold text-slate-700">
                        {r.code}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {r.block} • {r.capacity} pax
                  </div>
                </div>

                <button
                  onClick={() => onOpenBookingModal(r, todayStr, '08:30', '10:30', 'Kelas / Kuliah Gantian')}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold transition shadow-2xs"
                >
                  Tempah
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
            <span>Perlu semakan ketersediaan visual?</span>
            <button
              onClick={() => onNavigateTab('matrix')}
              className="font-bold text-blue-600 hover:underline"
            >
              Buka Matriks Kalendar →
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
