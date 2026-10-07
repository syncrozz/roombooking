import React, { useState, useEffect } from 'react';
import { AdHocBooking, BookingStatus, StaffUser } from '../types';
import { formatDateMalay, formatWhatsAppMessage, generateWhatsAppLink, exportBookingsToCSV } from '../utils/availabilityEngine';
import { verifyStaffCredentialsLocally } from '../lib/firebase';
import { INITIAL_STAFF_DATA } from '../data/staffData';
import { getStoredActiveUser, saveActiveUser, clearActiveUser, subscribeToActiveUser, UserProfileHistory } from '../utils/storage';
import { WhatsAppIcon } from './WhatsAppIcon';
import { ForgotPinHelp } from './ForgotPinHelp';
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
  AlertCircle,
  ShieldCheck,
  Lock,
  LogIn,
  LogOut,
  UserCheck,
  Sparkles,
  Download,
  FileSpreadsheet
} from 'lucide-react';

interface MyBookingsViewProps {
  bookings: AdHocBooking[];
  staffList?: StaffUser[];
  isAdmin?: boolean;
  onOpenQRModal: (booking: AdHocBooking) => void;
  onCancelBooking: (bookingId: string) => void;
  onRequirePinChange?: (staff: StaffUser) => void;
}

export const MyBookingsView: React.FC<MyBookingsViewProps> = ({
  bookings,
  staffList = INITIAL_STAFF_DATA,
  isAdmin = false,
  onOpenQRModal,
  onCancelBooking,
  onRequirePinChange
}) => {
  const [currentUser, setCurrentUser] = useState<UserProfileHistory | null>(() => getStoredActiveUser());
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'Semua'>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Admin view scope: 'mine' (own bookings) or 'all' (all staff bookings - admin mode only)
  const [adminViewScope, setAdminViewScope] = useState<'mine' | 'all'>('mine');

  // Inline Quick Login state for unauthenticated users
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPin, setLoginPin] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Security Cancel Verification Modal state
  const [targetCancelBooking, setTargetCancelBooking] = useState<AdHocBooking | null>(null);
  const [cancelPinInput, setCancelPinInput] = useState<string>('');
  const [cancelErrorMsg, setCancelErrorMsg] = useState<string | null>(null);

  // Listen to active user changes
  useEffect(() => {
    const handleUserSync = (user: UserProfileHistory | null) => {
      setCurrentUser(user || getStoredActiveUser());
    };
    const unsubscribe = subscribeToActiveUser(handleUserSync);
    return () => {
      unsubscribe();
    };
  }, []);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && targetCancelBooking) {
        setTargetCancelBooking(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [targetCancelBooking]);

  // Handle Quick Login
  const handleQuickLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const result = verifyStaffCredentialsLocally(loginEmail, loginPin, staffList);
    if (!result.success || !result.staff) {
      setLoginError(result.errorMsg || 'Email atau PIN tidak sah.');
      return;
    }

    const st = result.staff;

    // Mandatory PIN Change Check if still on default PIN 1234
    if (st.pinStatus === 'DEFAULT' || st.pin === '1234') {
      if (onRequirePinChange) {
        onRequirePinChange(st);
      }
      return;
    }

    const profile: UserProfileHistory = {
      staffId: st.id,
      applicantName: st.name,
      applicantEmail: st.email,
      applicantRole: st.role,
      department: st.department,
      applicantPhone: st.phone,
      lastUsedAt: new Date().toISOString(),
      pinStatus: st.pinStatus
    };

    saveActiveUser(profile);
    setCurrentUser(profile);
    setLoginError(null);
  };

  const handleLogout = () => {
    clearActiveUser();
    setCurrentUser(null);
  };

  // Helper: check if a booking belongs to the current user
  const isBookingOwnedByCurrentUser = (booking: AdHocBooking): boolean => {
    if (!currentUser) return false;
    const userEmail = currentUser.applicantEmail?.toLowerCase().trim();
    const bookingEmail = booking.applicantEmail?.toLowerCase().trim();
    if (userEmail && bookingEmail) {
      return userEmail === bookingEmail;
    }
    const userName = currentUser.applicantName?.toLowerCase().trim();
    const bookingName = booking.applicantName?.toLowerCase().trim();
    return Boolean(userName && bookingName && userName === bookingName);
  };

  // Helper: check if user can cancel this booking (Owner or Admin)
  const canUserCancelBooking = (booking: AdHocBooking): boolean => {
    if (isAdmin) return true;
    return isBookingOwnedByCurrentUser(booking);
  };

  // Base list of bookings according to view settings
  // If user is logged in and not in admin 'all' view: show strictly OWN bookings
  // If admin is in 'all' view: show all bookings
  // If not logged in and is admin: show all bookings or empty
  // If not logged in and not admin: show empty list with login prompt
  const scopedBookings = React.useMemo(() => {
    if (isAdmin && adminViewScope === 'all') {
      return bookings;
    }
    if (currentUser) {
      return bookings.filter(b => isBookingOwnedByCurrentUser(b));
    }
    if (isAdmin) {
      return bookings;
    }
    return [];
  }, [bookings, currentUser, isAdmin, adminViewScope]);

  // Filter scoped bookings by status & search
  const filteredBookings = scopedBookings.filter(b => {
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
    if (!canUserCancelBooking(booking)) {
      alert('Akses Ditolak: Hanya pemilik tempahan ini atau Pentadbir dibenarkan membatalkan tempahan.');
      return;
    }
    setTargetCancelBooking(booking);
    setCancelPinInput('');
    setCancelErrorMsg(null);
  };

  const handleConfirmCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCancelBooking) return;

    // 1. If Admin: allow direct cancellation
    if (isAdmin) {
      onCancelBooking(targetCancelBooking.id);
      setTargetCancelBooking(null);
      return;
    }

    // 2. If Owner: verify PIN for security confirmation
    if (currentUser && isBookingOwnedByCurrentUser(targetCancelBooking)) {
      // Find staff in staffList to check PIN
      const staffMember = staffList.find(
        s => s.email.toLowerCase().trim() === currentUser.applicantEmail.toLowerCase().trim()
      );
      
      const expectedPin = staffMember?.pin || '1234';
      const cleanInput = cancelPinInput.trim();

      if (cleanInput === expectedPin) {
        onCancelBooking(targetCancelBooking.id);
        setTargetCancelBooking(null);
      } else {
        setCancelErrorMsg('PIN tidak sah. Sila masukkan 4-digit PIN keselamatan anda untuk pengesahan pembatalan.');
      }
      return;
    }

    // 3. Fallback: Not authorized
    setCancelErrorMsg('Hanya pemilik tempahan ini atau Pentadbir yang dibenarkan membatalkan tempahan.');
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Card with Personal Identity / Security Scope */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-md border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200 mb-1">
              <QrCode className="w-3.5 h-3.5" />
              <span>Mod Privasi Tempahan Staf</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Tempahan Saya & Pas Akses QR
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm mt-0.5">
              {currentUser 
                ? `Memaparkan rekod tempahan peribadi milik ${currentUser.applicantName}. Hanya anda dan pentadbir boleh membuat pembatalan.`
                : 'Sila log masuk profil staf anda di bawah untuk memaparkan dan mengurus tempahan anda sendiri.'}
            </p>
          </div>

          {/* Counts */}
          <div className="flex gap-2 shrink-0">
            <div className="bg-emerald-900 text-white px-4 py-2.5 rounded-xl text-center shadow-xs">
              <div className="text-[10px] text-emerald-300 uppercase tracking-wider font-semibold">Disahkan</div>
              <div className="text-lg font-bold">
                {scopedBookings.filter(b => b.status === 'CONFIRMED').length}
              </div>
            </div>
            <div className="bg-amber-900 text-white px-4 py-2.5 rounded-xl text-center shadow-xs">
              <div className="text-[10px] text-amber-300 uppercase tracking-wider font-semibold">Menunggu</div>
              <div className="text-lg font-bold">
                {scopedBookings.filter(b => b.status === 'PENDING').length}
              </div>
            </div>
          </div>
        </div>

        {/* User Identity Banner or Admin Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
          {currentUser ? (
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                <UserCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 truncate">{currentUser.applicantName}</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold shrink-0">
                    Pemilik Sah
                  </span>
                </div>
                <div className="text-slate-500 text-[11px] truncate">
                  {currentUser.applicantEmail} • {currentUser.department} ({currentUser.applicantRole})
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-600">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-semibold text-slate-800">
                Akaun staf belum dipilih. Sila log masuk untuk melihat tempahan peribadi anda.
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg border border-slate-300 text-xs">
                <button
                  type="button"
                  onClick={() => setAdminViewScope('mine')}
                  className={`px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1 ${
                    adminViewScope === 'mine'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                  title="Papar tempahan sendiri sahaja"
                >
                  <User className="w-3 h-3" />
                  <span>Tempahan Saya</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdminViewScope('all')}
                  className={`px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1 ${
                    adminViewScope === 'all'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                  title="Papar semua tempahan staf (Akses Pentadbir)"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Semua Staf (Admin)</span>
                </button>
              </div>
            )}

            {currentUser && (
              <button
                type="button"
                onClick={handleLogout}
                className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-slate-900 font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer"
                title="Log keluar akaun untuk tukar pengguna"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Tukar Akaun</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
            <button
              onClick={() => setStatusFilter('Semua')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                statusFilter === 'Semua' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({scopedBookings.length})
            </button>
            <button
              onClick={() => setStatusFilter('CONFIRMED')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                statusFilter === 'CONFIRMED' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🟢 Disahkan ({scopedBookings.filter(b => b.status === 'CONFIRMED').length})
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                statusFilter === 'PENDING' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🟡 Menunggu ({scopedBookings.filter(b => b.status === 'PENDING').length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {scopedBookings.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const res = exportBookingsToCSV(
                    filteredBookings.length > 0 ? filteredBookings : scopedBookings,
                    currentUser ? `kpmbp_tempahan_${(currentUser.staffId || 'staf').toLowerCase()}` : 'kpmbp_tempahan_adhoc'
                  );
                  if (res.success) {
                    alert(`✅ ${res.count} rekod tempahan berjaya dieksport ke fail: ${res.filename}`);
                  }
                }}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                title="Muat turun senarai tempahan yang dipaparkan ke fail CSV"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Eksport CSV ({filteredBookings.length})</span>
              </button>
            )}

            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari ID (BK-2026-...), ruang..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Unauthenticated Banner & Inline Login */}
      {!currentUser && !isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-xs">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                Log Masuk Staf Diperlukan Untuk Paparan Tempahan Peribadi
              </h3>
              <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                Bagi memastikan privasi maklumat rasmi kolej dan perlindungan data staf, halaman ini tidak lagi memaparkan senarai terbuka semua staf. Sila sahkan akaun anda untuk melihat tempahan ad-hoc dan pas QR anda.
              </p>
            </div>
          </div>

          <form onSubmit={handleQuickLogin} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
            <div className="text-xs font-bold text-slate-800 flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="flex items-center gap-1.5 text-slate-900">
                <Lock className="w-3.5 h-3.5 text-blue-600" />
                Log Masuk Staf
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">E-mel</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="nama@mara.gov.my"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-slate-800 font-medium outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">PIN</label>
                  <ForgotPinHelp />
                </div>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    required
                    value={loginPin}
                    onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-slate-800 font-mono font-bold tracking-widest outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{loginError}</span>
                </div>
                <div className="bg-white border border-rose-200 rounded-lg p-2.5 space-y-1 text-slate-700 font-normal">
                  <p className="font-bold text-slate-900">Terlupa PIN?</p>
                  <p className="text-[11px] text-slate-600">Sila hubungi Admin untuk bantuan mendapatkan semula akses.</p>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <span className="font-mono text-slate-600 text-[10px]">WhatsApp Admin: 014-5313756</span>
                    <a
                      href="https://wasap.my/60145313756"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-[10px] rounded-md shadow-xs transition flex items-center gap-1 shrink-0"
                    >
                      <WhatsAppIcon className="w-3 h-3" />
                      <span>WhatsApp Admin</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sahkan & Lihat Tempahan Saya</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Bookings Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredBookings.length > 0 ? (
          filteredBookings.map(b => {
            const isConfirmed = b.status === 'CONFIRMED';
            const isPending = b.status === 'PENDING';
            const isOwner = isBookingOwnedByCurrentUser(b);
            const canCancel = canUserCancelBooking(b);

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
                      {isOwner && (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded text-[10px] font-bold">
                          Tempahan Anda
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Room & Time Details Box */}
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2 text-xs text-slate-700">
                    <div>
                      <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <Building className="w-4 h-4 text-emerald-600" />
                        {b.roomName} ({b.roomId})
                      </span>
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
                      className={`font-bold py-2 px-3 rounded-lg shadow-xs transition flex items-center gap-1.5 border cursor-pointer ${
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
                      className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-3 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Pas QR</span>
                    </button>
                  </div>

                  {/* Cancel Button - Exclusively for Owner or Admin */}
                  {canCancel ? (
                    <button
                      onClick={() => handleOpenCancelModal(b)}
                      className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 font-semibold py-1.5 px-2.5 rounded-lg transition flex items-center gap-1 border border-rose-200 cursor-pointer"
                      title={isAdmin && !isOwner ? "Batal tempahan ini sebagai Pentadbir" : "Batal tempahan anda"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isAdmin && !isOwner ? 'Batal (Admin)' : 'Batal'}</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 text-slate-400 text-[11px] py-1 px-2 bg-slate-100 rounded-lg" title="Hanya pemilik tempahan atau Admin boleh membatalkan">
                      <Lock className="w-3 h-3" />
                      <span>Hanya Pemilik/Admin</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full bg-white rounded-2xl p-12 text-center text-slate-500 border border-slate-200">
            <QrCode className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="font-bold text-base text-slate-700">
              {currentUser 
                ? 'Tiada rekod tempahan aktif untuk akaun anda.' 
                : 'Tiada data tempahan dipaparkan.'}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {currentUser
                ? 'Sebaik sahaja anda membuat tempahan ruang kuliah melalui Cari & Tempah atau Calendar, butiran tempahan dan pas QR anda akan muncul di sini.'
                : 'Sila log masuk profil staf anda di atas untuk melihat tempahan peribadi anda.'}
            </p>
          </div>
        )}
      </div>

      {/* 4. Security Verification Modal for Cancelling Bookings */}
      {targetCancelBooking && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="font-extrabold text-slate-900 text-base">
                  {isAdmin && !isBookingOwnedByCurrentUser(targetCancelBooking)
                    ? 'Pengesahan Pembatalan (Pentadbir)'
                    : 'Pengesahan Batal Tempahan Anda'}
                </h3>
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
              <div><strong>Pemohon Rasmi:</strong> {targetCancelBooking.applicantName} {targetCancelBooking.applicantEmail ? `(${targetCancelBooking.applicantEmail})` : ''}</div>
            </div>

            {isAdmin && !isBookingOwnedByCurrentUser(targetCancelBooking) ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  <span>Kuasa Pentadbir KPMBP</span>
                </div>
                <p>
                  Sebagai Pentadbir, anda dibenarkan membatalkan tempahan ini bagi tujuan pengurusan institusi. Tempahan ini akan dipadam daripada pangkalan data.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                Adakah anda pasti ingin membatalkan tempahan ini? Sila masukkan <strong>PIN Keselamatan 4-Digit</strong> anda untuk mengesahkan:
              </p>
            )}

            <form onSubmit={handleConfirmCancel} className="space-y-3 text-xs">
              {(!isAdmin || isBookingOwnedByCurrentUser(targetCancelBooking)) && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">PIN Keselamatan (4-Digit):</label>
                  <div className="relative">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      required
                      autoFocus
                      value={cancelPinInput}
                      onChange={(e) => {
                        setCancelPinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                        setCancelErrorMsg(null);
                      }}
                      placeholder="PIN 4-digit"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-slate-900 font-mono font-bold outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div className="mt-1">
                    <ForgotPinHelp />
                  </div>
                </div>
              )}

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
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isAdmin && !isBookingOwnedByCurrentUser(targetCancelBooking) ? 'Sahkan Batal (Admin)' : 'Sahkan Pembatalan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
