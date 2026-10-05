import React, { useState } from 'react';
import { HelpCircle, ExternalLink, X } from 'lucide-react';
import { WhatsAppIcon } from './WhatsAppIcon';

interface ForgotPinHelpProps {
  compact?: boolean;
}

export const ForgotPinHelp: React.FC<ForgotPinHelpProps> = ({ compact = false }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="text-xs">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline flex items-center gap-1 transition cursor-pointer"
        >
          <HelpCircle className="w-3 h-3" />
          <span>Terlupa PIN?</span>
        </button>
      ) : (
        <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3 text-slate-200 space-y-2 mt-1 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5">
            <span className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Bantuan Terlupa PIN</span>
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[11px] text-slate-300 leading-relaxed">
            Terlupa PIN?<br />
            Sila hubungi Admin untuk bantuan mendapatkan semula akses.
          </p>

          <div className="pt-1 flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-400 font-mono">
              WhatsApp Admin: 014-5313756
            </span>
            <a
              href="https://wasap.my/60145313756"
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-[11px] rounded-lg shadow-sm transition flex items-center gap-1.5 shrink-0"
              title="Hubungi Admin di WhatsApp"
            >
              <WhatsAppIcon className="w-3.5 h-3.5" />
              <span>WhatsApp Admin</span>
              <ExternalLink className="w-3 h-3 text-white/80" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
