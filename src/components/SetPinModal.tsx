import React, { useState } from 'react';
import { StaffUser } from '../types';
import { updateStaffPinInCloud } from '../lib/firebase';
import { saveActiveUser, UserProfileHistory } from '../utils/storage';
import { Lock, KeyRound, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';

interface SetPinModalProps {
  staff: StaffUser;
  isOpen: boolean;
  onSuccess: (updatedStaff: StaffUser) => void;
}

export const SetPinModal: React.FC<SetPinModalProps> = ({
  staff,
  isOpen,
  onSuccess
}) => {
  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanNewPin = newPin.trim();
    const cleanConfirm = confirmPin.trim();

    // 1. Validate exactly 4 numeric digits
    if (!/^\d{4}$/.test(cleanNewPin)) {
      setErrorMsg('PIN Baharu mestilah tepat 4 digit nombor.');
      return;
    }

    // 2. Cannot be 1234
    if (cleanNewPin === '1234') {
      setErrorMsg('PIN Baharu tidak boleh sama dengan PIN lalai 1234.');
      return;
    }

    // 3. Reject obvious repeating digits (0000, 1111, etc.)
    const isRepeated = /^(\d)\1{3}$/.test(cleanNewPin);
    if (isRepeated) {
      setErrorMsg('PIN Baharu tidak boleh menggunakan 4 digit berulang (contoh: 0000, 1111).');
      return;
    }

    // 4. Must match confirmation
    if (cleanNewPin !== cleanConfirm) {
      setErrorMsg('PIN Baharu dan Sahkan PIN Baharu tidak sepadan.');
      return;
    }

    setIsSaving(true);
    try {
      // Update in Cloud Firestore
      await updateStaffPinInCloud(staff.id, cleanNewPin, 'CUSTOM');

      const updatedStaff: StaffUser = {
        ...staff,
        pin: cleanNewPin,
        pinStatus: 'CUSTOM',
        pinChangedAt: new Date().toISOString()
      };

      // Update active user profile
      const activeProfile: UserProfileHistory = {
        staffId: staff.id,
        applicantName: staff.name,
        applicantEmail: staff.email,
        applicantRole: staff.role,
        department: staff.department,
        applicantPhone: staff.phone,
        lastUsedAt: new Date().toISOString(),
        pinStatus: 'CUSTOM'
      };
      saveActiveUser(activeProfile);

      onSuccess(updatedStaff);
    } catch (err) {
      console.error('Error updating staff PIN:', err);
      setErrorMsg('Ralat menyimpan PIN baharu ke pangkalan data. Sila cuba sebentar lagi.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shrink-0 shadow-sm">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">
              🔐 Tetapkan PIN Keselamatan
            </h3>
            <span className="text-[11px] text-slate-500 block truncate">
              {staff.name} ({staff.email})
            </span>
          </div>
        </div>

        {/* Mandatory Notification Message */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed font-medium">
          Untuk keselamatan akaun anda, sila tetapkan PIN 4-digit baharu.
        </div>

        {/* Change PIN Form */}
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              PIN Baharu
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                required
                autoFocus
                value={newPin}
                onChange={(e) => {
                  setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                  setErrorMsg(null);
                }}
                placeholder="••••"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-slate-900 font-mono text-sm font-bold tracking-widest outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Sahkan PIN
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                required
                value={confirmPin}
                onChange={(e) => {
                  setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                  setErrorMsg(null);
                }}
                placeholder="••••"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-slate-900 font-mono text-sm font-bold tracking-widest outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSaving ? (
                <span>Menyimpan PIN...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Tetapkan PIN</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
