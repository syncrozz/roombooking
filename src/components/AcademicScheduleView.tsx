import React, { useState } from 'react';
import { AcademicScheduleSlot, Room, DayOfWeek } from '../types';
import { MALAY_DAYS } from '../utils/availabilityEngine';
import { 
  BookOpen, 
  Search, 
  Calendar, 
  User, 
  Building, 
  Clock, 
  Plus, 
  Tag, 
  Filter,
  CheckCircle2
} from 'lucide-react';

interface AcademicScheduleViewProps {
  schedule: AcademicScheduleSlot[];
  rooms: Room[];
  onAddScheduleSlot?: (slot: Omit<AcademicScheduleSlot, 'id'>) => void;
}

export const AcademicScheduleView: React.FC<AcademicScheduleViewProps> = ({
  schedule,
  rooms,
  onAddScheduleSlot
}) => {
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | 'Semua'>('Khamis');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roomFilter, setRoomFilter] = useState<string>('Semua');

  // Filter schedule slots
  const filteredSlots = schedule.filter(slot => {
    if (selectedDay !== 'Semua' && slot.dayOfWeek !== selectedDay) return false;
    if (roomFilter !== 'Semua' && slot.roomId !== roomFilter) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        slot.courseCode.toLowerCase().includes(q) ||
        slot.courseName.toLowerCase().includes(q) ||
        slot.className.toLowerCase().includes(q) ||
        slot.lecturerName.toLowerCase().includes(q) ||
        slot.department.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-200 mb-1">
              <BookOpen className="w-3.5 h-3.5" />
              Layer 1: Existing Occupancy
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Jadual Akademik Rasmi KPMBP
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm mt-0.5">
              Sesi kuliah rasmi yang telah ditetapkan dalam jadual mingguan. Penggunaan ini tidak memerlukan tempahan ad-hoc tambahan.
            </p>
          </div>

          <div className="bg-blue-900 text-white p-3 rounded-xl text-center min-w-[160px] shadow-sm">
            <div className="text-[11px] text-blue-200 font-medium">Jumlah Slot Waktu Rasmi</div>
            <div className="text-xl font-bold text-blue-300 mt-0.5">{schedule.length} Slot</div>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Day Filter */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
              <button
                onClick={() => setSelectedDay('Semua')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  selectedDay === 'Semua' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Hari
              </button>
              {['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat'].map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDay(d as DayOfWeek)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition ${
                    selectedDay === d ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            {/* Room Filter */}
            <select
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-medium outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Semua">Tapis Ruang: Semua Ruang</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari subjek, kelas (DIA 4C), pensyarah..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Slots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSlots.length > 0 ? (
          filteredSlots.map(slot => {
            const room = rooms.find(r => r.id === slot.roomId);

            return (
              <div
                key={slot.id}
                className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:border-blue-300 transition-all space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <span className="bg-blue-100 text-blue-900 font-extrabold px-3 py-1 rounded-lg text-xs border border-blue-200">
                    📘 {slot.className}
                  </span>
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md">
                    {slot.dayOfWeek}
                  </span>
                </div>

                <div>
                  <h4 className="text-base font-bold text-slate-900 leading-snug">
                    {slot.courseCode} — {slot.courseName}
                  </h4>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{slot.lecturerName}</span>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-1 text-xs text-slate-700">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="flex items-center gap-1 text-slate-900">
                      <Building className="w-3.5 h-3.5 text-blue-600" />
                      {room ? (room.code === room.name ? room.name : `${room.code} (${room.name})`) : slot.roomId}
                    </span>
                    <span className="text-slate-500 font-normal">
                      {room?.block}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-emerald-700 font-bold pt-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Masa: {slot.startTime} – {slot.endTime}</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 flex justify-between items-center pt-1">
                  <span>Jabatan: {slot.department}</span>
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Dilock oleh Sistem
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full bg-white rounded-2xl p-12 text-center text-slate-500 border border-slate-200">
            <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="font-bold text-base text-slate-700">Tiada Jadual Akademik Dijumpai</p>
            <p className="text-xs text-slate-500 mt-1">Cuba tukar tapisan hari, ruang, atau kata kunci carian.</p>
          </div>
        )}
      </div>
    </div>
  );
};
