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
  saveStoredRooms,
  getStoredAcademicSchedule, 
  saveStoredAcademicSchedule,
  getStoredAdHocBookings, 
  saveStoredAdHocBookings, 
  getStoredInstitutionalBlocks, 
  saveStoredInstitutionalBlocks, 
  resetToDefaults, 
  purgeAllDemoDataLocal,
  generateBookingId,
  saveUserProfile,
  getStoredActiveUser,
  subscribeToActiveUser,
  UserProfileHistory,
  getStoredStaffUsers,
  saveStoredStaffUsers,
  deduplicateStaffById
} from './utils/storage';
import { 
  subscribeToBookings, 
  subscribeToBlocks, 
  subscribeToStaffUsers,
  subscribeToSchedule,
  subscribeToRooms,
  bulkSaveRoomsToCloud,
  seedInitialStaffUsers,
  bulkSaveStaffUsersToCloud,
  bulkSaveScheduleToCloud,
  clearAllScheduleFromCloud,
  saveBookingToCloud, 
  deleteBookingFromCloud, 
  saveBlockToCloud, 
  deleteBlockFromCloud,
  cleanObsoleteDemoRecordsFromCloud
} from './lib/firebase';
import { INITIAL_STAFF_DATA } from './data/staffData';

import { Header, ActiveTab } from './components/Header';
import { QuickNavGrid } from './components/QuickNavGrid';
import { DashboardOverview } from './components/DashboardOverview';
import { QuickBookingSearch } from './components/QuickBookingSearch';
import { RoomAvailabilityMatrix } from './components/RoomAvailabilityMatrix';
import { AcademicScheduleView } from './components/AcademicScheduleView';
import { MyBookingsView } from './components/MyBookingsView';
import { RoomDirectoryView } from './components/RoomDirectoryView';
import { AdminManagementView } from './components/AdminManagementView';
import { BookingModal } from './components/BookingModal';
import { QRCodeModal } from './components/QRCodeModal';
import { SupportModal } from './components/SupportModal';
import { SetPinModal } from './components/SetPinModal';

