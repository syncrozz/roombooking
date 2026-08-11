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
  Sparkles
} from 'lucide-react';

interface RoomAvailabilityMatrixProps {
  rooms: Room[];
  academicSchedule: AcademicScheduleSlot[];
  adhocBookings: AdHocBooking[];
  institutionalBlocks: InstitutionalBlock[];
  onOpenBookingModal: (room: Room, date: string, startTime: string, endTime: string, purpose: PurposeCategory) => void;
  onViewRoomDetails: (room: Room) => void;
}

const TIME_SLOTS = [
  { start: '08:30', end: '09:30', label: '08:30 - 09:30' },
  { start: '09:30', end: '10:30', label: '09:30 - 10:30' },
  { start: '10:30', end: '11:30', label: '10:30 - 11:30' },
  { start: '11:30', end: '12:30', label: '11:30 - 12:30' },
  { start: '14:30', end: '15:30', label: '02:30 - 03:30' },
  { start: '15:30', end: '16:30', label: '03:30 - 04:30' }
];

export const RoomAvailabilityMatrix: React.FC<RoomAvailabilityMatrixProps> = ({
  rooms,
  academicSchedule,
  adhocBookings,
  institutionalBlocks,
  onOpenBookingModal,
  onViewRoomDetails
}) => {
  const [selectedDate, setSelectedDate] = useState<string>('2026-08-06'); // Thursday prompt example
  const [categoryFilter, setCategoryFilter] = useState<RoomCategory | 'Semua'>('Semua');
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

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-200 mb-1">
              <Calendar className="w-3.5 h-3.5" />
              Matriks Ketersediaan (Jadual By Bilik Kuliah)
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              KPMBP Room Calendar Matrix (33 Ruang)
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm mt-0.5">
              Paparan visual langsung untuk menyemak pertembungan jadual akademik, tempahan ad-hoc & program kolej.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent font-bold text-slate-900 text-sm outline-none cursor-pointer"
            />
            <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">
              {getMalayDayOfWeek(selectedDate)}
            </span>
          </div>
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
              <option value="Semua">Kategori: Semua (33 Ruang)</option>
              <option value="Bilik Kuliah">Bilik Kuliah (28)</option>
              <option value="Dewan Kuliah">Dewan Kuliah (2)</option>
              <option value="Ruang Khas">Ruang Khas (3)</option>
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

          <div className="text-slate-500 font-medium">
            Menunjukkan <strong>{filteredRooms.length}</strong> daripada 33 ruang
          </div>
        </div>

        {/* Status Legend Bar */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs">
          <span className="font-bold text-slate-700">Petunjuk Status:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-emerald-500 border border-emerald-600 inline-block"></span>
            <span className="text-slate-700 font-medium">🟢 Available (Boleh Ditempah)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-rose-500 border border-rose-600 inline-block"></span>
            <span className="text-slate-700 font-medium">🔴 Occupied (Jadual Akademik)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-amber-400 border border-amber-500 inline-block"></span>
            <span className="text-slate-700 font-medium">🟨 Tempahan Ad-Hoc / Pending</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-slate-900 border border-slate-950 inline-block"></span>
            <span className="text-slate-700 font-medium">⚫ Blocked Institusi</span>
          </div>
        </div>
      </div>

      {/* MATRIX TABLE CONTAINER */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-700 text-xs uppercase tracking-wider border-b border-slate-200 divide-x divide-slate-200">
                <th className="py-3 px-4 font-bold sticky left-0 z-20 bg-slate-50 min-w-[160px]">
                  Ruang Kuliah
                </th>
                {TIME_SLOTS.map(slot => (
                  <th key={slot.label} className="py-3 px-3 font-bold text-center min-w-[120px]">
                    <div className="text-slate-800">{slot.start}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredRooms.map(room => {
                return (
                  <tr key={room.id} className="hover:bg-slate-50 transition divide-x divide-slate-100">
                    {/* Room Info Sticky Cell */}
                    <td className="py-3 px-4 sticky left-0 z-10 bg-white font-medium shadow-r">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => onViewRoomDetails(room)}
                          className="font-bold text-slate-900 hover:text-emerald-600 transition flex items-center gap-1.5 text-left"
                        >
                          <span>{room.code}</span>
                          {room.hasAircond && (
                            <span className="text-[10px] bg-cyan-100 text-cyan-800 px-1.5 py-0.2 rounded font-bold border border-cyan-300">
                              💠 Aircond
                            </span>
                          )}
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-500 font-normal truncate max-w-[140px]">
                        {room.name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {room.block} ({formatLevel(room.level)})
                      </div>
                    </td>

                    {/* Time Slots */}
                    {TIME_SLOTS.map(slot => {
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
                        <td key={slot.label} className="p-1.5 text-center">
                          {isAvail && (
                            <button
                              onClick={() => onOpenBookingModal(room, selectedDate, slot.start, slot.end, 'Penggunaan Pensyarah')}
                              className="w-full h-11 rounded-lg bg-emerald-50 hover:bg-emerald-500 hover:text-white border border-emerald-300/80 text-emerald-800 font-bold transition flex flex-col items-center justify-center p-1 group shadow-xs"
                              title={`Klik untuk Tempah ${room.code} (${slot.label})`}
                            >
                              <span className="text-[11px] flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 group-hover:text-white" />
                                Kosong
                              </span>
                              <span className="text-[9px] opacity-80 font-normal group-hover:text-white">Tempah +</span>
                            </button>
                          )}

                          {isAcad && (
                            <button
                              onClick={() => setSelectedCellInfo({ room, startTime: slot.start, endTime: slot.end, check })}
                              className="w-full h-11 rounded-lg bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-900 font-semibold transition p-1 text-left flex flex-col justify-between overflow-hidden"
                              title={check.conflictReason}
                            >
                              <div className="text-[10px] font-bold truncate text-rose-950">
                                📚 {check.academicSlot?.className}
                              </div>
                              <div className="text-[9px] truncate text-rose-800 font-medium">
                                {check.academicSlot?.courseCode}
                              </div>
                            </button>
                          )}

                          {isAdhoc && (
                            <button
                              onClick={() => setSelectedCellInfo({ room, startTime: slot.start, endTime: slot.end, check })}
                              className="w-full h-11 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 font-semibold transition p-1 text-left flex flex-col justify-between overflow-hidden"
                              title={check.conflictReason}
                            >
                              <div className="text-[10px] font-bold truncate text-amber-950">
                                🟨 {check.existingBooking?.applicantName}
                              </div>
                              <div className="text-[9px] truncate text-amber-800">
                                {check.existingBooking?.purposeCategory}
                              </div>
                            </button>
                          )}

                          {isBlocked && (
                            <button
                              onClick={() => setSelectedCellInfo({ room, startTime: slot.start, endTime: slot.end, check })}
                              className="w-full h-11 rounded-lg bg-slate-900 text-white font-semibold transition p-1 text-left flex flex-col justify-between overflow-hidden"
                              title={check.conflictReason}
                            >
                              <div className="text-[10px] font-bold truncate text-amber-300">
                                ⚫ BLOCKED
                              </div>
                              <div className="text-[9px] truncate text-slate-300">
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
