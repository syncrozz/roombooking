import React, { useState, useEffect } from 'react';
import { Room, PurposeCategory, AdHocBooking, StaffUser } from '../types';
import { formatDateMalay, getMalayDayOfWeek, calculateDurationText } from '../utils/availabilityEngine';
import { 
  getStoredUserProfiles, 
  getStoredActiveUser, 
  findProfileByEmail, 
  saveActiveUser, 
  UserProfileHistory 
} from '../utils/storage';
import { verifyStaffCredentialsLocally } from '../lib/firebase';
import { INITIAL_STAFF_DATA } from '../data/staffData';
import { 
  Building, 
  Calendar, 
  Clock, 
  User, 
  Tag, 
  Users, 
  CheckCircle2, 
  X, 
  Sparkles,
  ArrowRight,
  Mail,
  Phone,
  Check,
  AlertCircle,
  Zap,
  KeyRound,
  ShieldCheck
} from 'lucide-react';

interface BookingModalProps {
  room: Room;
  date: string;
  startTime: string;
  endTime: string;
  initialPurpose: PurposeCategory;
  staffList?: StaffUser[];
  onClose: () => void;
  onSubmitBooking: (bookingData: Omit<AdHocBooking, 'id' | 'status' | 'createdAt'>) => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  room,
  date,
  startTime,
  endTime,
  initialPurpose,
  staffList = INITIAL_STAFF_DATA,
  onClose,
  onSubmitBooking
}) => {
  const [savedProfiles, setSavedProfiles] = useState<UserProfileHistory[]>([]);

  const [applicantName, setApplicantName] = useState<string>('Ahmad Khairi Bin Mohd');
  const [applicantEmail, setApplicantEmail] = useState<string>('khaikerr@gmail.com');
  const [passcode, setPasscode] = useState<string>('3756');
  const [applicantPhone, setApplicantPhone] = useState<string>('014-5313756');
  const [applicantRole, setApplicantRole] = useState<string>('Pensyarah');
  const [department, setDepartment] = useState<string>('Pengajian Am');
  const [purposeCategory, setPurposeCategory] = useState<PurposeCategory>(initialPurpose);
  const [title, setTitle] = useState<string>(`Penggunaan ${room.code} - Sesi Amali / Pengajaran`);
  const [paxCount, setPaxCount] = useState<number>(Math.min(room.capacity, 28));
  const [notes, setNotes] = useState<string>('Memerlukan projektor & capaian Wi-Fi');

  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Load active user profile on mount
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const activeUser = getStoredActiveUser();
    const profiles = getStoredUserProfiles();
    setSavedProfiles(profiles);

    if (activeUser && activeUser.applicantEmail) {
      setApplicantName(activeUser.applicantName);
      setApplicantEmail(activeUser.applicantEmail);
      setApplicantRole(activeUser.applicantRole || 'Pensyarah');
      setDepartment(activeUser.department || 'Pengajian Am');
      if (activeUser.applicantPhone) setApplicantPhone(activeUser.applicantPhone);
    }
  }, []);

  const handleEmailInputChange = (val: string) => {
    setApplicantEmail(val);
    setVerificationError(null);
    // Auto-match staff from CSV
    const match = staffList.find(s => s.email.toLowerCase() === val.trim().toLowerCase());
    if (match) {
      setApplicantName(match.name);
      setApplicantRole(match.role);
      setDepartment(match.department);
      setApplicantPhone(match.phone);
      setPasscode(match.passcode);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setVerificationError(null);

    // Verify combination of Email and 4-digit Passcode in Firebase CSV staff database
    const verifyResult = verifyStaffCredentialsLocally(applicantEmail, passcode, staffList);

    if (!verifyResult.success || !verifyResult.staff) {
      setVerificationError(
        verifyResult.errorMsg || 
        'Pengesahan Gagal: E-mel dan passcode 4-digit telefon tidak berpadanan dengan pangkalan data CSV KPMBP dalam Firebase.'
      );
      return;
    }

    const verifiedStaff = verifyResult.staff;

    // Save active user profile
    saveActiveUser({
      applicantName: verifiedStaff.name,
      applicantEmail: verifiedStaff.email,
      applicantPhone: verifiedStaff.phone,
      applicantRole: verifiedStaff.role,
      department: verifiedStaff.department
    });

    onSubmitBooking({
      roomId: room.id,
      roomName: room.name,
      date,
      startTime,
      endTime,
      applicantName: verifiedStaff.name,
      applicantEmail: verifiedStaff.email,
      applicantPhone: verifiedStaff.phone,
      applicantRole: verifiedStaff.role,
      department: verifiedStaff.department,
      purposeCategory,
      title,
      paxCount,
      notes
    });
  };

  const isLargeVenue = 
    room.code.toUpperCase().includes('DKA') ||
    room.code.toUpperCase().includes('DKB') ||
    room.name.toUpperCase().includes('DEWAN') ||
    room.name.toUpperCase().includes('SEMINAR') ||
    room.category === 'Dewan Kuliah' ||
    room.category === 'Ruang Khas';

  const applyProfile = (profile: UserProfileHistory) => {
    setApplicantName(profile.applicantName);
    setApplicantEmail(profile.applicantEmail);
    setApplicantRole(profile.applicantRole || 'Pensyarah');
    setDepartment(profile.department || 'Pengajian Am');
    if (profile.applicantPhone) setApplicantPhone(profile.applicantPhone);
    setVerificationError(null);
    const match = staffList.find(s => s.email.toLowerCase() === profile.applicantEmail.toLowerCase());
    if (match) {
      setPasscode(match.passcode);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-150 my-8">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-sm border border-blue-300">
              {room.code}
            </div>
            <div>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Borang Tempahan Ruang KPMBP</span>
              <h3 className="text-xl font-extrabold text-slate-900">{room.name}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Slot Summary Card */}
        <div className="bg-slate-900 text-white rounded-xl p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-blue-400 font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Ruang Disahkan Available
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800 text-slate-300">
            <div>
              <span className="text-slate-400 block text-[10px]">Tarikh:</span>
              <strong className="text-white">{formatDateMalay(date)} ({getMalayDayOfWeek(date)})</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Masa Tempahan:</span>
              <strong className="text-blue-300">{startTime} – {endTime} ({calculateDurationText(startTime, endTime)})</strong>
            </div>
          </div>
        </div>

        {/* Auto-Suggestion Pills from Stored Profiles */}
        {savedProfiles.length > 0 && (
          <div className="bg-blue-50/60 rounded-xl p-2.5 border border-blue-100 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-blue-900">
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-blue-600 fill-blue-600" />
                Cadangan Detail Peribadi Autosuggestion:
              </span>
              <span className="text-[10px] text-blue-600 font-normal">Klik untuk auto-isi</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {savedProfiles.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyProfile(p)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition flex items-center gap-1.5 ${
                    applicantEmail.toLowerCase() === p.applicantEmail.toLowerCase()
                      ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:text-blue-700'
                  }`}
                >
                  <User className="w-3 h-3 opacity-70" />
                  <span>{p.applicantName.split(' ')[0]} ({p.applicantEmail})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          
          {/* Email and 4-digit Passcode Verification Block */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between text-slate-800 font-bold border-b border-slate-200 pb-1.5">
              <span className="flex items-center gap-1.5 text-blue-700">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Pengesahan Identiti Staf (CSV Firebase)
              </span>
              <span className="text-[10px] text-slate-500 font-normal">Wajib Diisi</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>E-mel Pengguna:</span>
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="email"
                    required
                    placeholder="khaikerr@gmail.com"
                    value={applicantEmail}
                    onChange={(e) => handleEmailInputChange(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-2 py-1.5 text-slate-900 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Passcode (4 Digit Telefon):</span>
                  <span className="text-[10px] text-amber-600 font-semibold">cth: 3756</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="password"
                    maxLength={4}
                    required
                    placeholder="3756"
                    value={passcode}
                    onChange={(e) => {
                      setPasscode(e.target.value);
                      setVerificationError(null);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-2 py-1.5 text-slate-900 font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {verificationError && (
              <div className="text-[11px] text-red-700 bg-red-50 p-2 rounded-lg border border-red-200 font-semibold flex items-start gap-1.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{verificationError}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nama Pemohon / Staff:</label>
              <input
                type="text"
                required
                readOnly
                value={applicantName}
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold outline-none cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">No. Telefon / WhatsApp:</label>
              <input
                type="text"
                readOnly
                value={applicantPhone}
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium outline-none cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Jawatan / Peranan:</label>
              <input
                type="text"
                readOnly
                value={applicantRole}
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium outline-none cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Jabatan / Unit:</label>
              <input
                type="text"
                readOnly
                value={department}
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium outline-none cursor-not-allowed"
              />
            </div>
          </div>

          <div className={isLargeVenue ? "grid grid-cols-2 gap-2" : "w-full"}>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Kategori Tujuan:</label>
              <select
                value={purposeCategory}
                onChange={(e) => setPurposeCategory(e.target.value as PurposeCategory)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Penggunaan Pensyarah">Penggunaan Pensyarah</option>
                <option value="Aktiviti Akademik">Aktiviti Akademik</option>
                <option value="Program">Program / Event</option>
                <option value="Mesyuarat">Mesyuarat Jabatan</option>
                <option value="Aktiviti Pelajar">Aktiviti Pelajar</option>
                <option value="Lain-lain">Lain-lain</option>
              </select>
            </div>

            {isLargeVenue && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Anggaran Hadirin (Pax):</label>
                <input
                  type="number"
                  max={room.capacity}
                  min={1}
                  value={paxCount}
                  onChange={(e) => setPaxCount(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Tajuk / Tujuan Tempahan:</label>
            <input
              type="text"
              required
              placeholder="cth: Penggunaan Smart Classroom untuk Amali DIA 4C"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Catatan Tambahan:</label>
            <input
              type="text"
              placeholder="cth: Memerlukan mikrofon tambahan"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition"
            >
              Batal
            </button>

            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg shadow-md shadow-blue-200 transition flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>HANTAR TEMPAHAN SEKARANG</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

