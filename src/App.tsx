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
  PurposeCategory 
} from './types';
import { 
  getStoredRooms, 
  getStoredAcademicSchedule, 
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
  saveBookingToCloud, 
  deleteBookingFromCloud, 
  saveBlockToCloud, 
  deleteBlockFromCloud 
} from './lib/firebase';

import { Header, ActiveTab } from './components/Header';
import { QuickBookingSearch } from './components/QuickBookingSearch';
import { RoomAvailabilityMatrix } from './components/RoomAvailabilityMatrix';
import { AcademicScheduleView } from './components/AcademicScheduleView';
import { MyBookingsView } from './components/MyBookingsView';
import { RoomDirectoryView } from './components/RoomDirectoryView';
import { AdminManagementView } from './components/AdminManagementView';
import { BookingModal } from './components/BookingModal';
import { QRCodeModal } from './components/QRCodeModal';

import { Building2, Shield, Heart, Sparkles, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('search');

  // State loaded from local storage persistence
  const [rooms, setRooms] = useState<Room[]>([]);
  const [academicSchedule, setAcademicSchedule] = useState<AcademicScheduleSlot[]>([]);
  const [adhocBookings, setAdhocBookings] = useState<AdHocBooking[]>([]);
  const [institutionalBlocks, setInstitutionalBlocks] = useState<InstitutionalBlock[]>([]);

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

  useEffect(() => {
    setRooms(getStoredRooms());
    setAcademicSchedule(getStoredAcademicSchedule());

    // Subscribe to Firestore for real-time multi-device booking synchronization
    const unsubBookings = subscribeToBookings((cloudBookings) => {
      setAdhocBookings(cloudBookings);
      saveStoredAdHocBookings(cloudBookings);
    });

    const unsubBlocks = subscribeToBlocks((cloudBlocks) => {
      setInstitutionalBlocks(cloudBlocks);
      saveStoredInstitutionalBlocks(cloudBlocks);
    });

    return () => {
      unsubBookings();
      unsubBlocks();
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
      case 'matrix': return 'Matriks Ketersediaan Ruang';
      case 'academic': return 'Jadual Akademik Sedia Ada';
      case 'mybookings': return 'Tempahan Saya & Pas QR';
      case 'directory': return 'Direktori 33 Ruang KPMBP';
      case 'admin': return 'Pentadbir & Lock Manager';
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
        setActiveTab={setActiveTab}
        pendingCount={pendingCount}
      />

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden min-h-screen">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">Modul /</span>
            <span className="text-slate-900 font-bold">{getTabBreadcrumb(activeTab)}</span>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="relative cursor-pointer hover:opacity-80 transition" title="Notifikasi">
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              <span className="text-lg">🔔</span>
            </div>
            
            <div className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 text-slate-700">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span>Server: <strong className="text-slate-900">ONLINE</strong></span>
            </div>
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
              onApproveBooking={handleApproveBooking}
              onRejectBooking={handleRejectBooking}
              onAddBlock={handleAddBlock}
              onDeleteBlock={handleDeleteBlock}
              onResetData={handleResetData}
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
    </div>
  );
}
