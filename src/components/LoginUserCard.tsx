import React, { useState, useEffect } from 'react';
import { 
  getStoredActiveUser, 
  saveActiveUser, 
  clearActiveUser,
  subscribeToActiveUser,
  UserProfileHistory 
} from '../utils/storage';
import { StaffUser } from '../types';
import { INITIAL_STAFF_DATA } from '../data/staffData';
import { verifyStaffCredentialsLocally } from '../lib/firebase';
import { ForgotPinHelp } from './ForgotPinHelp';
import { WhatsAppIcon } from './WhatsAppIcon';
import { 
  LogIn, 
  CheckCircle2, 
  UserCheck, 
  Mail, 
  ShieldCheck, 
  KeyRound, 
  AlertTriangle,
  Lock,
  ExternalLink
} from 'lucide-react';

interface LoginUserCardProps {
  onProfileChange?: (profile: UserProfileHistory | null) => void;
  staffList?: StaffUser[];
  compact?: boolean;
  isAdmin?: boolean;
  onRequirePinChange?: (staff: StaffUser) => void;
}

export const LoginUserCard: React.FC<LoginUserCardProps> = ({ 
  onProfileChange, 
  staffList = INITIAL_STAFF_DATA,
  compact = false,
  isAdmin = false,
  onRequirePinChange
}) => {
  const initialUser = getStoredActiveUser();
  const [activeUser, setActiveUser] = useState<UserProfileHistory | null>(initialUser);
  const [isEditing, setIsEditing] = useState<boolean>(!initialUser);

  // Verification Form states
  const [emailInput, setEmailInput] = useState<string>(initialUser?.applicantEmail || '');
  const [pinInput, setPinInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const user = getStoredActiveUser();
    setActiveUser(user);
    if (user?.applicantEmail) {
      setEmailInput(user.applicantEmail);
    } else {
      setIsEditing(true);
    }

    const unsubscribe = subscribeToActiveUser((latestUser) => {
      setActiveUser(latestUser);
      if (latestUser?.applicantEmail) {
        setEmailInput(latestUser.applicantEmail);
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleVerifyAndLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const result = verifyStaffCredentialsLocally(emailInput, pinInput, staffList);

    if (!result.success || !result.staff) {
      setErrorMsg(result.errorMsg || 'Email atau PIN tidak sah.');
      return;
    }

    const matchedStaff = result.staff;

    // Check mandatory PIN change if still using default PIN 1234
    if (matchedStaff.pinStatus === 'DEFAULT' || matchedStaff.pin === '1234') {
      if (onRequirePinChange) {
        onRequirePinChange(matchedStaff);
      }
      return;
    }

    const updatedProfile: UserProfileHistory = {
      staffId: matchedStaff.id,
      applicantName: matchedStaff.name,
      applicantEmail: matchedStaff.email,
      applicantRole: matchedStaff.role,
      department: matchedStaff.department,
      applicantPhone: matchedStaff.phone,
      lastUsedAt: new Date().toISOString(),
      pinStatus: matchedStaff.pinStatus
    };

    saveActiveUser(updatedProfile);
    setActiveUser(updatedProfile);
    setIsEditing(false);
    setErrorMsg(null);
    setSaveSuccessMsg(`Pengesahan Berjaya! Selamat datang, ${matchedStaff.name}.`);

    if (onProfileChange) {
      onProfileChange(updatedProfile);
    }

    setTimeout(() => {
      setSaveSuccessMsg(null);
    }, 4500);
  };

  const handleLogout = () => {
    clearActiveUser();
    setActiveUser(null);
    setIsEditing(true);
    setEmailInput('');
    setPinInput('1234');
    setErrorMsg(null);
    setSaveSuccessMsg('Berjaya log keluar. Kembali ke paparan lalai (default view).');

    if (onProfileChange) {
      onProfileChange(null);
    }

    setTimeout(() => {
      setSaveSuccessMsg(null);
    }, 3500);
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
      <div className="px-3.5 py-2 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
            {activeUser ? <UserCheck className="w-3.5 h-3.5 text-blue-400" /> : <Lock className="w-3.5 h-3.5 text-blue-400" />}
            <span>{activeUser ? 'Akaun Staf Aktif' : 'Log Masuk'}</span>
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded-md border border-slate-700 transition"
            >
              {isEditing ? (activeUser ? 'Tutup' : 'Batal') : 'Tukar Akaun'}
            </button>
          </div>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="bg-emerald-950/80 border-b border-emerald-700/80 px-3 py-2 text-[11px] font-medium text-emerald-300 flex items-center gap-1.5 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Mode 1: Logged In Display Mode */}
      {!isEditing && activeUser ? (
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
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" title="Akaun Staf KPMBP Disahkan" />
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
              Akaun Staf Aktif &amp; Sah
            </span>
          </div>
        </div>
      ) : null}

      {/* Mode 2: Verification Login Form */}
      {(isEditing || !activeUser) && (
        <form onSubmit={handleVerifyAndLogin} className="p-3.5 space-y-3 bg-slate-950/60">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              E-mel
            </label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="nama@mara.gov.my"
                className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-slate-300">
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
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                  setErrorMsg(null);
                }}
                placeholder="••••"
                className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono tracking-widest placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="bg-red-950/80 border border-red-800 p-2.5 rounded-lg text-[11px] text-red-200 flex flex-col gap-2 animate-fadeIn">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold text-red-300 block">{errorMsg}</span>
                  <p className="text-[10px] text-red-200/80 leading-tight">
                    Sila pastikan e-mel dan PIN 4-digit tepat.
                  </p>
                </div>
              </div>

              {/* Forgot PIN direct assistance box as required */}
              <div className="bg-slate-900/95 border border-red-800/60 rounded-lg p-2.5 space-y-1.5 text-[11px] text-slate-200">
                <p className="font-bold text-amber-300 flex items-center gap-1.5">
                  <span>Terlupa PIN?</span>
                </p>
                <p className="text-slate-300 text-[10px] leading-relaxed">
                  Sila hubungi Admin untuk bantuan mendapatkan semula akses.
                </p>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
                  <span className="text-[10px] text-slate-400 font-mono">
                    WhatsApp Admin: 014-5313756
                  </span>
                  <a
                    href="https://wasap.my/60145313756"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-[10px] rounded-md shadow-xs transition flex items-center gap-1 shrink-0"
                    title="WhatsApp Admin untuk bantuan PIN"
                  >
                    <WhatsAppIcon className="w-3 h-3" />
                    <span>WhatsApp Admin</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Log Masuk</span>
          </button>
        </form>
      )}
    </div>
  );
};
