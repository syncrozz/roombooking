import React from 'react';
import { ConnectionStatusState } from '../lib/firebase';
import { AlertTriangle, WifiOff, RotateCw, Database, ShieldAlert, CloudUpload, CheckCircle2 } from 'lucide-react';

interface OfflineFallbackBannerProps {
  connectionStatus: ConnectionStatusState;
  onRetry: () => void;
  isRetrying?: boolean;
  pendingQueueCount?: number;
  isSyncingQueue?: boolean;
  onSyncQueue?: () => void;
}

export const OfflineFallbackBanner: React.FC<OfflineFallbackBannerProps> = ({
  connectionStatus,
  onRetry,
  isRetrying = false,
  pendingQueueCount = 0,
  isSyncingQueue = false,
  onSyncQueue,
}) => {
  const isFallback = connectionStatus.status === 'fallback';
  const hasPendingQueue = pendingQueueCount > 0;

  // Don't render anything if online and no pending bookings waiting in queue
  if (!isFallback && !hasPendingQueue) {
    return null;
  }

  // If online but has pending offline bookings to sync
  if (!isFallback && hasPendingQueue) {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="bg-blue-50 border-b border-blue-200 text-blue-950 px-3 sm:px-6 py-2.5 sm:py-3 shadow-xs animate-in slide-in-from-top-2 duration-200"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg text-blue-700 shrink-0">
              <CloudUpload className="w-5 h-5" />
            </div>
            <div className="text-xs sm:text-sm leading-snug">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-blue-950 uppercase tracking-wider text-[11px] sm:text-xs bg-blue-200/80 px-1.5 py-0.5 rounded">
                  Sambungan Dipulihkan
                </span>
                <span className="text-[11px] font-mono bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded border border-blue-200">
                  {pendingQueueCount} Tertunggak
                </span>
              </div>
              <p className="mt-0.5 text-blue-900 font-medium text-xs sm:text-sm">
                Terdapat <strong>{pendingQueueCount}</strong> tempahan luar talian menunggu untuk disahkan & disinkronkan ke Cloud Firestore.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {onSyncQueue && (
              <button
                type="button"
                onClick={onSyncQueue}
                disabled={isSyncingQueue}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs rounded-lg shadow-xs hover:shadow transition-all disabled:opacity-60 cursor-pointer"
              >
                <CloudUpload className={`w-3.5 h-3.5 ${isSyncingQueue ? 'animate-bounce' : ''}`} />
                <span>{isSyncingQueue ? 'Sedang Sinkronisasi...' : 'Sinkronkan Sekarang'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Fallback mode alert
  const errorCode = (connectionStatus.lastErrorCode || '').toLowerCase();

  let title = 'Mod Luar Talian Aktif';
  let message = 'Mod luar talian aktif. Data mungkin tidak terkini.';
  let icon = <WifiOff className="w-5 h-5 text-amber-700 shrink-0" />;

  if (errorCode.includes('resource-exhausted') || errorCode.includes('quota')) {
    title = 'Kuota Firestore Habis';
    message = 'Kuota pangkalan data hari ini telah habis. Data dipaparkan dari simpanan pelayar anda dan tidak dikongsi dengan pengguna lain.';
    icon = <Database className="w-5 h-5 text-amber-700 shrink-0" />;
  } else if (errorCode.includes('permission-denied') || errorCode.includes('permission')) {
    title = 'Akses Pangkalan Data Ditolak';
    message = 'Akses pangkalan data ditolak. Sila log masuk semula atau hubungi admin.';
    icon = <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0" />;
  } else if (errorCode.includes('not-found')) {
    title = 'Pangkalan Data Belum Diaktifkan';
    message = 'Firestore Database belum diwujudkan dalam projek Firebase (kpmbp-data-hub). Sila klik "Create Database" di Firebase Console.';
    icon = <Database className="w-5 h-5 text-amber-700 shrink-0" />;
  } else if (errorCode.includes('unavailable') || errorCode.includes('network') || errorCode.includes('failed-precondition')) {
    title = 'Tiada Sambungan Pangkalan Data';
    message = 'Tiada sambungan ke pangkalan data. Data ditunjukkan dari simpanan pelayar.';
    icon = <WifiOff className="w-5 h-5 text-amber-700 shrink-0" />;
  } else {
    title = 'Mod Luar Talian';
    message = 'Mod luar talian aktif. Data mungkin tidak terkini.';
    icon = <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />;
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="bg-amber-50 border-b border-amber-300 text-amber-900 px-3 sm:px-6 py-2.5 sm:py-3 shadow-xs animate-in slide-in-from-top-2 duration-200"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4">
        {/* Left: Icon and Diagnostic Message */}
        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="p-1.5 sm:p-2 bg-amber-200/80 rounded-lg text-amber-800 shrink-0">
            {icon}
          </div>
          <div className="text-xs sm:text-sm leading-snug">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-amber-950 uppercase tracking-wider text-[11px] sm:text-xs bg-amber-200/90 px-1.5 py-0.5 rounded">
                {title}
              </span>
              {connectionStatus.lastErrorCode && (
                <span className="text-[10px] sm:text-[11px] font-mono px-1.5 py-0.2 rounded bg-amber-100 border border-amber-300 text-amber-800">
                  {connectionStatus.lastErrorCode}
                </span>
              )}
              {connectionStatus.fallbackCollections.length > 0 && (
                <span className="text-[10px] text-amber-700 hidden md:inline-block">
                  ({connectionStatus.fallbackCollections.join(', ')})
                </span>
              )}
              {hasPendingQueue && (
                <span className="text-[10px] sm:text-[11px] font-bold bg-amber-200 text-amber-900 px-2 py-0.2 rounded-full border border-amber-300 flex items-center gap-1">
                  ⏳ {pendingQueueCount} tempahan dalam giliran luar talian
                </span>
              )}
            </div>
            <p className="mt-0.5 text-amber-900 font-medium text-xs sm:text-sm">
              {message}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold text-xs rounded-lg shadow-xs hover:shadow transition-all disabled:opacity-60 cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'Menyambung...' : 'Cuba semula'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
