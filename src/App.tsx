/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Room, 
  AcademicScheduleSlot, 
  AdHocBooking, 
  InstitutionalBlock, 
  PurposeCategory,
  StaffUser
} from './types';
import { 
  getStoredRooms, 
  getStoredAcademicSchedule, 
  saveStoredAcademicSchedule,
  getStoredAdHocBookings, 
  saveStoredAdHocBookings, 
  getStoredInstitutionalBlocks, 
  saveStoredInstitutionalBlocks, 
  resetToDefaults, 
  generateBookingId,
  saveUserProfile
} from './utils/storage';
import { 
  subscribeToBookings, 
  subscribeToBlocks, 
  subscribeToStaffUsers,
  subscribeToSchedule,
  seedInitialStaffUsers,
  bulkSaveStaffUsersToCloud,
  bulkSaveScheduleToCloud,
  saveBookingToCloud, 
  deleteBookingFromCloud, 
  saveBlockToCloud, 
  deleteBlockFromCloud 
} from './lib/firebase';
import { INITIAL_STAFF_DATA } from './data/staffData';

import { Header, ActiveTab } from './components/Header';
import { QuickBookingSearch } from './components/QuickBookingSearch';
import { RoomAvailabilityMatrix } from './components/RoomAvailabilityMatrix';
import { AcademicScheduleView } from './components/AcademicScheduleView';
import { MyBookingsView } from './components/MyBookingsView';
import { RoomDirectoryView } from './components/RoomDirectoryView';
import { AdminManagementView } from './components/AdminManagementView';
import { BookingModal } from './components/BookingModal';
import { QRCodeModal } from './components/QRCodeModal';

