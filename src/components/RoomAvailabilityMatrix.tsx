import React, { useState, useEffect } from 'react';
import { 
  Room, 
  AcademicScheduleSlot, 
  AdHocBooking, 
  InstitutionalBlock, 
  RoomCategory,
  PurposeCategory 
} from '../types';
import { 
  checkRoomAvailability, 
  formatDateMalay, 
  getMalayDayOfWeek,
  calculateDurationText
} from '../utils/availabilityEngine';
import {
  ALL_BOOKING_TIME_SLOTS,
  DAY_TIME_SLOTS,
  NIGHT_TIME_SLOTS,
  TimeSlot,
  isTimeRangeNight
} from '../utils/timeSlots';
import { formatLevel } from '../utils/storage';
import { 
  Calendar, 
  Filter, 
  Search, 
  Info, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Building,
  Sparkles,
  Moon,
  Sun
} from 'lucide-react';

interface RoomAvailabilityMatrixProps {
  rooms: Room[];
  academicSchedule: AcademicScheduleSlot[];
  adhocBookings: AdHocBooking[];
  institutionalBlocks: InstitutionalBlock[];
  onOpenBookingModal: (room: Room, date: string, startTime: string, endTime: string, purpose: PurposeCategory) => void;
  onViewRoomDetails: (room: Room) => void;
}

