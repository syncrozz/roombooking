import React, { useState, useEffect } from 'react';
import { AdHocBooking } from '../types';
import { formatDateMalay, formatWhatsAppMessage, generateWhatsAppLink } from '../utils/availabilityEngine';
import { WhatsAppIcon } from './WhatsAppIcon';
import { 
  QrCode, 
  X, 
  CheckCircle2, 
  Share2, 
  Download, 
  Building, 
  Calendar, 
  Clock, 
  User, 
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';

interface QRCodeModalProps {
  booking: AdHocBooking;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ booking, onClose }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCopyText = async () => {
    try {
      const text = formatWhatsAppMessage(booking);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-5 text-center animate-in fade-in zoom-in duration-150 relative">
        
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 font-bold p-1 rounded-full hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Badge Header */}
        <div className="space-y-1 pt-2">
          <div className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold px-3 py-1 rounded-full border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            PAS AKSES KULIAH DISAHKAN
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
            KPMBP SmartHub
          </h3>
          <p className="text-xs text-slate-500 font-mono font-bold">
            ID: {booking.id}
          </p>
        </div>

        {/* QR Code Visual Illustration */}
        <div className="bg-slate-900 p-6 rounded-2xl border-2 border-emerald-500/80 shadow-inner flex flex-col items-center justify-center space-y-3">
          <div className="bg-white p-3 rounded-xl shadow-md">
            {/* Custom stylized SVG QR Code pattern */}
            <svg className="w-36 h-36 text-slate-900" viewBox="0 0 100 100" fill="currentColor">
              <path d="M0,0 h30 v30 h-30 z M10,10 h10 v10 h-10 z" />
              <path d="M70,0 h30 v30 h-30 z M80,10 h10 v10 h-10 z" />
              <path d="M0,70 h30 v30 h-30 z M10,80 h10 v10 h-10 z" />
              <path d="M40,10 h10 v20 h-10 z M60,10 h10 v10 h-10 z" />
              <path d="M30,40 h20 v10 h-20 z M60,40 h30 v10 h-30 z" />
              <path d="M10,40 h10 v20 h-10 z M40,60 h10 v30 h-10 z" />
              <path d="M60,60 h20 v20 h-20 z M80,80 h20 v20 h-20 z" />
            </svg>
          </div>
          <div className="text-[11px] text-emerald-300 font-medium">
            Imbas di Pintu Bilik Kuliah / Urusetia
          </div>
        </div>

        {/* Booking Details List */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs text-slate-800 text-left space-y-1.5 font-medium">
          <div className="flex justify-between">
            <span className="text-slate-500">Ruang:</span>
            <strong className="text-slate-900">{booking.roomName} ({booking.roomId})</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Tarikh:</span>
            <span>{formatDateMalay(booking.date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Masa:</span>
            <strong className="text-emerald-700">{booking.startTime} – {booking.endTime}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Pemohon:</span>
            <span className="font-semibold text-slate-900">{booking.applicantName}</span>
          </div>
          {booking.applicantEmail && (
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">E-mel Rasmi:</span>
              <strong className="text-blue-700 font-mono">{booking.applicantEmail}</strong>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-1">
          {/* Main Copy Button requested */}
          <button
            onClick={handleCopyText}
            className={`w-full font-bold py-2.5 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 text-xs ${
              copied
                ? 'bg-emerald-700 text-white ring-2 ring-emerald-400'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-200" />
                <span>Berjaya Disalin! Sedia Untuk Dipaste</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Salin Teks Detail Tempahan</span>
              </>
            )}
          </button>

          <a
            href={generateWhatsAppLink(booking)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 text-xs shadow-sm active:scale-98"
          >
            <WhatsAppIcon className="w-4 h-4 shrink-0" />
            <span>Kongsi ke WhatsApp</span>
            <ExternalLink className="w-3.5 h-3.5 text-white/80" />
          </a>

          <button
            onClick={onClose}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium py-1.5 px-4 rounded-xl text-xs transition"
          >
            Tutup Pas
          </button>
        </div>
      </div>
    </div>
  );
};
