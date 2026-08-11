import React, { useState, useEffect } from 'react';
import { 
  getStoredActiveUser, 
  saveActiveUser, 
  getStoredUserProfiles, 
  findProfileByEmail, 
  UserProfileHistory 
} from '../utils/storage';
import { LogIn, User, CheckCircle2, UserCheck, ChevronDown, Sparkles, Mail, Phone, Building, ShieldCheck, Edit3 } from 'lucide-react';

interface LoginUserCardProps {
  onProfileChange?: (profile: UserProfileHistory) => void;
  compact?: boolean;
}

export const LoginUserCard: React.FC<LoginUserCardProps> = ({ onProfileChange, compact = false }) => {
  const [activeUser, setActiveUser] = useState<UserProfileHistory>(getStoredActiveUser());
  const [savedProfiles, setSavedProfiles] = useState<UserProfileHistory[]>([]);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Form states
  const [emailInput, setEmailInput] = useState<string>(activeUser.applicantEmail);
  const [nameInput, setNameInput] = useState<string>(activeUser.applicantName);
  const [phoneInput, setPhoneInput] = useState<string>(activeUser.applicantPhone || '');
  const [roleInput, setRoleInput] = useState<string>(activeUser.applicantRole || 'Pensyarah Kanan');
  const [deptInput, setDeptInput] = useState<string>(activeUser.department || 'Jabatan Sains Komputer');

  const [matchFound, setMatchFound] = useState<boolean>(true);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const user = getStoredActiveUser();
    setActiveUser(user);
    setEmailInput(user.applicantEmail);
    setNameInput(user.applicantName);
    setPhoneInput(user.applicantPhone || '');
    setRoleInput(user.applicantRole || 'Pensyarah Kanan');
    setDeptInput(user.department || 'Jabatan Sains Komputer');
    setSavedProfiles(getStoredUserProfiles());
  }, []);

  // Handle email change and auto-lookup from device storage
  const handleEmailChange = (emailVal: string) => {
    setEmailInput(emailVal);
    const existingMatch = findProfileByEmail(emailVal);
    if (existingMatch) {
      setNameInput(existingMatch.applicantName);
      setPhoneInput(existingMatch.applicantPhone || '');
      setRoleInput(existingMatch.applicantRole || 'Pensyarah Kanan');
      setDeptInput(existingMatch.department || 'Jabatan Sains Komputer');
      setMatchFound(true);
    } else {
      setMatchFound(false);
    }
  };

  const handleSelectSavedProfile = (prof: UserProfileHistory) => {
    setEmailInput(prof.applicantEmail);
    setNameInput(prof.applicantName);
    setPhoneInput(prof.applicantPhone || '');
    setRoleInput(prof.applicantRole || 'Pensyarah Kanan');
    setDeptInput(prof.department || 'Jabatan Sains Komputer');
    setMatchFound(true);
  };

  const handleSaveLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !nameInput.trim()) {
      alert('Sila masukkan sekurang-kurangnya E-mel dan Nama Pemohon!');
      return;
    }

    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail.endsWith('@bpenawar.kpm.edu.my') && !cleanEmail.endsWith('bpenawar.kpm.edu.my')) {
      alert('Sila gunakan e-mel rasmi BPenawar! (cth: nama@bpenawar.kpm.edu.my)');
      return;
    }

    const updatedProfile: UserProfileHistory = {
      applicantName: nameInput.trim(),
      applicantEmail: cleanEmail,
      applicantRole: roleInput.trim() || 'Pensyarah / Staff',
      department: deptInput.trim() || 'Jabatan Akademik',
      applicantPhone: phoneInput.trim() || '012-3456789',
      lastUsedAt: new Date().toISOString()
    };

    saveActiveUser(updatedProfile);
    setActiveUser(updatedProfile);
    setSavedProfiles(getStoredUserProfiles());
    setIsEditing(false);
    setSaveSuccessMsg('Log masuk berjaya! Butiran peribadi telah dikemas kini.');

    if (onProfileChange) {
      onProfileChange(updatedProfile);
    }

    setTimeout(() => {
      setSaveSuccessMsg(null);
    }, 4000);
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
    <div className="w-full bg-slate-800/90 border border-slate-700/80 rounded-xl overflow-hidden shadow-lg transition-all">
      {/* Header Banner - 2 Divs (Atas & Bawah) */}
      <div className="px-3.5 py-2.5 bg-slate-900/80 border-b border-slate-700/60 space-y-1.5">
        {/* Div 1 (Atas): Tajuk & Butang */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-blue-600/30 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <LogIn className="w-3 h-3" />
            </div>
            <span className="text-xs font-bold text-slate-200 tracking-tight">
              Log Masuk Pengguna
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded-md border border-slate-700 transition"
          >
            {isEditing ? 'Batal' : 'Tukar E-mel'}
          </button>
        </div>

        {/* Div 2 (Bawah): Subtitle & Auto-Sync Status */}
        <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
          <span>Rujukan E-mel Tempahan</span>
          <span className="text-[9px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40 font-mono">
            Auto-Sync
          </span>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="bg-emerald-900/60 border-b border-emerald-700/60 px-3 py-1.5 text-[11px] font-medium text-emerald-300 flex items-center gap-1.5 animate-fadeIn">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
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
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" title="E-mel Rasmi Disahkan" />
              </div>
              <p className="text-[11px] text-blue-300 font-medium truncate">
                {activeUser.applicantEmail}
              </p>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">
                {activeUser.department} • {activeUser.applicantRole}
              </p>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2 flex items-center justify-between text-[10px]">
            <span className="text-slate-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              E-mel Aktif Tempahan
            </span>
            <span className="font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded">
              Digunakan
            </span>
          </div>
        </div>
      )}

      {/* Mode 2: Login / Edit Email Form */}
      {isEditing && (
        <form onSubmit={handleSaveLogin} className="p-3.5 space-y-3 bg-slate-900/50">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center justify-between">
              <span>Masukkan E-mel Rasmi:</span>
              <span className="text-[10px] font-normal text-slate-400">@bpenawar.kpm.edu.my</span>
            </label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => handleEmailChange(e.target.value)}
                placeholder="cth: khairi@bpenawar.kpm.edu.my"
                className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Saved profiles auto-selection list on device */}
            {savedProfiles.length > 0 && (
              <div className="mt-1.5">
                <span className="text-[10px] text-slate-400 font-medium block mb-1">
                  Akaun tersimpan di peranti ini:
                </span>
                <div className="flex flex-wrap gap-1">
                  {savedProfiles.map((p) => (
                    <button
                      key={p.applicantEmail}
                      type="button"
                      onClick={() => handleSelectSavedProfile(p)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                        emailInput.toLowerCase() === p.applicantEmail.toLowerCase()
                          ? 'bg-blue-600 text-white border-blue-500 font-semibold'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {p.applicantName.split(' ')[0]} ({p.applicantEmail.split('@')[0]})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Auto-match Notification Badge */}
          {matchFound ? (
            <div className="bg-blue-950/60 border border-blue-800/80 p-2 rounded-lg text-[11px] text-blue-200 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-blue-300">Rekod peribadi wujud!</span>
                <p className="text-[10px] text-blue-200/80 leading-tight">
                  Sistem telah mengisi maklumat peribadi dari peranti anda secara automatik.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-950/60 border border-amber-800/80 p-2 rounded-lg text-[11px] text-amber-200 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-300">E-mel Baru Dikesan!</span>
                <p className="text-[10px] text-amber-200/80 leading-tight">
                  Sila lengkapkan butiran peribadi di bawah. Sistem akan mengingatinya pada peranti ini.
                </p>
              </div>
            </div>
          )}

          {/* Editable Personal Details */}
          <div className="space-y-2 pt-1 border-t border-slate-800">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Nama Penuh Pemohon:</label>
              <input
                type="text"
                required
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Nama Penuh Pensyarah / Staf"
                className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">No. Telefon:</label>
                <input
                  type="text"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="012-3456789"
                  className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Peranan / Jawatan:</label>
                <input
                  type="text"
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value)}
                  placeholder="Pensyarah Kanan"
                  className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Jabatan / Unit:</label>
              <input
                type="text"
                value={deptInput}
                onChange={(e) => setDeptInput(e.target.value)}
                placeholder="Jabatan Sains Komputer"
                className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow-md transition flex items-center justify-center gap-1.5"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Log Masuk & Gunakan E-mel Ini
          </button>
        </form>
      )}
    </div>
  );
};
