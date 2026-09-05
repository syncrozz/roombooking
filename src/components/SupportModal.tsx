import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  ChevronDown, 
  Heart, 
  CheckCircle2, 
  Smartphone,
  ExternalLink
} from 'lucide-react';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// LOCKED RAW URL FOR THE ACTUAL QR IMAGE
const LOCKED_QR_URL = 'https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/Bank%20QR/QR%20RYT%20for%20Sumbangan.jpg';

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSaveQR = async () => {
    setIsDownloading(true);
    try {
      // Attempt direct download via blob
      const response = await fetch(LOCKED_QR_URL, { mode: 'cors' });
      if (!response.ok) throw new Error('Fetch failed');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'QR-Sumbangan-Syncrozz.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch {
      // Fallback: direct anchor download attribute with original raw URL
      try {
        const link = document.createElement('a');
        link.href = LOCKED_QR_URL;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.download = 'QR-Sumbangan-Syncrozz.jpg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 3000);
      } catch (err) {
        console.error('Download fallback error:', err);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 text-center relative my-auto max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in duration-150"
      >
        {/* Top Close Button (X) */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 font-bold p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
          aria-label="Tutup"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 1. Header Section */}
        <div className="space-y-2 pt-1">
          {/* Badge: Sumbangan Sukarela */}
          <div className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 px-3 py-1 rounded-full text-xs font-semibold border border-rose-200">
            <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
            <span>Sumbangan Sukarela</span>
          </div>

          {/* Title: Sokong Inovasi Ini ❤️ */}
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center justify-center gap-1.5">
            <span>Sokong Inovasi Ini</span>
            <span className="text-rose-500">❤️</span>
          </h2>

          {/* Description */}
          <p className="text-slate-600 text-xs sm:text-[13px] leading-relaxed max-w-sm mx-auto px-1">
            Platform ini dibangunkan secara berterusan bagi memudahkan warga pendidik dan komuniti. Sokongan ikhlas anda membantu kesinambungan pelayanan dan pembangunan inovasi seterusnya.
          </p>
        </div>

        {/* 2. REAL QR DISPLAY */}
        <div className="pt-1 pb-1">
          <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200/90 inline-block shadow-inner max-w-full">
            <img
              src={LOCKED_QR_URL}
              alt="DuitNow QR Sumbangan Syncrozz"
              className="w-56 sm:w-60 h-auto max-w-full object-contain rounded-xl shadow-xs mx-auto block"
              referrerPolicy="no-referrer"
              loading="eager"
            />
          </div>
        </div>

        {/* 3. Support Information */}
        <div className="space-y-1">
          <p className="text-xs sm:text-[13px] font-bold text-slate-800 tracking-tight">
            DuitNow QR / Mana-mana Bank &amp; e-Wallet Malaysia
          </p>
          <p className="text-xs text-slate-500 font-medium">
            RM1 pun amat dihargai 👏
          </p>
        </div>

        {/* 4. Action: Save QR Code */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleSaveQR}
            disabled={isDownloading}
            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm shadow-md shadow-blue-200 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
          >
            {downloadSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>QR Telah Dimuat Turun!</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>{isDownloading ? 'Menyimpan QR...' : 'Save QR Code'}</span>
              </>
            )}
          </button>
        </div>

        {/* 5. How To Pay Accordion */}
        <div className="border border-slate-200 rounded-xl overflow-hidden text-left bg-slate-50/70">
          <button
            type="button"
            onClick={() => setIsAccordionOpen(!isAccordionOpen)}
            className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 transition cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-blue-600" />
              <span>Cara Bayar Guna Galeri (How To Pay)</span>
            </span>
            <ChevronDown 
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                isAccordionOpen ? 'rotate-180 text-blue-600' : ''
              }`} 
            />
          </button>

          {isAccordionOpen && (
            <div className="px-3.5 pb-3 pt-1 text-[11px] text-slate-600 border-t border-slate-200/80 space-y-1.5 bg-white">
              <ol className="list-decimal list-inside space-y-1 leading-relaxed">
                <li><span className="font-semibold text-slate-700">Save QR Code</span> ke device.</li>
                <li>Buka aplikasi banking / e-wallet.</li>
                <li>Pilih fungsi QR payment atau scan from gallery.</li>
                <li>Pilih QR yang telah disimpan.</li>
                <li>Lengkapkan pembayaran mengikut langkah aplikasi bank / e-wallet.</li>
              </ol>
            </div>
          )}
        </div>

        {/* 6. Return / Close Button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer"
          >
            Kembali ke SYNCROZZ
          </button>
        </div>
      </div>
    </div>
  );
};