import { Building2, Shield, Heart, Sparkles, CheckCircle2, Lock, X, KeyRound, ShieldCheck, AlertCircle } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('search');

  // Admin PIN verification state
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);
  const [showAdminPinModal, setShowAdminPinModal] = useState<boolean>(false);
  const [adminPinInput, setAdminPinInput] = useState<string>('');
  const [adminPinError, setAdminPinError] = useState<string | null>(null);

  const handleSelectTab = (tab: ActiveTab) => {
    if (tab === 'admin' && !isAdminUnlocked) {
      setShowAdminPinModal(true);
      setAdminPinError(null);
      setAdminPinInput('');
    } else {
      setActiveTab(tab);
    }
  };

  const handleVerifyAdminPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPinInput.trim() === '5313') {
      setIsAdminUnlocked(true);
      setActiveTab('admin');
      setShowAdminPinModal(false);
      setAdminPinInput('');
      setAdminPinError(null);
      showToast('🟢 Akses Pentadbir Disahkan.');
    } else {
      setAdminPinError('PIN / Passcode Keselamatan Pentadbir Tidak Sah.');
    }
  };

  // State loaded from local storage persistence
  const [rooms, setRooms] = useState<Room[]>([]);
  const [academicSchedule, setAcademicSchedule] = useState<AcademicScheduleSlot[]>([]);
  const [adhocBookings, setAdhocBookings] = useState<AdHocBooking[]>([]);
  const [institutionalBlocks, setInstitutionalBlocks] = useState<InstitutionalBlock[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>(INITIAL_STAFF_DATA);

  // Modals state
  const [bookingModalInfo, setBookingModalInfo] = useState<{
    room: Room;
    date: string;
    startTime: string;
    endTime: string;
    purpose: PurposeCategory;
  } | null>(null);

  const [qrModalBooking, setQrModalBooking] = useState<AdHocBooking | null>(null);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Handle ESC key to close popups/modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAdminPinModal) {
          setShowAdminPinModal(false);
        } else if (bookingModalInfo) {
          setBookingModalInfo(null);
        } else if (qrModalBooking) {
          setQrModalBooking(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAdminPinModal, bookingModalInfo, qrModalBooking]);

  useEffect(() => {
    setRooms(getStoredRooms());
    setAcademicSchedule(getStoredAcademicSchedule());

    // Seed initial staff users to Firebase Firestore if empty
    seedInitialStaffUsers();

    // Subscribe to Firestore staff users
    const unsubStaff = subscribeToStaffUsers((cloudStaff) => {
      if (cloudStaff && cloudStaff.length > 0) {
        setStaffUsers(cloudStaff);
      }
    });

    // Subscribe to Firestore for real-time multi-device booking synchronization
    const unsubBookings = subscribeToBookings((cloudBookings) => {
      setAdhocBookings(cloudBookings);
      saveStoredAdHocBookings(cloudBookings);
    });

    const unsubBlocks = subscribeToBlocks((cloudBlocks) => {
      setInstitutionalBlocks(cloudBlocks);
      saveStoredInstitutionalBlocks(cloudBlocks);
    });

    const unsubSchedule = subscribeToSchedule((cloudSchedule) => {
      if (cloudSchedule && cloudSchedule.length > 0) {
        setAcademicSchedule(cloudSchedule);
        saveStoredAcademicSchedule(cloudSchedule);
      }
    });

    return () => {
      unsubStaff();
      unsubBookings();
      unsubBlocks();
      unsubSchedule();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Open booking modal
  const handleOpenBookingModal = (
    room: Room,
    date: string,
    startTime: string,
    endTime: string,
    purpose: PurposeCategory
  ) => {
    setBookingModalInfo({ room, date, startTime, endTime, purpose });
  };

  // Submit new booking
  const handleSubmitBooking = async (
    data: Omit<AdHocBooking, 'id' | 'status' | 'createdAt'>
  ) => {
    const newId = generateBookingId();
    const newBooking: AdHocBooking = {
      ...data,
      id: newId,
      status: 'CONFIRMED', // Auto-confirmed by the engine after zero-conflict verification
      createdAt: new Date().toISOString()
    };

    if (newBooking.applicantEmail) {
      saveUserProfile({
        applicantName: newBooking.applicantName,
        applicantEmail: newBooking.applicantEmail,
        applicantRole: newBooking.applicantRole,
        department: newBooking.department,
        applicantPhone: newBooking.applicantPhone
      });
    }

    const updated = [newBooking, ...adhocBookings];
    setAdhocBookings(updated);
    saveStoredAdHocBookings(updated);

    // Sync to Firestore cloud
    try {
      await saveBookingToCloud(newBooking);
    } catch (err) {
      console.error('Cloud sync error on create booking:', err);
    }

    setBookingModalInfo(null);
    setQrModalBooking(newBooking);
    showToast(`🟢 Tempahan ${newBooking.id} di ${newBooking.roomName} berjaya disahkan & disimpan ke Cloud!`);
  };

  // Cancel booking
  const handleCancelBooking = async (bookingId: string) => {
    const updated = adhocBookings.filter(b => b.id !== bookingId);
    setAdhocBookings(updated);
    saveStoredAdHocBookings(updated);

    try {
      await deleteBookingFromCloud(bookingId);
    } catch (err) {
      console.error('Cloud sync error on cancel booking:', err);
    }

    showToast(`Tempahan ID ${bookingId} telah dibatalkan.`);
  };

  // Admin approvals
  const handleApproveBooking = async (id: string) => {
    const target = adhocBookings.find(b => b.id === id);
    const updated = adhocBookings.map(b => b.id === id ? { ...b, status: 'CONFIRMED' as const } : b);
    setAdhocBookings(updated);
    saveStoredAdHocBookings(updated);

    if (target) {
      try {
        await saveBookingToCloud({ ...target, status: 'CONFIRMED' });
      } catch (err) {
        console.error('Cloud sync error on approve:', err);
      }
    }

    showToast(`🟢 Tempahan ${id} telah diluluskan oleh Admin.`);
  };

  const handleRejectBooking = async (id: string) => {
    const target = adhocBookings.find(b => b.id === id);
    const updated = adhocBookings.map(b => b.id === id ? { ...b, status: 'REJECTED' as const } : b);
    setAdhocBookings(updated);
    saveStoredAdHocBookings(updated);

    if (target) {
      try {
        await saveBookingToCloud({ ...target, status: 'REJECTED' });
      } catch (err) {
        console.error('Cloud sync error on reject:', err);
      }
    }

    showToast(`🔴 Tempahan ${id} telah ditolak.`);
  };

  // Institutional block management
  const handleAddBlock = async (blockData: Omit<InstitutionalBlock, 'id'>) => {
    const newBlock: InstitutionalBlock = {
      ...blockData,
      id: `BLK-${Date.now()}`
    };
    const updated = [newBlock, ...institutionalBlocks];
    setInstitutionalBlocks(updated);
    saveStoredInstitutionalBlocks(updated);

    try {
      await saveBlockToCloud(newBlock);
    } catch (err) {
      console.error('Cloud sync error on block:', err);
    }

    showToast(`⚫ Lock Ruang ${blockData.roomId} berjaya ditambah.`);
  };

  const handleDeleteBlock = async (id: string) => {
    const updated = institutionalBlocks.filter(b => b.id !== id);
    setInstitutionalBlocks(updated);
    saveStoredInstitutionalBlocks(updated);

    try {
      await deleteBlockFromCloud(id);
    } catch (err) {
      console.error('Cloud sync error on delete block:', err);
    }

    showToast(`Lock Ruang telah dipadam.`);
  };

  // Staff sync
  const handleSyncStaffUsers = async (newStaffList: StaffUser[]) => {
    try {
      await bulkSaveStaffUsersToCloud(newStaffList);
      const combined = [...staffUsers];
      newStaffList.forEach((st) => {
        const idx = combined.findIndex(s => s.email.toLowerCase() === st.email.toLowerCase());
        if (idx !== -1) {
          combined[idx] = st;
        } else {
          combined.push(st);
        }
      });
      setStaffUsers(combined);
      showToast(`🟢 ${newStaffList.length} rekod e-mel/staf berjaya disinkronkan ke Cloud Firebase!`);
    } catch (err) {
      console.error('Error syncing staff users:', err);
      showToast(`🔴 Ralat semasa menyinkronkan data staf ke Cloud.`);
      throw err;
    }
  };

  // Academic schedule sync
  const handleSyncAcademicSchedule = async (newSchedule: AcademicScheduleSlot[]) => {
    setAcademicSchedule(newSchedule);
    saveStoredAcademicSchedule(newSchedule);
    try {
      await bulkSaveScheduleToCloud(newSchedule);
      showToast(`🟢 ${newSchedule.length} slot jadual waktu berjaya disinkronkan & MENGLOCK bilik!`);
    } catch (err) {
      console.error('Error syncing academic schedule:', err);
      showToast(`🟡 Slot jadual disimpan secara tempatan.`);
    }
  };

  // Reset to defaults
  const handleResetData = () => {
    resetToDefaults();
    setRooms(getStoredRooms());
    setAcademicSchedule(getStoredAcademicSchedule());
    setAdhocBookings(getStoredAdHocBookings());
    setInstitutionalBlocks(getStoredInstitutionalBlocks());
    showToast(`Data sistem telah ditetapkan semula.`);
  };

  const pendingCount = adhocBookings.filter(b => b.status === 'PENDING').length;

  const getTabBreadcrumb = (tab: ActiveTab) => {
    switch (tab) {
      case 'search': return 'Cari & Tempah Ruang';
      case 'matrix': return 'Lihat Ketersediaan Ruang';
      case 'academic': return 'Jadual Akademik Sedia Ada';
      case 'mybookings': return 'Tempahan Saya & Pas QR';
      case 'directory': return 'Direktori 33 Ruang KPMBP';
      case 'admin': return 'Admin Access & Kawalan Pentadbir';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col lg:flex-row selection:bg-blue-600 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-blue-500 flex items-center gap-3 animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-5 h-5 text-blue-400" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={handleSelectTab}
        pendingCount={pendingCount}
        staffList={staffUsers}
      />

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden min-h-screen">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">Modul /</span>
            <span className="text-slate-900 font-bold">{getTabBreadcrumb(activeTab)}</span>
          </div>
        </header>

        {/* View Section */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
          {activeTab === 'search' && (
            <QuickBookingSearch
              rooms={rooms}
              academicSchedule={academicSchedule}
              adhocBookings={adhocBookings}
              institutionalBlocks={institutionalBlocks}
              onOpenBookingModal={handleOpenBookingModal}
              onViewRoomDetails={(room) => {
                setActiveTab('directory');
              }}
            />
          )}

          {activeTab === 'matrix' && (
            <RoomAvailabilityMatrix
              rooms={rooms}
              academicSchedule={academicSchedule}
              adhocBookings={adhocBookings}
              institutionalBlocks={institutionalBlocks}
              onOpenBookingModal={handleOpenBookingModal}
              onViewRoomDetails={(room) => {
                setActiveTab('directory');
              }}
            />
          )}

          {activeTab === 'academic' && (
            <AcademicScheduleView
              schedule={academicSchedule}
              rooms={rooms}
            />
          )}

          {activeTab === 'mybookings' && (
            <MyBookingsView
              bookings={adhocBookings}
              staffList={staffUsers}
              onOpenQRModal={(b) => setQrModalBooking(b)}
              onCancelBooking={handleCancelBooking}
            />
          )}

          {activeTab === 'directory' && (
            <RoomDirectoryView
              rooms={rooms}
              onOpenBookingModal={handleOpenBookingModal}
            />
          )}

          {activeTab === 'admin' && (
            <AdminManagementView
              bookings={adhocBookings}
              institutionalBlocks={institutionalBlocks}
              rooms={rooms}
              staffList={staffUsers}
              academicSchedule={academicSchedule}
              onApproveBooking={handleApproveBooking}
              onRejectBooking={handleRejectBooking}
              onAddBlock={handleAddBlock}
              onDeleteBlock={handleDeleteBlock}
              onResetData={handleResetData}
              onSyncStaffUsers={handleSyncStaffUsers}
              onSyncAcademicSchedule={handleSyncAcademicSchedule}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 py-6 px-6 text-xs text-slate-500 mt-auto">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold">
                <Building2 className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-xs">KPMBP SmartHub — Room Booking</div>
                <div className="text-[11px] text-slate-400">Hak Cipta Terpelihara © 2026 Kolej Profesional MARA Bandar Penawar</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <button onClick={() => setActiveTab('search')} className="hover:text-blue-600 transition">Cari Ruang</button>
              <span>•</span>
              <button onClick={() => setActiveTab('matrix')} className="hover:text-blue-600 transition">Calendar View</button>
              <span>•</span>
              <button onClick={() => setActiveTab('academic')} className="hover:text-blue-600 transition">Jadual Akademik</button>
              <span>•</span>
              <button onClick={() => setActiveTab('directory')} className="hover:text-blue-600 transition">33 Ruang KPMBP</button>
            </div>
          </div>
        </footer>
      </div>

      {/* Booking Dialog Modal */}
      {bookingModalInfo && (
        <BookingModal
          room={bookingModalInfo.room}
          date={bookingModalInfo.date}
          startTime={bookingModalInfo.startTime}
          endTime={bookingModalInfo.endTime}
          initialPurpose={bookingModalInfo.purpose}
          staffList={staffUsers}
          onClose={() => setBookingModalInfo(null)}
          onSubmitBooking={handleSubmitBooking}
        />
      )}

      {/* QR Access Pass Modal */}
      {qrModalBooking && (
        <QRCodeModal
          booking={qrModalBooking}
          onClose={() => setQrModalBooking(null)}
        />
      )}

      {/* ADMIN PIN ACCESS MODAL */}
      {showAdminPinModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowAdminPinModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  Pengesahan Admin Access
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Pentadbir Ruang & Sistem KPMBP
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
              Sila masukkan <strong>Passcode / PIN Keselamatan Master Admin</strong> untuk membuka akses ruang pentadbir:
            </p>

            <form onSubmit={handleVerifyAdminPin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-blue-500" />
                  <span>Passcode / PIN Admin:</span>
                </label>
                <input
                  type="password"
                  autoFocus
                  value={adminPinInput}
                  onChange={(e) => {
                    setAdminPinInput(e.target.value);
                    if (adminPinError) setAdminPinError(null);
                  }}
                  placeholder="Masukkan PIN Keselamatan"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 tracking-widest text-center"
                />
              </div>

              {adminPinError && (
                <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs p-3 rounded-xl flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{adminPinError}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminPinModal(false)}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-md shadow-blue-600/30 active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Akses Admin</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
