import React, { useState } from 'react';
import { AdHocBooking, BookingStatus } from '../types';
import { formatDateMalay, generateWhatsAppLink } from '../utils/availabilityEngine';
import { 
  QrCode, 
  Share2, 
  Clock, 
  Calendar, 
  User, 
  Building, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Trash2, 
  MessageSquare,
  Search,
  ExternalLink,
  Tag
} from 'lucide-react';

interface MyBookingsViewProps {
  bookings: AdHocBooking[];
  onOpenQRModal: (booking: AdHocBooking) => void;
  onCancelBooking: (bookingId: string) => void;
}

export const MyBookingsView: React.FC<MyBookingsViewProps> = ({
  bookings,
  onOpenQRModal,
  onCancelBooking
}) => {
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'Semua'>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredBookings = bookings.filter(b => {
    if (statusFilter !== 'Semua' && b.status !== statusFilter) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        b.id.toLowerCase().includes(q) ||
        b.applicantName.toLowerCase().includes(q) ||
        (b.applicantEmail && b.applicantEmail.toLowerCase().includes(q)) ||
        b.roomName.toLowerCase().includes(q) ||
        b.roomId.toLowerCase().includes(q) ||
        b.title.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200 mb-1">
              <QrCode className="w-3.5 h-3.5" />
              Senarai Tempahan Ad-Hoc & Pas Pengesahan
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Tempahan Saya & Pas Akses QR
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm mt-0.5">
              Urus tempahan ad-hoc anda, dapatkan ID Tempahan rasmi, dan kongsi status melalui WhatsApp dengan satu klik.
            </p>
          </div>

          <div className="flex gap-2">
            <div className="bg-emerald-900 text-white px-4 py-2.5 rounded-xl text-center shadow-xs">
              <div className="text-[10px] text-emerald-300 uppercase tracking-wider font-semibold">Disahkan</div>
              <div className="text-lg font-bold">
                {bookings.filter(b => b.status === 'CONFIRMED').length}
              </div>
            </div>
            <div className="bg-amber-900 text-white px-4 py-2.5 rounded-xl text-center shadow-xs">
              <div className="text-[10px] text-amber-300 uppercase tracking-wider font-semibold">Menunggu</div>
              <div className="text-lg font-bold">
                {bookings.filter(b => b.status === 'PENDING').length}
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
            <button
              onClick={() => setStatusFilter('Semua')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                statusFilter === 'Semua' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({bookings.length})
            </button>
            <button
              onClick={() => setStatusFilter('CONFIRMED')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                statusFilter === 'CONFIRMED' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🟢 Disahkan ({bookings.filter(b => b.status === 'CONFIRMED').length})
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                statusFilter === 'PENDING' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🟡 Menunggu ({bookings.filter(b => b.status === 'PENDING').length})
            </button>
          </div>

          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari ID (BK-2026-...), pemohon, ruang..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Bookings Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredBookings.length > 0 ? (
          filteredBookings.map(b => {
            const isConfirmed = b.status === 'CONFIRMED';
            const isPending = b.status === 'PENDING';

            return (
              <div
                key={b.id}
                className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:border-emerald-300 transition-all space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-slate-900 text-emerald-400 px-2.5 py-1 rounded-md border border-slate-800">
                        {b.id}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {b.purposeCategory}
                      </span>
                    </div>

                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                      isConfirmed 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : isPending
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}>
                      {isConfirmed && '🟢 CONFIRMED'}
                      {isPending && '🟡 MENUNGGU KELULUSAN'}
                      {b.status === 'REJECTED' && '🔴 DITOLAK'}
                    </span>
                  </div>

                  {/* Booking Title & Applicant */}
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 leading-snug">
                      {b.title}
                    </h3>
                    <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <div className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-blue-600" />
                        <span className="font-semibold text-slate-900">{b.applicantName}</span>
                      </div>
                      <span className="text-slate-400">• {b.applicantRole} ({b.department})</span>
                      {b.applicantEmail && (
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                          ✉️ {b.applicantEmail}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Room & Time Details Box */}
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2 text-xs text-slate-700">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <Building className="w-4 h-4 text-emerald-600" />
                        {b.roomName} ({b.roomId})
                      </span>
                      <span className="text-slate-500">👥 {b.paxCount} Hadirin</span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                      <span className="flex items-center gap-1 text-slate-800 font-semibold">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        {formatDateMalay(b.date)}
                      </span>
                      <span className="flex items-center gap-1 text-emerald-700 font-bold">
                        <Clock className="w-3.5 h-3.5" />
                        {b.startTime} – {b.endTime}
                      </span>
                    </div>

                    {b.notes && (
                      <div className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200/40">
                        Catatan: "{b.notes}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    {/* WhatsApp Share Button */}
                    <a
                      href={generateWhatsAppLink(b)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg shadow-xs transition flex items-center gap-1.5"
                      title="Kongsi Ringkasan Tempahan ke WhatsApp"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                      <ExternalLink className="w-3 h-3 text-emerald-200" />
                    </a>

                    {/* QR Code Pass Button */}
                    <button
                      onClick={() => onOpenQRModal(b)}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-3 rounded-lg shadow-xs transition flex items-center gap-1.5"
                    >
                      <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Pas QR</span>
                    </button>
                  </div>

                  {/* Cancel Button */}
                  <button
                    onClick={() => {
                      if (confirm(`Adakah anda pasti mahu membatalkan tempahan ID ${b.id}?`)) {
                        onCancelBooking(b.id);
                      }
                    }}
                    className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 font-semibold py-1.5 px-2.5 rounded-lg transition flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Batal</span>
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full bg-white rounded-2xl p-12 text-center text-slate-500 border border-slate-200">
            <QrCode className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="font-bold text-base text-slate-700">Tiada Rekod Tempahan Ad-Hoc</p>
            <p className="text-xs text-slate-500 mt-1">Anda belum membuat sebarang tempahan ad-hoc atau tiada keputusan bagi tapisan carian.</p>
          </div>
        )}
      </div>
    </div>
  );
};