import { Building2, Shield, Heart, Sparkles, CheckCircle2, Lock, X, KeyRound, ShieldCheck, AlertCircle } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('matrix');
  const [isSupportOpen, setIsSupportOpen] = useState<boolean>(false);

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

  const handleLogoutAdmin = () => {
    setIsAdminUnlocked(false);
    setActiveTab('matrix');
    setShowAdminPinModal(false);
    setAdminPinInput('');
    setAdminPinError(null);
    showToast('🔒 Sesi Admin telah dilog keluar. Akses Pentadbir dikunci semula.');
  };

  // State loaded from local storage persistence
  const [rooms, setRooms] = useState<Room[]>([]);
  const [academicSchedule, setAcademicSchedule] = useState<AcademicScheduleSlot[]>([]);
  const [adhocBookings, setAdhocBookings] = useState<AdHocBooking[]>([]);
  const [institutionalBlocks, setInstitutionalBlocks] = useState<InstitutionalBlock[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>(() => {
    const cached = getStoredStaffUsers();
    if (cached && cached.length > 0) {
      return deduplicateStaffById(cached);
    }
    return deduplicateStaffById(INITIAL_STAFF_DATA);
  });

  // Modals state
  const [bookingModalInfo, setBookingModalInfo] = useState<{
    room: Room;
    date: string;
    startTime: string;
    endTime: string;
    purpose: PurposeCategory;
  } | null>(null);

  const [qrModalBooking, setQrModalBooking] = useState<AdHocBooking | null>(null);

  // Mandatory PIN Change modal state for staff/owner on default PIN (1234)
  const [mandatoryPinChangeStaff, setMandatoryPinChangeStaff] = useState<StaffUser | null>(null);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Automatically check if stored active user is still using default PIN 1234
  useEffect(() => {
    const checkMandatoryPin = (active: UserProfileHistory | null) => {
      if (!active || !active.applicantEmail) {
        setMandatoryPinChangeStaff(null);
        return;
      }
      if (staffUsers.length > 0) {
        const match = staffUsers.find(
          (s) => s.email.trim().toLowerCase() === active.applicantEmail.trim().toLowerCase()
        );
        if (match && (match.pinStatus === 'DEFAULT' || match.pin === '1234')) {
          setMandatoryPinChangeStaff(match);
        } else {
          setMandatoryPinChangeStaff(null);
        }
      }
    };

    checkMandatoryPin(getStoredActiveUser());
    const unsubscribe = subscribeToActiveUser(checkMandatoryPin);
    return () => {
      unsubscribe();
    };
  }, [staffUsers]);

  const handlePinChangeSuccess = (updatedStaff: StaffUser) => {
    setStaffUsers((prev) =>
      prev.map((s) => (s.id === updatedStaff.id ? updatedStaff : s))
    );
    setMandatoryPinChangeStaff(null);
    showToast(`✅ PIN keselamatan berjaya ditetapkan untuk ${updatedStaff.name}.`);
  };

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
    setAdhocBookings(getStoredAdHocBookings());
    setInstitutionalBlocks(getStoredInstitutionalBlocks());

    // Clean any obsolete demo records from Cloud Firestore (Strict Zero Demo Data)
    cleanObsoleteDemoRecordsFromCloud().catch(() => {});

    // Subscribe to Firestore staff users (SES v4.4: Authoritative Staff List)
    const unsubStaff = subscribeToStaffUsers((cloudStaff) => {
      if (cloudStaff && cloudStaff.length > 0) {
        const deduplicated = deduplicateStaffById(cloudStaff);
        setStaffUsers(deduplicated);
        saveStoredStaffUsers(deduplicated);
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

    const unsubRooms = subscribeToRooms((cloudRooms) => {
      if (cloudRooms && cloudRooms.length > 0) {
        setRooms(cloudRooms);
        saveStoredRooms(cloudRooms);
      }
    });

    return () => {
      unsubStaff();
      unsubBookings();
      unsubBlocks();
      unsubSchedule();
      unsubRooms();
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

  // Submit new booking (Supports single booking or multi-day series)
  const handleSubmitBooking = async (
    data: Omit<AdHocBooking, 'id' | 'status' | 'createdAt'> | Omit<AdHocBooking, 'id' | 'status' | 'createdAt'>[]
  ) => {
    const dataList = Array.isArray(data) ? data : [data];
    const newBookings: AdHocBooking[] = [];

    // Check overlaps for all items in the submission
    for (const item of dataList) {
      const isOverlapping = adhocBookings.some(
        b => b.roomId === item.roomId &&
             b.date === item.date &&
             b.status !== 'REJECTED' &&
             b.status !== 'CANCELLED' &&
             ((item.startTime >= b.startTime && item.startTime < b.endTime) ||
              (item.endTime > b.startTime && item.endTime <= b.endTime) ||
              (item.startTime <= b.startTime && item.endTime >= b.endTime))
      );

      if (isOverlapping) {
        showToast(`⚠️ Ralat: Ruang tersebut telah mempunyai tempahan disahkan pada tarikh ${item.date}!`);
        return;
      }
    }

    for (let i = 0; i < dataList.length; i++) {
      const item = dataList[i];
      const baseId = generateBookingId();
      const newId = dataList.length > 1 ? `${baseId}-D${i + 1}` : baseId;
      const newBooking: AdHocBooking = {
        ...item,
        id: newId,
        status: 'CONFIRMED', // Auto-confirmed by the engine after zero-conflict verification
        createdAt: new Date().toISOString()
      };
      newBookings.push(newBooking);
    }

    if (newBookings.length > 0 && newBookings[0].applicantEmail) {
      saveUserProfile({
        applicantName: newBookings[0].applicantName,
        applicantEmail: newBookings[0].applicantEmail,
        applicantRole: newBookings[0].applicantRole,
        department: newBookings[0].department,
        applicantPhone: newBookings[0].applicantPhone
      });
    }

    const updated = [...newBookings, ...adhocBookings];
    setAdhocBookings(updated);
    saveStoredAdHocBookings(updated);

    // Sync to Firestore cloud
    for (const b of newBookings) {
      try {
        await saveBookingToCloud(b);
      } catch (err) {
        console.error('Cloud sync error on create booking:', err);
      }
    }

    setBookingModalInfo(null);
    setQrModalBooking(newBookings[0]);
    if (newBookings.length > 1) {
      showToast(`🟢 Berjaya! ${newBookings.length} siri tempahan di ${newBookings[0].roomName} (11–13 Okt 2026, 4pm–11pm) telah disahkan!`);
    } else {
      showToast(`🟢 Tempahan ${newBookings[0].id} di ${newBookings[0].roomName} berjaya disahkan & disimpan ke Cloud!`);
    }
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

  // Staff sync (Supports 'merge' and 'replace' mode)
  const handleSyncStaffUsers = async (
    newStaffList: StaffUser[],
    mode: 'merge' | 'replace' = 'merge',
    resetAllPins: boolean = false
  ): Promise<{ written: number; deleted: number }> => {
    try {
      // 1. In 'replace' mode:
      // Remove localStorage key kpmbp_staff_cache_v1 first as specified
      if (mode === 'replace') {
        localStorage.removeItem('kpmbp_staff_cache_v1');
      }

      // 2. Persist to Cloud Firestore with replace or merge logic
      const result = await bulkSaveStaffUsersToCloud(newStaffList, mode, resetAllPins);
      const finalStaffList = result.updatedList;

      // 3. Save new list to localStorage & React state
      setStaffUsers(finalStaffList);
      saveStoredStaffUsers(finalStaffList);

      if (mode === 'replace') {
        showToast(`🟢 Mod Ganti Semua: ${result.written} rekod staf disimpan, ${result.deleted} rekod lama dipadamkan dari Cloud.`);
      } else {
        showToast(`🟢 ${result.written} rekod staf berjaya disinkronkan ke Cloud Firebase!`);
      }

      return { written: result.written, deleted: result.deleted };
    } catch (err) {
      console.error('Error syncing staff users:', err);
      showToast(`🔴 Ralat semasa menyinkronkan data staf ke Cloud.`);
      throw err;
    }
  };

  // Academic schedule sync (Supports Merge and Replace mode)
  const handleSyncAcademicSchedule = async (newSchedule: AcademicScheduleSlot[], mode: 'replace' | 'merge' = 'merge') => {
    let finalSchedule: AcademicScheduleSlot[];

    if (mode === 'merge') {
      const affectedRooms = new Set(newSchedule.map(s => s.roomId.toUpperCase()));
      const untouchedSlots = academicSchedule.filter(s => !affectedRooms.has(s.roomId.toUpperCase()));
      finalSchedule = [...untouchedSlots, ...newSchedule];
    } else {
      // Total replace: completely overwrite existing schedule
      finalSchedule = newSchedule;
    }

    setAcademicSchedule(finalSchedule);
    saveStoredAcademicSchedule(finalSchedule);
    try {
      await bulkSaveScheduleToCloud(finalSchedule, mode);
      if (mode === 'replace') {
        showToast(`🟢 Jadual lama dibersihkan dan digantikan secara TOTAL dengan ${newSchedule.length} slot baharu!`);
      } else {
        showToast(`🟢 ${newSchedule.length} slot jadual berjaya disinkronkan & bilik berkaitan dikunci (Mod Gabung)!`);
      }
    } catch (err) {
      console.error('Error syncing academic schedule:', err);
      showToast(`🟡 Slot jadual disimpan secara tempatan.`);
    }
  };

  // Clear / Purge all academic schedule slots
  const handleClearAcademicSchedule = async () => {
    setAcademicSchedule([]);
    saveStoredAcademicSchedule([]);
    try {
      await clearAllScheduleFromCloud();
      showToast(`🟢 Semua data jadual akademik telah dibersihkan sepenuhnya (0 slot aktif).`);
    } catch (err) {
      console.error('Error clearing schedule from cloud:', err);
      showToast(`🟢 Data jadual dibersihkan secara tempatan.`);
    }
  };

  // Sync Rooms Directory (Supports 'merge' and 'replace' mode)
  const handleSyncRooms = async (newRooms: Room[], mode: 'merge' | 'replace' = 'merge') => {
    let finalRooms: Room[];

    if (mode === 'merge') {
      const newRoomsMap = new Map<string, Room>();
      newRooms.forEach(r => {
        newRoomsMap.set(r.id.toUpperCase(), r);
        newRoomsMap.set(r.code.toUpperCase(), r);
      });

      const updatedExisting = rooms.map(existing => {
        const match = newRoomsMap.get(existing.id.toUpperCase()) || newRoomsMap.get(existing.code.toUpperCase());
        return match ? { ...existing, ...match } : existing;
      });

      const existingIds = new Set(rooms.map(r => r.id.toUpperCase()));
      const existingCodes = new Set(rooms.map(r => r.code.toUpperCase()));
      const brandNew = newRooms.filter(r => !existingIds.has(r.id.toUpperCase()) && !existingCodes.has(r.code.toUpperCase()));

      finalRooms = [...updatedExisting, ...brandNew];
    } else {
      finalRooms = newRooms;
    }

    setRooms(finalRooms);
    saveStoredRooms(finalRooms);

    try {
      await bulkSaveRoomsToCloud(finalRooms);
      showToast(`🟢 ${newRooms.length} maklumat ruang kuliah berjaya disinkronkan & disimpan ke Cloud!`);
    } catch (err) {
      console.error('Error syncing rooms to cloud:', err);
      showToast(`🟢 Maklumat ruang disimpan secara tempatan.`);
    }
  };

  // Reset to defaults (Strict Zero Demo Data)
  const handleResetData = async () => {
    resetToDefaults();
    purgeAllDemoDataLocal();
    await cleanObsoleteDemoRecordsFromCloud();
    setRooms(getStoredRooms());
    setAcademicSchedule(getStoredAcademicSchedule());
    setAdhocBookings([]);
    setInstitutionalBlocks([]);
    showToast(`🟢 Data sistem ditetapkan ke Master Data rasmi (Sifar Data Demo).`);
  };

  const pendingCount = adhocBookings.filter(b => b.status === 'PENDING').length;

  const getTabBreadcrumb = (tab: ActiveTab) => {
    switch (tab) {
      case 'dashboard': return 'Dashboard & Ringkasan Utama';
      case 'search': return 'Cari & Tempah Ruang';
      case 'matrix': return 'Lihat Ketersediaan Ruang';
      case 'academic': return 'Locked (Jadual Rasmi)';
      case 'mybookings': return 'My Booking & Pas QR';
      case 'directory': return 'Direktori 42 Ruang KPMBP';
      case 'admin': return 'Admin Access & Kawalan Pentadbir';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-blue-500 flex items-center gap-3 animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-5 h-5 text-blue-400" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Top Horizontal Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={handleSelectTab}
        pendingCount={pendingCount}
        staffList={staffUsers}
        isAdmin={isAdminUnlocked}
        onLogoutAdmin={handleLogoutAdmin}
        onRequirePinChange={(st) => setMandatoryPinChangeStaff(st)}
      />

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* View Section */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-3.5 sm:p-5 lg:p-6 space-y-4">
          {/* Quick Action Navigation Grid (Paparan Pantas untuk setiap seksyen) */}
          <QuickNavGrid
            activeTab={activeTab}
            onNavigateTab={handleSelectTab}
            pendingCount={pendingCount}
          />

          {activeTab === 'dashboard' && (
            <DashboardOverview
              rooms={rooms}
              academicSchedule={academicSchedule}
              adhocBookings={adhocBookings}
              institutionalBlocks={institutionalBlocks}
              staffList={staffUsers}
              onNavigateTab={handleSelectTab}
              onOpenBookingModal={handleOpenBookingModal}
            />
          )}

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
              isAdmin={isAdminUnlocked}
              onOpenQRModal={(b) => setQrModalBooking(b)}
              onCancelBooking={handleCancelBooking}
              onRequirePinChange={(st) => setMandatoryPinChangeStaff(st)}
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
              onClearAcademicSchedule={handleClearAcademicSchedule}
              onSyncRooms={handleSyncRooms}
              onLogoutAdmin={handleLogoutAdmin}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="bg-slate-900 border-t border-slate-800 py-4 px-6 text-xs text-slate-400 mt-auto">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <p className="text-slate-400 text-xs">
                Developed by{' '}
                <a
                  href="https://www.syncrozz.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 hover:underline font-semibold transition"
                >
                  Syncrozz
                </a>
              </p>
              <a
                href="https://wa.me/60145313756"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center opacity-90 hover:opacity-100 hover:scale-105 transition-all"
                title="Hubungi melalui WhatsApp"
                aria-label="WhatsApp Syncrozz"
              >
                <img
                  src="https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/logo/MAIN/Logo%20Whatapp%20v2.png"
                  alt="WhatsApp"
                  className="w-5 h-5 object-contain block"
                  referrerPolicy="no-referrer"
                />
              </a>
            </div>
            <div>
              <button
                type="button"
                id="footer-support-cta"
                onClick={() => setIsSupportOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/5 hover:border-white/10 text-white/50 hover:text-white/80 text-[11px] font-normal transition cursor-pointer"
                title="Support ❤️"
              >
                <span>Support</span>
                <span className="text-rose-400/60 text-[11px]">❤️</span>
              </button>
            </div>
          </div>
        </footer>
      </div>

      {/* Support Experience Popup Modal */}
      <SupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
      />

      {/* Booking Dialog Modal */}
      {bookingModalInfo && (
        <BookingModal
          room={bookingModalInfo.room}
          date={bookingModalInfo.date}
          startTime={bookingModalInfo.startTime}
          endTime={bookingModalInfo.endTime}
          initialPurpose={bookingModalInfo.purpose}
          staffList={staffUsers}
          academicSchedule={academicSchedule}
          adhocBookings={adhocBookings}
          institutionalBlocks={institutionalBlocks}
          onClose={() => setBookingModalInfo(null)}
          onSubmitBooking={handleSubmitBooking}
          onRequirePinChange={(st) => setMandatoryPinChangeStaff(st)}
        />
      )}

      {/* MANDATORY OWNER PIN CHANGE MODAL */}
      {mandatoryPinChangeStaff && (
        <SetPinModal
          staff={mandatoryPinChangeStaff}
          isOpen={true}
          onSuccess={handlePinChangeSuccess}
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
