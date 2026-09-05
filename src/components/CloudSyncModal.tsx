import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  CheckCircle2, 
  RefreshCw, 
  Smartphone, 
  Laptop, 
  ArrowRightLeft, 
  Database, 
  Wifi, 
  AlertCircle,
  X,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { testFirebaseConnection } from '../lib/firebase';
import firebaseConfig from '../../firebase-applet-config.json';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({ isOpen, onClose }) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    connected: boolean;
    latencyMs?: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen && !testResult) {
      handleRunTest();
    }
  }, [isOpen]);

  const handleRunTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testFirebaseConnection();
      setTestResult(res);
    } catch (err) {
      setTestResult({
        connected: false,
        error: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Status Firebase Cloud Sync</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Multi-Device Sync
                </span>
              </div>
              <p className="text-xs text-slate-400">Penyegerakan masa nyata antara peranti (Telefon, Tablet &amp; Laptop)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-slate-700 dark:text-slate-200 text-sm">
          
          {/* Answer to User Query */}
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-emerald-900 dark:text-emerald-200 text-sm">
                  Ya, data disinkronkan secara automatik merentasi semua peranti!
                </h4>
                <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-1 leading-relaxed">
                  Aplikasi ini menggunakan teknologi <strong>Google Cloud Firestore Real-time WebSockets (<code>onSnapshot</code>)</strong>. Setiap kali tempahan dibuat di <em>Telefon A</em>, ia serta-merta muncul pada skrin <em>Laptop B</em> staf lain tanpa perlu menekan butang <em>Reload/Refresh</em>.
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Ping Test Result */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-blue-500" />
                <span className="font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Ujian Sambungan Cloud Langsung (Live Ping)
                </span>
              </div>
              <button
                onClick={handleRunTest}
                disabled={testing}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${testing ? 'animate-spin' : ''}`} />
                <span>{testing ? 'Menguji...' : 'Uji Semula'}</span>
              </button>
            </div>

            <div className="mt-3">
              {testing ? (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Menghantar ujian ping ke Cloud Firestore...</span>
                </div>
              ) : testResult ? (
                testResult.connected ? (
                  <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>
                      Bersambung Berjaya! Masa tindak balas: <strong>{testResult.latencyMs} ms</strong>
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Mod Tempatan Aktif: {testResult.error || 'Sambungan cloud terhad.'}</span>
                  </div>
                )
              ) : (
                <span className="text-xs text-slate-400">Tekan 'Uji Semula' untuk menyemak sambungan.</span>
              )}
            </div>
          </div>

          {/* Multi-Device Architecture Flow Graphic */}
          <div className="bg-slate-900 text-white rounded-xl p-4 border border-slate-800">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              Aliran Penyegerakan Antara Peranti (Device-to-Device Flow)
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60 flex flex-col items-center justify-center">
                <Smartphone className="w-5 h-5 text-blue-400 mb-1" />
                <span className="font-bold text-slate-200">Peranti A (Telefon)</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Tempahan dibuat / Ruang dikunci</span>
              </div>

              <div className="flex flex-col items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-blue-600/30 border border-blue-500 flex items-center justify-center text-blue-300 mb-1">
                  <Zap className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-blue-400">Cloud Firestore</span>
                <span className="text-[9px] text-slate-400">onSnapshot stream</span>
              </div>

              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60 flex flex-col items-center justify-center">
                <Laptop className="w-5 h-5 text-emerald-400 mb-1" />
                <span className="font-bold text-slate-200">Peranti B (Laptop)</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Kemas kini langsung ~0.1s</span>
              </div>
            </div>
          </div>

          {/* Collections List */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Data Yang Disinkronkan:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-500 shrink-0" />
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">Tempahan Ad-Hoc (bookings)</div>
                  <div className="text-[10px] text-slate-500">Masa nyata bila ditempah/dibatalkan</div>
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">Lock Ruang Admin (blocks)</div>
                  <div className="text-[10px] text-slate-500">Sekatan bilik rasmi serta-merta</div>
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-indigo-500 shrink-0" />
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">Jadual Akademik (schedule)</div>
                  <div className="text-[10px] text-slate-500">Slot terkunci mengikut CSV</div>
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-500 shrink-0" />
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">Direktori Staf (staff_users)</div>
                  <div className="text-[10px] text-slate-500">Log masuk e-mel &amp; 4-digit passcode</div>
                </div>
              </div>
            </div>
          </div>

          {/* Database Info Box */}
          <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col gap-1">
            <div className="flex justify-between">
              <span>Database ID:</span>
              <code className="font-mono text-slate-700 dark:text-slate-300 font-bold">{firebaseConfig.firestoreDatabaseId}</code>
            </div>
            <div className="flex justify-between">
              <span>Project ID:</span>
              <code className="font-mono text-slate-700 dark:text-slate-300">{firebaseConfig.projectId}</code>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            Faham &amp; Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
