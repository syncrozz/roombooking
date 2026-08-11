import React, { useState, useEffect } from 'react';
import { Room, PurposeCategory, AdHocBooking } from '../types';
import { formatDateMalay, getMalayDayOfWeek, calculateDurationText } from '../utils/availabilityEngine';
import { 
  getStoredUserProfiles, 
  getStoredActiveUser, 
  findProfileByEmail, 
  saveActiveUser, 
  UserProfileHistory 
} from '../utils/storage';
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
  Zap
} from 'lucide-react';

interface BookingModalProps {
  room: Room;
  date: string;
  startTime: string;
  endTime: string;
  initialPurpose: PurposeCategory;
  onClose: () => void;
  onSubmitBooking: (bookingData: Omit<AdHocBooking, 'id' | 'status' | 'createdAt'>) => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  room,
  date,
  startTime,
  endTime,
  initialPurpose,
  onClose,
  onSubmitBooking
}) => {
  const [savedProfiles, setSavedProfiles] = useState<UserProfileHistory[]>([]);
  
  const STANDARD_DEPARTMENTS = [
    'Jabatan Sains Komputer',
    'Jabatan Perdagangan',
    'Jabatan Perniagaan',
    'Jabatan Sains Sosial',
    'Jabatan Pengajian Am',
    'Jabatan Kejuruteraan',
    'Jabatan Matematik & Sains',
    'Unit Pentadbiran & Hal Ehwal Pelajar',
    'Kelab / Persatuan Pelajar'
  ];

  const isLargeVenue = 
    room.code.toUpperCase().includes('DKA') ||
    room.code.toUpperCase().includes('DKB') ||
    room.name.toUpperCase().includes('DEWAN') ||
    room.name.toUpperCase().includes('SEMINAR') ||
    room.category === 'Dewan Kuliah' ||
    room.category === 'Ruang Khas';

  const [applicantName, setApplicantName] = useState<string>('Ahmad Khairi bin Ali');
  const [applicantEmail, setApplicantEmail] = useState<string>('khairi@bpenawar.kpm.edu.my');
  const [applicantPhone, setApplicantPhone] = useState<string>('012-3456789');
  const [applicantRole, setApplicantRole] = useState<string>('Pensyarah Kanan');
  const [department, setDepartment] = useState<string>('Jabatan Sains Komputer');
  const [purposeCategory, setPurposeCategory] = useState<PurposeCategory>(initialPurpose);
  const [title, setTitle] = useState<string>(`Penggunaan ${room.code} - Sesi Amali Akademik`);
  const [paxCount, setPaxCount] = useState<number>(Math.min(room.capacity, 28));
  const [notes, setNotes] = useState<string>('Memerlukan projektor & capaian Wi-Fi');

  const [emailTouched, setEmailTouched] = useState<boolean>(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Load active user profile and saved profiles on mount
  useEffect(() => {
    const activeUser = getStoredActiveUser();
    const profiles = getStoredUserProfiles();
    setSavedProfiles(profiles);

    if (activeUser && activeUser.applicantEmail) {
      setApplicantName(activeUser.applicantName);
      setApplicantEmail(activeUser.applicantEmail);
      setApplicantRole(activeUser.applicantRole || 'Pensyarah Kanan');
      setDepartment(activeUser.department || 'Jabatan Sains Komputer');
      if (activeUser.applicantPhone) setApplicantPhone(activeUser.applicantPhone);
    } else if (profiles.length > 0) {
      const top = profiles[0];
      setApplicantName(top.applicantName);
      setApplicantEmail(top.applicantEmail);
      setApplicantRole(top.applicantRole);
      setDepartment(top.department);
      if (top.applicantPhone) setApplicantPhone(top.applicantPhone);
    }
  }, []);

  // Handle email input change with real-time device lookup
  const handleEmailInputChange = (val: string) => {
    setApplicantEmail(val);
    setEmailTouched(true);
    if (emailError) setEmailError(null);

    const match = findProfileByEmail(val);
    if (match) {
      setApplicantName(match.applicantName);
      setApplicantRole(match.applicantRole || 'Pensyarah Kanan');
      setDepartment(match.department || 'Jabatan Sains Komputer');
      if (match.applicantPhone) setApplicantPhone(match.applicantPhone);
    }
  };

  // Validate email domain format
  const isBPenawarEmail = (email: string) => {
    const clean = email.trim().toLowerCase();
    return clean.endsWith('@bpenawar.kpm.edu.my') || clean.endsWith('bpenawar.kpm.edu.my');
  };

  const applyProfile = (profile: UserProfileHistory) => {
    setApplicantName(profile.applicantName);
    setApplicantEmail(profile.applicantEmail);
    setApplicantRole(profile.applicantRole);
    setDepartment(profile.department);
    if (profile.applicantPhone) setApplicantPhone(profile.applicantPhone);
    setEmailError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);

    if (!isBPenawarEmail(applicantEmail)) {
      setEmailError('HANYA e-mel rasmi BPenawar sahaja dibenarkan! (cth: nama@bpenawar.kpm.edu.my)');
      return;
    }

    if (!applicantName.trim() || !title.trim()) {
      alert('Sila lengkapkan nama pemohon dan tajuk penggunaan!');
      return;
    }

    // Save profile as active user in device storage for future reference
    saveActiveUser({
      applicantName,
      applicantEmail: applicantEmail.trim().toLowerCase(),
      applicantPhone,
      applicantRole,
      department
    });

    onSubmitBooking({
      roomId: room.id,
      roomName: room.name,
      date,
      startTime,
      endTime,
      applicantName,
      applicantEmail: applicantEmail.trim().toLowerCase(),
      applicantPhone,
      applicantRole,
      department,
      purposeCategory,
      title,
      paxCount,
      notes
    });
  };

  const validEmail = isBPenawarEmail(applicantEmail);

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
          {/* E-mail BPenawar Requirement Field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-800 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-blue-600" />
                <span>E-mel Rasmi BPenawar (Wajib):</span>
              </label>
              <span className="text-[10px] text-slate-500 font-semibold">Format: @bpenawar.kpm.edu.my</span>
            </div>

            <div className="relative">
              <input
                type="email"
                required
                list="bpenawar-emails-list"
                placeholder="khairi@bpenawar.kpm.edu.my"
                value={applicantEmail}
                onChange={(e) => handleEmailInputChange(e.target.value)}
                className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-slate-900 font-bold outline-none transition ${
                  validEmail
                    ? 'border-emerald-500 focus:ring-2 focus:ring-emerald-500 bg-emerald-50/20'
                    : emailTouched
                    ? 'border-red-500 focus:ring-2 focus:ring-red-500 bg-red-50/20'
                    : 'border-slate-300 focus:ring-2 focus:ring-blue-500'
                }`}
              />
              <datalist id="bpenawar-emails-list">
                {savedProfiles.map((p, i) => (
                  <option key={i} value={p.applicantEmail}>{p.applicantName} ({p.department})</option>
                ))}
                <option value="khairi@bpenawar.kpm.edu.my" />
                <option value="tahira@bpenawar.kpm.edu.my" />
                <option value="faridah@bpenawar.kpm.edu.my" />
              </datalist>

              {validEmail && (
                <span className="absolute right-3 top-2.5 text-emerald-600 flex items-center gap-1 text-[11px] font-bold">
                  <Check className="w-4 h-4" /> Valid BPenawar
                </span>
              )}
            </div>

            {/* Email Validation Feedback */}
            {emailError ? (
              <div className="mt-1 text-[11px] text-red-600 font-bold flex items-center gap-1 bg-red-50 p-2 rounded-lg border border-red-200">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{emailError}</span>
              </div>
            ) : !validEmail && emailTouched && (
              <div className="mt-1 text-[11px] text-amber-700 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Sila gunakan domain <strong>@bpenawar.kpm.edu.my</strong> (cth: khairi@bpenawar.kpm.edu.my)</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nama Pemohon / Staff:</label>
              <input
                type="text"
                required
                list="saved-names-list"
                placeholder="Ahmad Khairi bin Ali"
                value={applicantName}
                onChange={(e) => setApplicantName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="saved-names-list">
                {savedProfiles.map((p, i) => (
                  <option key={i} value={p.applicantName} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">No. Telefon / WhatsApp:</label>
              <input
                type="text"
                placeholder="012-3456789"
                value={applicantPhone}
                onChange={(e) => setApplicantPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Jawatan / Peranan:</label>
              <input
                type="text"
                required
                list="saved-roles-list"
                placeholder="Pensyarah Kanan"
                value={applicantRole}
                onChange={(e) => setApplicantRole(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="saved-roles-list">
                <option value="Pensyarah Kanan" />
                <option value="Pensyarah Cemerlang" />
                <option value="Ketua Jabatan" />
                <option value="Pegawai Akademik" />
                <option value="Penasihat Persatuan" />
              </datalist>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Jabatan / Unit:
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-blue-500"
              >
                {!STANDARD_DEPARTMENTS.includes(department) && department && (
                  <option value={department}>{department}</option>
                )}
                {STANDARD_DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
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

