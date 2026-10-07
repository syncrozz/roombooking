import React, { useState, useEffect } from 'react';
import { 
  Room, 
  PurposeCategory, 
  AdHocBooking, 
  StaffUser,
  AcademicScheduleSlot,
  InstitutionalBlock 
} from '../types';
import { 
  formatDateMalay, 
  getMalayDayOfWeek, 
  calculateDurationText, 
  checkRoomAvailability,
  parseTimeMinutes 
} from '../utils/availabilityEngine';
import { 
  validateBookingTime, 
  isTimeRangeNight,
  isNightTime,
  minutesToTimeString 
} from '../utils/timeSlots';
import { 
  getStoredUserProfiles, 
  getStoredActiveUser, 
  findProfileByEmail, 
  saveActiveUser, 
  UserProfileHistory 
} from '../utils/storage';
import { verifyStaffCredentialsLocally } from '../lib/firebase';
import { INITIAL_STAFF_DATA } from '../data/staffData';
import { ForgotPinHelp } from './ForgotPinHelp';
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
  ShieldCheck,
  Moon,
  Sun,
  Lock
} from 'lucide-react';

interface BookingModalProps {
  room: Room;
  date: string;
  startTime: string;
  endTime: string;
  initialPurpose: PurposeCategory;
  staffList?: StaffUser[];
  academicSchedule?: AcademicScheduleSlot[];
  adhocBookings?: AdHocBooking[];
  institutionalBlocks?: InstitutionalBlock[];
  onClose: () => void;
  onSubmitBooking: (bookingData: Omit<AdHocBooking, 'id' | 'status' | 'createdAt'>) => void;
  onRequirePinChange?: (staff: StaffUser) => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  room,
  date,
  startTime,
  endTime,
  initialPurpose,
  staffList = INITIAL_STAFF_DATA,
  academicSchedule = [],
  adhocBookings = [],
  institutionalBlocks = [],
  onClose,
  onSubmitBooking,
  onRequirePinChange
}) => {
  // Compute default end time: prefer 2 hours (120 mins) if available, fallback to endTime
  const computeInitialEndTime = () => {
    const startMin = parseTimeMinutes(startTime);
    const twoHoursEndMin = startMin + 120;
    const isNight = isTimeRangeNight(startTime, endTime);
    const maxEndMin = isNight ? 1380 : 1110; // 23:00 for night, 18:30 for day

    if (twoHoursEndMin <= maxEndMin) {
      const twoHoursStr = minutesToTimeString(twoHoursEndMin);
      if (academicSchedule.length > 0 || adhocBookings.length > 0 || institutionalBlocks.length > 0) {
        const check = checkRoomAvailability(
          room,
          date,
          startTime,
          twoHoursStr,
          academicSchedule,
          adhocBookings,
          institutionalBlocks
        );
        if (check.status === 'AVAILABLE') {
          return twoHoursStr;
        }
      } else {
        return twoHoursStr;
      }
    }
    return endTime;
  };

  const [selectedStartTime, setSelectedStartTime] = useState<string>(startTime);
  const [selectedEndTime, setSelectedEndTime] = useState<string>(computeInitialEndTime);

  const [applicantName, setApplicantName] = useState<string>('Ahmad Khairi Bin Mohd');
  const [applicantEmail, setApplicantEmail] = useState<string>('khaikerr@gmail.com');
  const [pinInput, setPinInput] = useState<string>('1234');
  const [applicantPhone, setApplicantPhone] = useState<string>('014-5313756');
  const [applicantRole, setApplicantRole] = useState<string>('Pensyarah');
  const [department, setDepartment] = useState<string>('Pengajian Am');
  const [purposeCategory, setPurposeCategory] = useState<PurposeCategory>(initialPurpose || 'Kelas');
  const [paxCount, setPaxCount] = useState<number>(Math.min(room.capacity, 28));
  const [notes, setNotes] = useState<string>('');

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

    if (activeUser && activeUser.applicantEmail) {
      setApplicantName(activeUser.applicantName);
      setApplicantEmail(activeUser.applicantEmail);
      setApplicantRole(activeUser.applicantRole || 'Pensyarah');
      setDepartment(activeUser.department || 'Pengajian Am');
      if (activeUser.applicantPhone) setApplicantPhone(activeUser.applicantPhone);
    }
  }, [staffList]);

  const handleEmailInputChange = (val: string) => {
    setApplicantEmail(val);
    setVerificationError(null);
    // Auto-match staff metadata from list (without populating PIN)
    const match = staffList.find(s => s.email.toLowerCase() === val.trim().toLowerCase());
    if (match) {
      setApplicantName(match.name);
      setApplicantRole(match.role);
      setDepartment(match.department);
      setApplicantPhone(match.phone);
    }
  };

  const isNightBooking = isTimeRangeNight(selectedStartTime, selectedEndTime);
  const startMinutes = parseTimeMinutes(selectedStartTime);
  const maxEndMinutes = isNightBooking ? 1380 : 1110; // 23:00 max night, 18:30 max day

  // Pre-calculate 1 to 4 hour duration options
  const durationOptions = [1, 2, 3, 4]
    .map(hours => {
      const endMin = startMinutes + hours * 60;
      if (endMin > maxEndMinutes) return null;
      const endStr = minutesToTimeString(endMin);
      let isAvailable = true;
      let conflictReason: string | undefined;

      if (academicSchedule.length > 0 || adhocBookings.length > 0 || institutionalBlocks.length > 0) {
        const check = checkRoomAvailability(
          room,
          date,
          selectedStartTime,
          endStr,
          academicSchedule,
          adhocBookings,
          institutionalBlocks
        );
        isAvailable = check.status === 'AVAILABLE';
        conflictReason = check.conflictReason;
      }

      return {
        hours,
        endTime: endStr,
        isPopular: hours === 2,
        isAvailable,
        conflictReason
      };
    })
    .filter(Boolean) as {
      hours: number;
      endTime: string;
      isPopular: boolean;
      isAvailable: boolean;
      conflictReason?: string;
    }[];

  // All potential valid end times for dropdown
  const allValidEndTimes = [
    ...(isNightBooking
      ? ['21:00', '22:00', '23:00']
      : ['09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:30', '17:30', '18:30']
    )
  ]
    .filter(t => parseTimeMinutes(t) > startMinutes && parseTimeMinutes(t) <= maxEndMinutes)
    .map(t => {
      let isAvailable = true;
      if (academicSchedule.length > 0 || adhocBookings.length > 0 || institutionalBlocks.length > 0) {
        const check = checkRoomAvailability(
          room,
          date,
          selectedStartTime,
          t,
          academicSchedule,
          adhocBookings,
          institutionalBlocks
        );
        isAvailable = check.status === 'AVAILABLE';
      }
      return { value: t, isAvailable };
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setVerificationError(null);

    // Validate booking time with centralized SES v4.4 engine
    const timeValidation = validateBookingTime(selectedStartTime, selectedEndTime);
    if (!timeValidation.isValid) {
      setVerificationError(timeValidation.errorMsg || 'Masa tempahan tidak sah.');
      return;
    }

    if (isNightBooking && room.allowNightBooking === false) {
      setVerificationError(`Ruang ${room.code} tidak dibenarkan untuk tempahan waktu malam.`);
      return;
    }

    // Availability validation for selected duration
    if (academicSchedule.length > 0 || adhocBookings.length > 0 || institutionalBlocks.length > 0) {
      const availCheck = checkRoomAvailability(
        room,
        date,
        selectedStartTime,
        selectedEndTime,
        academicSchedule,
        adhocBookings,
        institutionalBlocks
      );
      if (availCheck.status !== 'AVAILABLE') {
        setVerificationError(availCheck.conflictReason || 'Slot masa yang dipilih telah mempunyai pertembungan jadual atau sekatan.');
        return;
      }
    }

    // Verify combination of Email and 4-digit PIN in Firebase staff database
    const verifyResult = verifyStaffCredentialsLocally(applicantEmail, pinInput, staffList);

    if (!verifyResult.success || !verifyResult.staff) {
      setVerificationError(
        verifyResult.errorMsg || 
        'Email atau PIN tidak sah.'
      );
      return;
    }

    const verifiedStaff = verifyResult.staff;

    // Check mandatory PIN change if still on default PIN 1234
    if (verifiedStaff.pinStatus === 'DEFAULT' || verifiedStaff.pin === '1234') {
      if (onRequirePinChange) {
        onRequirePinChange(verifiedStaff);
      }
      return;
    }

    // Save active user profile
    saveActiveUser({
      staffId: verifiedStaff.id,
      applicantName: verifiedStaff.name,
      applicantEmail: verifiedStaff.email,
      applicantPhone: verifiedStaff.phone,
      applicantRole: verifiedStaff.role,
      department: verifiedStaff.department,
      pinStatus: verifiedStaff.pinStatus
    });

    onSubmitBooking({
      roomId: room.id,
      roomName: room.name,
      date,
      startTime: selectedStartTime,
      endTime: selectedEndTime,
      applicantName: verifiedStaff.name,
      applicantEmail: verifiedStaff.email,
      applicantPhone: verifiedStaff.phone,
      applicantRole: verifiedStaff.role,
      department: verifiedStaff.department,
      purposeCategory,
      title: `${purposeCategory} (${room.code})`,
      paxCount,
      notes: notes.trim() || undefined
    });
  };

  const isLargeVenue = 
    room.code.toUpperCase().includes('DKA') ||
    room.code.toUpperCase().includes('DKB') ||
    room.name.toUpperCase().includes('DEWAN') ||
    room.name.toUpperCase().includes('SEMINAR') ||
    room.category === 'Dewan Kuliah' ||
    room.category === 'Ruang Khas';

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-150 my-8">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Borang Tempahan Ruang KPMBP</span>
            <h3 className="text-xl font-extrabold text-slate-900">{room.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Slot Summary Card */}
        <div className={`rounded-xl p-3.5 space-y-2 text-xs border ${
          isNightBooking 
            ? 'bg-slate-900 border-indigo-500/50 text-white' 
            : 'bg-slate-900 border-slate-800 text-white'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-blue-400 font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Ruang Disahkan Available
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
              isNightBooking
                ? 'bg-indigo-950 text-indigo-300 border border-indigo-700'
                : 'bg-amber-950 text-amber-300 border border-amber-700'
            }`}>
              {isNightBooking ? (
                <>
                  <Moon className="w-2.5 h-2.5" /> Sesi Malam (20:00 – 23:00)
                </>
              ) : (
                <>
                  <Sun className="w-2.5 h-2.5" /> Sesi Siang (08:30 – 16:30)
                </>
              )}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800 text-slate-300">
            <div>
              <span className="text-slate-400 block text-[10px]">Tarikh:</span>
              <strong className="text-white">{formatDateMalay(date)} ({getMalayDayOfWeek(date)})</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Masa Tempahan:</span>
              <strong className={isNightBooking ? "text-indigo-300" : "text-blue-300"}>
                {selectedStartTime} – {selectedEndTime} ({calculateDurationText(selectedStartTime, selectedEndTime)})
              </strong>
            </div>
          </div>

          {/* Quick Duration Selection (1 Jam, 2 Jam Lalai/Biasa, 3 Jam, 4 Jam) */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                Pilihan Tempoh Tempahan:
              </span>
              <span className="text-[10px] text-amber-300 font-semibold bg-amber-950/60 border border-amber-800/80 px-2 py-0.5 rounded-full">
                ⭐ Biasanya 2 Jam (Sesi Kuliah)
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {durationOptions.map(opt => {
                const isSelected = selectedEndTime === opt.endTime;
                const isAvail = opt.isAvailable;
                return (
                  <button
                    key={opt.hours}
                    type="button"
                    disabled={!isAvail}
                    onClick={() => {
                      setSelectedEndTime(opt.endTime);
                      setVerificationError(null);
                    }}
                    className={`py-1.5 px-1 rounded-xl text-center transition font-bold text-[11px] cursor-pointer flex flex-col items-center justify-center relative ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400/60'
                        : isAvail
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-95'
                        : 'bg-slate-900/60 text-slate-500 border border-slate-800/80 cursor-not-allowed opacity-40'
                    }`}
                    title={isAvail ? `${opt.hours} Jam (${selectedStartTime} – ${opt.endTime})` : (opt.conflictReason || 'Slot bertembung')}
                  >
                    <span className="flex items-center gap-0.5 leading-tight">
                      {opt.hours} Jam
                      {opt.isPopular && <span className="text-amber-300 text-[10px]">★</span>}
                    </span>
                    <span className="text-[9.5px] font-normal opacity-80 leading-tight">
                      hingga {opt.endTime}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Custom End Time Dropdown if needed */}
            <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
              <label htmlFor="modal-custom-end-time" className="text-[10px]">
                Atau pilih Masa Tamat tersuai:
              </label>
              <select
                id="modal-custom-end-time"
                value={selectedEndTime}
                onChange={(e) => {
                  setSelectedEndTime(e.target.value);
                  setVerificationError(null);
                }}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono text-[11px] outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {allValidEndTimes.map(t => (
                  <option key={t.value} value={t.value} disabled={!t.isAvailable}>
                    {t.value} ({calculateDurationText(selectedStartTime, t.value)}) {!t.isAvailable ? '— Bertembung' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isNightBooking && (
            <div className="pt-1.5 border-t border-slate-800/80 text-[10px] text-indigo-200/90 flex items-center gap-1.5">
              <Moon className="w-3 h-3 text-indigo-400 shrink-0" />
              <span>Peringatan Waktu Malam: Maksimum sehingga 23:00. Sila pastikan suis lampu &amp; pendingin hawa ditutup selepas sesi tamat.</span>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          
          {/* Authentication Block: Log Masuk */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center text-slate-800 font-bold border-b border-slate-200 pb-1.5">
              <span className="flex items-center gap-1.5 text-slate-900 text-xs">
                <Lock className="w-3.5 h-3.5 text-blue-600" />
                Log Masuk
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  E-mel
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="email"
                    required
                    placeholder="nama@mara.gov.my"
                    value={applicantEmail}
                    onChange={(e) => handleEmailInputChange(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-2 py-1.5 text-slate-900 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700">
                    PIN
                  </label>
                  <ForgotPinHelp />
                </div>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    required
                    placeholder="••••"
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                      setVerificationError(null);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-2 py-1.5 text-slate-900 font-mono font-bold tracking-widest outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {verificationError && (
              <div className="text-[11px] text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-200 font-semibold space-y-1.5 animate-fadeIn">
                <div className="flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{verificationError}</span>
                </div>
                <div className="pt-1 border-t border-red-200/60">
                  <ForgotPinHelp />
                </div>
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
                <option value="Kelas">Kelas</option>
                <option value="Kelas Ganti">Kelas Ganti</option>
                <option value="Konsultasi">Konsultasi</option>
                <option value="Mesyuarat">Mesyuarat</option>
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
            <label className="block font-bold text-slate-700 mb-1">
              Catatan Tambahan <span className="text-slate-400 font-normal text-[11px]">(Pilihan)</span>:
            </label>
            <input
              type="text"
              placeholder="cth: Memerlukan mikrofon tambahan (jika ada)"
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