export const RoomAvailabilityMatrix: React.FC<RoomAvailabilityMatrixProps> = ({
  rooms,
  academicSchedule,
  adhocBookings,
  institutionalBlocks,
  onOpenBookingModal,
  onViewRoomDetails
}) => {
  // Default to today's live current date in YYYY-MM-DD format
  const getTodayFormatted = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayFormatted);
  const [categoryFilter, setCategoryFilter] = useState<RoomCategory | 'Semua'>('Semua');
  const [periodFilter, setPeriodFilter] = useState<'ALL' | 'DAY' | 'NIGHT'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAircondOnly, setIsAircondOnly] = useState<boolean>(false);
  const [selectedCellInfo, setSelectedCellInfo] = useState<{
    room: Room;
    startTime: string;
    endTime: string;
    check: ReturnType<typeof checkRoomAvailability>;
  } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedCellInfo) {
        setSelectedCellInfo(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCellInfo]);

  // Filtered rooms
  const filteredRooms = rooms.filter(r => {
    if (categoryFilter !== 'Semua' && r.category !== categoryFilter) return false;
    if (isAircondOnly && !r.hasAircond) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.block.toLowerCase().includes(q);
    }
    return true;
  });

  const activeSlots = periodFilter === 'ALL' 
    ? ALL_BOOKING_TIME_SLOTS 
    : periodFilter === 'DAY' 
      ? DAY_TIME_SLOTS 
      : NIGHT_TIME_SLOTS;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-200">
              <Calendar className="w-3.5 h-3.5" />
              Matriks Ketersediaan (Jadual By Bilik Kuliah)
            </div>
          </div>

          <label 
            htmlFor="matrix-date-input"
            className="flex items-center gap-2 bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 p-2.5 rounded-xl cursor-pointer transition-all duration-150 shadow-sm active:scale-[0.98] group"
            title="Klik untuk memilih tarikh"
          >
            <Calendar className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform shrink-0" />
            <input
              id="matrix-date-input"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              onClick={(e) => {
                try {
                  (e.currentTarget as any).showPicker?.();
                } catch {}
              }}
              className="bg-transparent font-bold text-slate-900 text-sm outline-none cursor-pointer w-auto"
            />
            <span className="text-xs bg-emerald-100 group-hover:bg-emerald-200 text-emerald-800 font-semibold px-2 py-0.5 rounded transition-colors select-none shrink-0">
              {getMalayDayOfWeek(selectedDate)}
            </span>
          </label>
        </div>

        {/* Filter Controls Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari bilik (cth: BK04, DKA)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as RoomCategory | 'Semua')}
              className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Semua">Kategori: Semua ({rooms.length} Ruang)</option>
              <option value="Bilik Kuliah">Bilik Kuliah & Smart Class</option>
              <option value="Makmal Komputer">Makmal Komputer (5)</option>
              <option value="Dewan Kuliah">Dewan Kuliah (DKA & DKB)</option>
              <option value="Ruang Khas">Ruang Khas (4)</option>
              <option value="Surau">Surau (2)</option>
            </select>

            <label className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAircondOnly}
                onChange={(e) => setIsAircondOnly(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="font-semibold text-slate-700">⭐ Aircond Sahaja</span>
            </label>
          </div>

          {/* Session View Filter Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setPeriodFilter('ALL')}
              className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
                periodFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building className="w-3.5 h-3.5 text-emerald-600" />
              <span>Semua ({ALL_BOOKING_TIME_SLOTS.length})</span>
            </button>
            <button
              onClick={() => setPeriodFilter('DAY')}
              className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
                periodFilter === 'DAY'
                  ? 'bg-amber-100 text-amber-950 shadow-2xs border border-amber-300'
                  : 'text-slate-600 hover:text-amber-800'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-600" />
              <span>☀️ Siang ({DAY_TIME_SLOTS.length})</span>
            </button>
            <button
              onClick={() => setPeriodFilter('NIGHT')}
              className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
                periodFilter === 'NIGHT'
                  ? 'bg-indigo-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-indigo-800'
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
              <span>🌙 Malam ({NIGHT_TIME_SLOTS.length})</span>
            </button>
          </div>
        </div>

        {/* Status Legend Bar */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-slate-700">Petunjuk Status:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-emerald-500 border border-emerald-600 inline-block"></span>
              <span className="text-slate-700 font-medium">🟢 Kosong (Boleh Ditempah)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-rose-500 border border-rose-600 inline-block"></span>
              <span className="text-slate-700 font-medium">🔴 Jadual Akademik</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-amber-400 border border-amber-500 inline-block"></span>
              <span className="text-slate-700 font-medium">🟨 Tempahan / Pending</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-slate-900 border border-slate-950 inline-block"></span>
              <span className="text-slate-700 font-medium">⚫ Blocked Institusi</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
              ☀️ Sesi Siang: 08:30 – 16:30
            </span>
            <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded border border-indigo-200 font-semibold">
              🌙 Sesi Malam: 20:00 – 23:00 (Maksimum 23:00)
            </span>
          </div>
        </div>
      </div>

      {/* MATRIX TABLE CONTAINER */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              {periodFilter === 'ALL' ? (
                <>
                  <tr className="border-b border-slate-200">
                    <th rowSpan={2} className="py-3 px-4 font-bold sticky left-0 z-20 bg-slate-100 text-slate-800 text-xs uppercase tracking-wider min-w-[160px] border-r border-slate-200">
                      Ruang Kuliah
                    </th>
                    <th colSpan={DAY_TIME_SLOTS.length} className="py-2 px-3 font-bold text-center bg-amber-50 text-amber-900 border-r border-slate-200 text-xs tracking-wider">
                      ☀️ WAKTU SIANG (08:30 – 16:30)
                    </th>
                    <th colSpan={NIGHT_TIME_SLOTS.length} className="py-2 px-3 font-bold text-center bg-indigo-900 text-indigo-100 text-xs tracking-wider">
                      🌙 WAKTU MALAM (20:00 – 23:00)
                    </th>
                  </tr>
                  <tr className="bg-slate-50 text-slate-700 text-xs border-b border-slate-200 divide-x divide-slate-200">
                    {DAY_TIME_SLOTS.map(slot => (
                      <th key={slot.id} className="py-2 px-2 font-bold text-center min-w-[105px] bg-amber-50/40">
                        <div className="text-slate-800 font-mono text-[11px]">{slot.start}</div>
                      </th>
                    ))}
                    {NIGHT_TIME_SLOTS.map(slot => (
                      <th key={slot.id} className="py-2 px-2 font-bold text-center min-w-[105px] bg-indigo-950 text-indigo-100">
                        <div className="text-indigo-200 font-mono text-[11px] flex items-center justify-center gap-1">
                          <Moon className="w-2.5 h-2.5 text-indigo-300" />
                          <span>{slot.start}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </>
              ) : (
                <tr className="bg-slate-50 text-slate-700 text-xs uppercase tracking-wider border-b border-slate-200 divide-x divide-slate-200">
                  <th className="py-3 px-4 font-bold sticky left-0 z-20 bg-slate-50 min-w-[160px]">
                    Ruang Kuliah
                  </th>
                  {activeSlots.map(slot => (
                    <th 
                      key={slot.id} 
                      className={`py-3 px-3 font-bold text-center min-w-[115px] ${
                        slot.period === 'NIGHT' ? 'bg-indigo-900 text-indigo-100' : 'bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 font-mono">
                        {slot.period === 'NIGHT' && <Moon className="w-3 h-3 text-indigo-300" />}
                        <span>{slot.start} – {slot.end}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredRooms.map(room => {
                return (
                  <tr key={room.id} className="hover:bg-slate-50 transition divide-x divide-slate-100">
                    {/* Room Info Sticky Cell */}
                    <td className="py-3 px-4 sticky left-0 z-10 bg-white font-medium shadow-r">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => onViewRoomDetails(room)}
                          className="font-bold text-slate-900 hover:text-emerald-600 transition flex items-center justify-between w-full text-left"
                        >
                          <span>{room.code}</span>
                          {room.hasAircond && (
                            <span className="text-[10px] bg-cyan-100 text-cyan-800 px-1.5 py-0.2 rounded font-bold border border-cyan-300 ml-auto text-right">
                              💠 Aircond
                            </span>
                          )}
                        </button>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {room.block} ({formatLevel(room.level)})
                      </div>
                    </td>

                    {/* Time Slots */}
                    {activeSlots.map(slot => {
                      // Check if room disallows night booking for night slots
                      if (slot.period === 'NIGHT' && room.allowNightBooking === false) {
                        return (
                          <td key={slot.id} className="p-1.5 text-center bg-slate-50/50">
                            <div 
                              className="w-full h-11 rounded-lg bg-slate-100 border border-dashed border-slate-200 text-slate-400 text-[10px] font-medium flex flex-col items-center justify-center cursor-not-allowed"
                              title={`Ruang ${room.code} tidak dibuka untuk tempahan waktu malam.`}
                            >
                              <span className="text-slate-500 font-semibold">Tutup Malam</span>
                              <span className="text-[9px] text-slate-400">Khas Siang</span>
                            </div>
                          </td>
                        );
                      }

                      const check = checkRoomAvailability(
                        room, 
                        selectedDate, 
                        slot.start, 
                        slot.end, 
                        academicSchedule, 
                        adhocBookings, 
                        institutionalBlocks
                      );

                      const isAvail = check.status === 'AVAILABLE';
                      const isAcad = check.status === 'OCCUPIED_ACADEMIC';
                      const isAdhoc = check.status === 'OCCUPIED_BOOKING' || check.status === 'PENDING_BOOKING';
                      const isBlocked = check.status === 'BLOCKED';

                      return (
                        <td key={slot.id} className={`p-1.5 text-center ${slot.period === 'NIGHT' ? 'bg-indigo-50/20' : ''}`}>
                          {isAvail && (
                            <button
                              onClick={() => onOpenBookingModal(room, selectedDate, slot.start, slot.end, 'Penggunaan Pensyarah')}
                              className={`w-full h-11 rounded-lg border font-bold transition flex flex-col items-center justify-center p-1 group shadow-2xs ${
                                slot.period === 'NIGHT'
                                  ? 'bg-indigo-50/80 hover:bg-indigo-600 hover:text-white border-indigo-200 text-indigo-900'
                                  : 'bg-emerald-50 hover:bg-emerald-500 hover:text-white border-emerald-300/80 text-emerald-800'
                              }`}
                              title={`Klik untuk Tempah ${room.code} (${slot.label})`}
                            >
                              <span className="text-[11px] flex items-center gap-1">
                                {slot.period === 'NIGHT' ? (
                                  <Moon className="w-3 h-3 text-indigo-600 group-hover:text-white" />
                                ) : (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 group-hover:text-white" />
                                )}
                                Kosong
                              </span>
                              <span className="text-[9px] opacity-80 font-normal group-hover:text-white">Tempah +</span>
                            </button>
                          )}

                          {isAcad && (
                            <button
                              onClick={() => setSelectedCellInfo({ room, startTime: slot.start, endTime: slot.end, check })}
                              className="w-full h-11 rounded-lg bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-900 font-semibold transition p-1 text-center flex flex-col items-center justify-center overflow-hidden"
                              title={check.conflictReason}
                            >
                              <div className="text-[10px] font-bold truncate max-w-full text-rose-950">
                                📚 {check.academicSlot?.className}
                              </div>
                              <div className="text-[9px] truncate max-w-full text-rose-800 font-medium">
                                {check.academicSlot?.courseCode}
                              </div>
                            </button>
                          )}

                          {isAdhoc && (
                            <button
                              onClick={() => setSelectedCellInfo({ room, startTime: slot.start, endTime: slot.end, check })}
                              className="w-full h-11 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 font-semibold transition p-1 text-center flex flex-col items-center justify-center overflow-hidden"
                              title={check.conflictReason}
                            >
                              <div className="text-[10px] font-bold truncate max-w-full text-amber-950">
                                🟨 {check.existingBooking?.applicantName}
                              </div>
                              <div className="text-[9px] truncate max-w-full text-amber-800">
                                {check.existingBooking?.purposeCategory}
                              </div>
                            </button>
                          )}

                          {isBlocked && (
                            <button
                              onClick={() => setSelectedCellInfo({ room, startTime: slot.start, endTime: slot.end, check })}
                              className="w-full h-11 rounded-lg bg-slate-900 text-white font-semibold transition p-1 text-center flex flex-col items-center justify-center overflow-hidden"
                              title={check.conflictReason}
                            >
                              <div className="text-[10px] font-bold truncate max-w-full text-amber-300">
                                ⚫ BLOCKED
                              </div>
                              <div className="text-[9px] truncate max-w-full text-slate-300">
                                Program Kolej
                              </div>
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* POPUP MODAL FOR CELL INSPECTION */}
      {selectedCellInfo && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Maklumat Slot Ruang</span>
                <span className="text-xs font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                  {selectedCellInfo.room.code}
                </span>
              </h3>
              <button
                onClick={() => setSelectedCellInfo(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-slate-700">
              <div>
                <strong className="text-slate-900">Ruang:</strong> {selectedCellInfo.room.name} ({selectedCellInfo.room.block})
              </div>
              <div>
                <strong className="text-slate-900">Masa:</strong> {selectedCellInfo.startTime} – {selectedCellInfo.endTime} ({calculateDurationText(selectedCellInfo.startTime, selectedCellInfo.endTime)}) • {formatDateMalay(selectedDate)}
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-emerald-600" />
                  Status Occupancy Engine:
                </div>
                <div className="text-slate-800 text-xs leading-relaxed font-medium">
                  {selectedCellInfo.check.conflictReason}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedCellInfo(null)}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded-xl text-xs transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
