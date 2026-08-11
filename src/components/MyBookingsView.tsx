import React, { useState, useEffect } from 'react';
import { AdHocBooking, BookingStatus, StaffUser } from '../types';
import { formatDateMalay, formatWhatsAppMessage, generateWhatsAppLink } from '../utils/availabilityEngine';
import { verifyStaffCredentialsLocally } from '../lib/firebase';
import { INITIAL_STAFF_DATA } from '../data/staffData';
import { WhatsAppIcon } from './WhatsAppIcon';
import { 
  QrCode, 
  Clock, 
  Calendar, 
  User, 
  Building, 
  Trash2, 
  Search,
  ExternalLink,
  Copy,
  Check,
  ShieldAlert,
  KeyRound,
  Mail,
  X,
  AlertCircle
} from 'lucide-react';

interface MyBookingsViewProps {
  bookings: AdHocBooking[];
  staffList?: StaffUser[];
  onOpenQRModal: (booking: AdHocBooking) => void;
  onCancelBooking: (bookingId: string) => void;
}

export const MyBookingsView: React.FC<MyBookingsViewProps> = ({
  bookings,
  staffList = INITIAL_STAFF_DATA,
  onOpenQRModal,
  onCancelBooking
}) => {
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'Semua'>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Security Cancel Verification Modal state
  const [targetCancelBooking, setTargetCancelBooking] = useState<AdHocBooking | null>(null);
  const [cancelEmailInput, setCancelEmailInput] = useState<string>('');
  const [cancelPasscodeInput, setCancelPasscodeInput] = useState<string>('');
  const [cancelErrorMsg, setCancelErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && targetCancelBooking) {
        setTargetCancelBooking(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [targetCancelBooking]);

  const handleCopyText = async (booking: AdHocBooking) => {
    try {
      const text = formatWhatsAppMessage(booking);
      await navigator.clipboard.writeText(text);
      setCopiedId(booking.id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch (err) {
      console.error('Failed to copy booking text:', err);
    }
  };

  const handleOpenCancelModal = (booking: AdHocBooking) => {
    setTargetCancelBooking(booking);
    setCancelEmailInput(booking.applicantEmail || '');
    setCancelPasscodeInput('');
    setCancelErrorMsg(null);
  };

  const handleConfirmCancelWithSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCancelBooking) return;

    // Verify combination of Email and 4-digit Passcode in Firebase CSV staff database
    const verifyResult = verifyStaffCredentialsLocally(cancelEmailInput, cancelPasscodeInput, staffList);

    if (!verifyResult.success || !verifyResult.staff) {
      setCancelErrorMsg(
        verifyResult.errorMsg || 
        'Pengesahan Keselamatan Gagal: Kombinasi E-mel dan passcode 4-digit telefon tidak berpadanan dengan pangkalan data CSV KPMBP dalam Firebase.'
      );
      return;
    }

    // Ensure email matches booking email (or is authorised staff)
    if (
      verifyResult.staff.email.toLowerCase() !== targetCancelBooking.applicantEmail.toLowerCase() &&
      !verifyResult.staff.role.toLowerCase().includes('pentadbir')
    ) {
      setCancelErrorMsg(`Hanya ${targetCancelBooking.applicantEmail} sahaja dibenarkan membatalkan tempahan ini.`);
      return;
    }

    // Proceed with cancel
    onCancelBooking(targetCancelBooking.id);
    setTargetCancelBooking(null);
  };

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

                  {/* Applicant Details */}
                  <div>
                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
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
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Copy Text Button */}
                    <button
                      onClick={() => handleCopyText(b)}
                      className={`font-bold py-2 px-3 rounded-lg shadow-xs transition flex items-center gap-1.5 border ${
                        copiedId === b.id
                          ? 'bg-emerald-700 text-white border-emerald-500'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                      }`}
                      title="Salin semua butiran tempahan secara teks ke clipboard"
                    >
                      {copiedId === b.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-200" />
                          <span>Disalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin Teks</span>
                        </>
                      )}
                    </button>

                    {/* WhatsApp Share Button */}
                    <a
                      href={generateWhatsAppLink(b)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-2 px-2.5 rounded-lg shadow-sm transition flex items-center gap-1 active:scale-95"
                      title="Kongsi Ringkasan Tempahan ke WhatsApp"
                    >
                      <WhatsAppIcon className="w-4 h-4 shrink-0" />
                      <ExternalLink className="w-3 h-3 text-white/80" />
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

                  {/* Cancel Button - Security Verified */}
                  <button
                    onClick={() => handleOpenCancelModal(b)}
                    className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 font-semibold py-1.5 px-2.5 rounded-lg transition flex items-center gap-1 border border-rose-200"
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

      {/* Security Verification Modal for Cancelling Bookings */}
      {targetCancelBooking && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="font-extrabold text-slate-900 text-base">Pengesahan Batal Tempahan</h3>
              </div>
              <button
                onClick={() => setTargetCancelBooking(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 space-y-1">
              <div><strong>ID Tempahan:</strong> <span className="font-mono font-bold text-slate-900">{targetCancelBooking.id}</span></div>
              <div><strong>Ruang:</strong> {targetCancelBooking.roomName}</div>
              <div><strong>Tarikh & Masa:</strong> {targetCancelBooking.date} ({targetCancelBooking.startTime} - {targetCancelBooking.endTime})</div>
              <div><strong>Pemohon Rasmi:</strong> {targetCancelBooking.applicantName} ({targetCancelBooking.applicantEmail})</div>
            </div>

            <p className="text-xs text-slate-600">
              Sila masukkan <strong>E-mel Rasmi</strong> dan <strong>Passcode 4-Digit Telefon</strong> anda untuk mengesahkan pembatalan ini:
            </p>

            <form onSubmit={handleConfirmCancelWithSecurity} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">E-mel Pengguna (CSV):</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="email"
                    required
                    value={cancelEmailInput}
                    onChange={(e) => {
                      setCancelEmailInput(e.target.value);
                      setCancelErrorMsg(null);
                    }}
                    placeholder="khaikerr@gmail.com"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-slate-900 font-bold outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Passcode (4 Digit Terakhir No. Telefon):</label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={cancelPasscodeInput}
                    onChange={(e) => {
                      setCancelPasscodeInput(e.target.value);
                      setCancelErrorMsg(null);
                    }}
                    placeholder="3756"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-slate-900 font-mono font-bold outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              {cancelErrorMsg && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-[11px] font-semibold flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{cancelErrorMsg}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTargetCancelBooking(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Sahkan Batal Tempahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
