import React, { useState } from 'react';
import { 
  AdHocBooking, 
  InstitutionalBlock, 
  Room, 
  AcademicScheduleSlot 
} from '../types';
import { formatDateMalay } from '../utils/availabilityEngine';
import { 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Trash2, 
  RotateCcw, 
  AlertTriangle,
  Building,
  Calendar,
  Clock,
  User,
  FileSpreadsheet
} from 'lucide-react';

interface AdminManagementViewProps {
  bookings: AdHocBooking[];
  institutionalBlocks: InstitutionalBlock[];
  rooms: Room[];
  onApproveBooking: (id: string) => void;
  onRejectBooking: (id: string) => void;
  onAddBlock: (block: Omit<InstitutionalBlock, 'id'>) => void;
  onDeleteBlock: (id: string) => void;
  onResetData: () => void;
}

export const AdminManagementView: React.FC<AdminManagementViewProps> = ({
  bookings,
  institutionalBlocks,
  rooms,
  onApproveBooking,
  onRejectBooking,
  onAddBlock,
  onDeleteBlock,
  onResetData
}) => {
  const pendingBookings = bookings.filter(b => b.status === 'PENDING');

  // Form for adding institutional block
  const [blockRoomId, setBlockRoomId] = useState<string>('DEWAN_BESAR');
  const [blockDate, setBlockDate] = useState<string>('2026-08-10');
  const [blockStartTime, setBlockStartTime] = useState<string>('08:00');
  const [blockEndTime, setBlockEndTime] = useState<string>('17:00');
  const [blockTitle, setBlockTitle] = useState<string>('');
  const [blockReason, setBlockReason] = useState<string>('');
  const [blockCreatedBy, setBlockCreatedBy] = useState<string>('Hal Ehwal Pelajar (HEP)');

  const handleCreateBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockTitle.trim()) {
      alert('Sila masukkan tajuk program/aktiviti!');
      return;
    }

    onAddBlock({
      roomId: blockRoomId,
      date: blockDate,
      startTime: blockStartTime,
      endTime: blockEndTime,
      title: blockTitle,
      reason: blockReason || 'Program Rasmi Kolej',
      createdBy: blockCreatedBy
    });

    setBlockTitle('');
    setBlockReason('');
    alert('🟢 Block Institusi berjaya diletakkan pada ruang!');
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-bold mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Mod Pentadbir & Pengurusan Block
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              Kawalan Pentadbir & Kelulusan Tempahan
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm mt-0.5">
              Luluskan permohonan tempahan ad-hoc, sekat ruang untuk aktiviti rasmi institusi, dan urus konfigurasi sistem.
            </p>
          </div>

          <button
            onClick={() => {
              if (confirm('Adakah anda pasti mahu menetapkan semula (reset) semua data ke nilai asal KPMBP?')) {
                onResetData();
                alert('Sistem telah ditetapkan semula ke data asal.');
              }
            }}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold py-2 px-3.5 rounded-xl transition flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>Reset Data Asal</span>
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-xs">
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
            <span className="text-slate-400 block font-medium">Permohonan Menunggu Kelulusan:</span>
            <strong className="text-xl font-bold text-amber-400">{pendingBookings.length} Permohonan</strong>
          </div>
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
            <span className="text-slate-400 block font-medium">Ruang Dibatasi (Institutional Block):</span>
            <strong className="text-xl font-bold text-indigo-300">{institutionalBlocks.length} Block</strong>
          </div>
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
            <span className="text-slate-400 block font-medium">Jumlah Tempahan Ad-Hoc:</span>
            <strong className="text-xl font-bold text-emerald-400">{bookings.length} Rekod</strong>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* SECTION 1: PENDING APPROVALS */}
        <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-amber-500" />
              <span>Kelulusan Permohonan Menunggu ({pendingBookings.length})</span>
            </h3>
          </div>

          {pendingBookings.length > 0 ? (
            <div className="space-y-3">
              {pendingBookings.map(p => (
                <div key={p.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold bg-slate-900 text-amber-400 px-2 py-0.5 rounded">
                      {p.id}
                    </span>
                    <span className="text-slate-500 font-medium">{p.purposeCategory}</span>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{p.title}</h4>
                    <div className="text-xs text-slate-600 mt-0.5">
                      Pemohon: <strong>{p.applicantName}</strong> ({p.applicantRole} - {p.department})
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs space-y-1 text-slate-700 font-medium">
                    <div>🏫 Ruang: <strong>{p.roomName} ({p.roomId})</strong></div>
                    <div>📅 Tarikh: <strong>{formatDateMalay(p.date)}</strong></div>
                    <div>🕐 Masa: <strong>{p.startTime} – {p.endTime}</strong> (👥 {p.paxCount} pax)</div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => onApproveBooking(p.id)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition flex items-center justify-center gap-1 shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Luluskan</span>
                    </button>
                    <button
                      onClick={() => onRejectBooking(p.id)}
                      className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition flex items-center justify-center gap-1 shadow-xs"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Tolak</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs italic bg-slate-50 rounded-xl border border-dashed border-slate-300">
              Tiada permohonan yang sedang menunggu kelulusan pada masa ini.
            </div>
          )}
        </div>

        {/* SECTION 2: ADD INSTITUTIONAL BLOCK */}
        <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-indigo-600" />
              <span>Sekat Ruang (Institutional Block)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Gunakan borang ini untuk melock ruang tertentu bagi program kolej, majlis rasmi, atau peperiksaan.
            </p>
          </div>

          <form onSubmit={handleCreateBlock} className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Pilih Ruang Dibatasi:</label>
              <select
                value={blockRoomId}
                onChange={(e) => setBlockRoomId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>{r.name} ({r.category})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tarikh Block:</label>
                <input
                  type="date"
                  value={blockDate}
                  onChange={(e) => setBlockDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Dicipta Oleh:</label>
                <input
                  type="text"
                  value={blockCreatedBy}
                  onChange={(e) => setBlockCreatedBy(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Masa Mula:</label>
                <input
                  type="text"
                  value={blockStartTime}
                  onChange={(e) => setBlockStartTime(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none"
                  placeholder="08:00"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Masa Tamat:</label>
                <input
                  type="text"
                  value={blockEndTime}
                  onChange={(e) => setBlockEndTime(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none"
                  placeholder="17:00"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Tajuk Program / Aktiviti:</label>
              <input
                type="text"
                placeholder="cth: Minggu Mesra Siswa (MMS) / Peperiksaan Selaras"
                value={blockTitle}
                onChange={(e) => setBlockTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Tujuan / Sebab Lock:</label>
              <input
                type="text"
                placeholder="cth: Program rasmi peringkat kolej"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>TAMBAH BLOCK RUANG</span>
            </button>
          </form>
        </div>

      </div>

      {/* INSTITUTIONAL BLOCKS LIST */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200 space-y-4">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Lock className="w-5 h-5 text-slate-800" />
          <span>Senarai Block Institusi Aktif ({institutionalBlocks.length})</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {institutionalBlocks.map(blk => {
            const r = rooms.find(rm => rm.id === blk.roomId);

            return (
              <div key={blk.id} className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      {r ? (r.code === r.name ? r.name : `${r.code} (${r.name})`) : blk.roomId}
                    </span>
                    <span className="text-slate-400 font-medium">{formatDateMalay(blk.date)}</span>
                  </div>

                  <h4 className="font-bold text-slate-100 text-sm mt-1">{blk.title}</h4>
                  <div className="text-slate-400 text-[11px]">
                    Jam: {blk.startTime} – {blk.endTime} • Oleh: {blk.createdBy}
                  </div>
                </div>

                <button
                  onClick={() => onDeleteBlock(blk.id)}
                  className="text-slate-400 hover:text-rose-400 p-1 transition"
                  title="Padam Block Ruang"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
