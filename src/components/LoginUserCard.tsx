import React, { useState, useEffect } from 'react';
import { 
  getStoredActiveUser, 
  saveActiveUser, 
  UserProfileHistory 
} from '../utils/storage';
import { StaffUser } from '../types';
import { INITIAL_STAFF_DATA } from '../data/staffData';
import { verifyStaffCredentialsLocally } from '../lib/firebase';
import { 
  LogIn, 
  CheckCircle2, 
  UserCheck, 
  Mail, 
  ShieldCheck, 
  KeyRound, 
  AlertTriangle,
  Database,
  Sparkles
} from 'lucide-react';

interface LoginUserCardProps {
  onProfileChange?: (profile: UserProfileHistory) => void;
  staffList?: StaffUser[];
  compact?: boolean;
}

export const LoginUserCard: React.FC<LoginUserCardProps> = ({ 
  onProfileChange, 
  staffList = INITIAL_STAFF_DATA,
  compact = false 
}) => {
  const [activeUser, setActiveUser] = useState<UserProfileHistory>(getStoredActiveUser());
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Verification Form states
  const [emailInput, setEmailInput] = useState<string>(activeUser.applicantEmail || 'khaikerr@gmail.com');
  const [passcodeInput, setPasscodeInput] = useState<string>('3756');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const user = getStoredActiveUser();
    setActiveUser(user);
    if (user.applicantEmail) setEmailInput(user.applicantEmail);
  }, []);

  const handleQuickSelectStaff = (st: StaffUser) => {
    setEmailInput(st.email);
    setPasscodeInput(st.passcode);
    setErrorMsg(null);
  };

  const handleVerifyAndLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const result = verifyStaffCredentialsLocally(emailInput, passcodeInput, staffList);

    if (!result.success || !result.staff) {
      setErrorMsg(result.errorMsg || 'Pengesahan Gagal. Sila pastikan E-mel dan Passcode 4-digit telefon tepat.');
      return;
    }

    const matchedStaff = result.staff;
    const updatedProfile: UserProfileHistory = {
      applicantName: matchedStaff.name,
      applicantEmail: matchedStaff.email,
      applicantRole: matchedStaff.role,
      department: matchedStaff.department,
      applicantPhone: matchedStaff.phone,
      lastUsedAt: new Date().toISOString()
    };

    saveActiveUser(updatedProfile);
    setActiveUser(updatedProfile);
    setIsEditing(false);
    setErrorMsg(null);
    setSaveSuccessMsg(`Pengesahan Berjaya! Selamat datang, ${matchedStaff.name}. (Akaun CSV Firebase Disahkan)`);

    if (onProfileChange) {
      onProfileChange(updatedProfile);
    }

    setTimeout(() => {
      setSaveSuccessMsg(null);
    }, 4500);
  };

  // Helper for user initials
  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.replace(/bin|binti|dr\.|pn\.|en\./gi, '').trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-700/80 rounded-xl overflow-hidden shadow-xl transition-all">
      {/* Header Banner */}
      <div className="px-3.5 py-2.5 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded-md border border-slate-700 transition"
          >
            {isEditing ? 'Batal' : 'Tukar Akaun / Passcode'}
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="bg-emerald-950/80 border-b border-emerald-700/80 px-3 py-2 text-[11px] font-medium text-emerald-300 flex items-center gap-1.5 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Mode 1: Logged In Display Mode */}
      {!isEditing && (
        <div className="p-3.5 space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-bold text-white text-sm shadow-md shadow-blue-900/40 shrink-0">
              {getInitials(activeUser.applicantName)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white truncate block">
                  {activeUser.applicantName}
                </span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" title="E-mel & Passcode Disahkan CSV KPMBP" />
              </div>
              <p className="text-[11px] text-blue-300 font-medium truncate">
                {activeUser.applicantEmail}
              </p>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">
                {activeUser.department} • {activeUser.applicantRole}
              </p>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2 flex flex-col gap-1.5 text-[10px]">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
              Status Pengesahan Tempahan
            </span>
            <span className="font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-1 rounded flex items-center gap-1.5 w-fit">
              <ShieldCheck className="w-3 h-3 shrink-0" />
              E-mel & Passcode Sah
            </span>
          </div>
        </div>
      )}

      {/* Mode 2: Verification Login Form */}
      {isEditing && (
        <form onSubmit={handleVerifyAndLogin} className="p-3.5 space-y-3 bg-slate-950/60">
          
          {/* Quick-fill dropdown for testing staff accounts */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Ujian Akaun Staf (Pilih untuk Auto-Isi):</span>
            </label>
            <select
              onChange={(e) => {
                const found = staffList.find(s => s.id === e.target.value);
                if (found) handleQuickSelectStaff(found);
              }}
              defaultValue=""
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500"
            >
              <option value="" disabled>-- Pilih Staf CSV KPMBP --</option>
              {staffList.slice(0, 20).map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name.split(' ')[0]} ({st.email || 'tanpa emel'}) - Passcode: {st.passcode}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center justify-between">
              <span>E-mel Pengguna (CSV Firebase):</span>
              <span className="text-[10px] text-blue-400 font-normal">cth: khaikerr@gmail.com</span>
            </label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="khaikerr@gmail.com"
                className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center justify-between">
              <span>Passcode (4 Digit Terakhir No. Telefon):</span>
              <span className="text-[10px] text-amber-400 font-semibold">cth: 3756</span>
            </label>
            <div className="relative">
              <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="password"
                maxLength={4}
                required
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                placeholder="3756"
                className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              * E-mel dan passcode 4-digit telefon mestilah berpadanan dengan pangkalan data CSV KPMBP dalam Firebase.
            </p>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="bg-red-950/80 border border-red-800 p-2.5 rounded-lg text-[11px] text-red-200 flex items-start gap-2 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-red-300 block">Pengesahan Gagal:</span>
                <p className="text-[10px] text-red-200/90 leading-tight">
                  {errorMsg}
                </p>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow-md transition flex items-center justify-center gap-1.5"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Sah & Log Masuk Staf
          </button>
        </form>
      )}
    </div>
  );
};
