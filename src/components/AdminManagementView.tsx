import React, { useState } from 'react';
import { 
  AdHocBooking, 
  InstitutionalBlock, 
  Room, 
  AcademicScheduleSlot,
  StaffUser 
} from '../types';
import { formatDateMalay, exportBookingsToCSV } from '../utils/availabilityEngine';
import { parseTimetableCSV, exportTimetableToStandardGridCSV } from '../utils/timetableCsvParser';
import { MASTER_TIMETABLE_CSV, STANDARD_GRID_TEMPLATE_CSV } from '../data/initialData';
import { CloudSyncModal } from './CloudSyncModal';
import { updateStaffPinInCloud } from '../lib/firebase';
import { WhatsAppIcon } from './WhatsAppIcon';
import { 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Trash2, 
  RotateCcw, 
  AlertTriangle,
  Building,
  Calendar,
  Clock,
  User,
  FileSpreadsheet,
  Download,
  UploadCloud,
  RefreshCw,
  Users,
  Mail,
  Phone,
  Search,
  Check,
  BookOpen,
  Sparkles,
  Layers,
  Cloud,
  LogOut,
  MapPin
} from 'lucide-react';
import { 
  ROOMS_CSV_HEADERS, 
  SAMPLE_ROOMS_CSV_TEMPLATE, 
  exportRoomsToCSV, 
  downloadRoomsCSVTemplate, 
  parseRoomsCSV 
} from '../utils/roomsCsvParser';
import { formatLevel } from '../utils/storage';

interface AdminManagementViewProps {
  bookings: AdHocBooking[];
  institutionalBlocks: InstitutionalBlock[];
  rooms: Room[];
  staffList?: StaffUser[];
  academicSchedule?: AcademicScheduleSlot[];
  onApproveBooking: (id: string) => void;
  onRejectBooking: (id: string) => void;
  onAddBlock: (block: Omit<InstitutionalBlock, 'id'>) => void;
  onDeleteBlock: (id: string) => void;
  onResetData: () => void;
  onSyncStaffUsers?: (staff: StaffUser[], mode?: 'merge' | 'replace', resetAllPins?: boolean) => Promise<{ written: number; deleted: number } | void>;
  onSyncAcademicSchedule?: (schedule: AcademicScheduleSlot[], mode?: 'merge' | 'replace') => Promise<void> | void;
  onClearAcademicSchedule?: () => Promise<void> | void;
  onSyncRooms?: (rooms: Room[], mode?: 'merge' | 'replace') => Promise<void> | void;
  onLogoutAdmin?: () => void;
}

export const AdminManagementView: React.FC<AdminManagementViewProps> = ({
  bookings,
  institutionalBlocks,
  rooms,
  staffList = [],
  academicSchedule = [],
  onApproveBooking,
  onRejectBooking,
  onAddBlock,
  onDeleteBlock,
  onResetData,
  onSyncStaffUsers,
  onSyncAcademicSchedule,
  onClearAcademicSchedule,
  onSyncRooms,
  onLogoutAdmin
}) => {
  const pendingBookings = bookings.filter(b => b.status === 'PENDING');

  // Form for adding institutional block
  const [blockRoomId, setBlockRoomId] = useState<string>('DEWAN_BESAR');
  const [blockDate, setBlockDate] = useState<string>('2026-08-10');
  const [blockStartTime, setBlockStartTime] = useState<string>('08:00');
  const [blockEndTime, setBlockEndTime] = useState<string>('17:00');
  const [blockTitle, setBlockTitle] = useState<string>('');
  const [blockReason, setBlockReason] = useState<string>('');
  const [blockCreatedBy, setBlockCreatedBy] = useState<string>('Hal Ehwal Pelajar (HEP)');

  // Timetable CSV Sync State
  const [scheduleCsvFile, setScheduleCsvFile] = useState<File | null>(null);
  const [parsedScheduleSlots, setParsedScheduleSlots] = useState<AcademicScheduleSlot[]>([]);
  const [scheduleParseSummary, setScheduleParseSummary] = useState<{ totalRowsProcessed: number; validSlotsCount: number; roomsAffected: string[] } | null>(null);
  const [scheduleParseErrors, setScheduleParseErrors] = useState<string[]>([]);
  const [isSyncingSchedule, setIsSyncingSchedule] = useState<boolean>(false);
  const [scheduleSyncSuccessMsg, setScheduleSyncSuccessMsg] = useState<string | null>(null);
  const [scheduleSyncMode, setScheduleSyncMode] = useState<'merge' | 'replace'>('replace');
  const [showClearScheduleModal, setShowClearScheduleModal] = useState<boolean>(false);
  const [isClearingSchedule, setIsClearingSchedule] = useState<boolean>(false);
  const [showConfirmTotalOverwriteModal, setShowConfirmTotalOverwriteModal] = useState<boolean>(false);

  // Staff CSV Sync State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedStaffList, setParsedStaffList] = useState<StaffUser[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [staffSearchTerm, setStaffSearchTerm] = useState<string>('');
  const [showCloudSyncModal, setShowCloudSyncModal] = useState<boolean>(false);
  const [staffSyncMode, setStaffSyncMode] = useState<'merge' | 'replace'>('merge');
  const [resetAllPinsOnSync, setResetAllPinsOnSync] = useState<boolean>(false);

  // Rooms CSV Sync State
  const [roomCsvFile, setRoomCsvFile] = useState<File | null>(null);
  const [parsedRoomsList, setParsedRoomsList] = useState<Room[]>([]);
  const [roomParseSummary, setRoomParseSummary] = useState<{ total: number; updated: number; added: number; roomsAffected: string[] } | null>(null);
  const [roomParseErrors, setRoomParseErrors] = useState<string[]>([]);
  const [isSyncingRooms, setIsSyncingRooms] = useState<boolean>(false);
  const [roomSyncSuccessMsg, setRoomSyncSuccessMsg] = useState<string | null>(null);
  const [roomSyncMode, setRoomSyncMode] = useState<'merge' | 'replace'>('merge');
  const [roomSearchTerm, setRoomSearchTerm] = useState<string>('');

  // Download Standard Timetable CSV Template (Format Perkara/Hari yang diselaraskan)
  const handleDownloadStandardGridTemplate = () => {
    const csvContent = STANDARD_GRID_TEMPLATE_CSV;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'kpmbp_jadual_perkara_hari_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Full Master Timetable CSV (Format FET / Unit Jadual Waktu)
  const handleDownloadTimetableCSVTemplate = () => {
    const csvContent = MASTER_TIMETABLE_CSV;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'jadual_waktu_kolej_master_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export current active schedule to standard grid CSV
  const handleExportCurrentScheduleCSV = () => {
    if (!academicSchedule || academicSchedule.length === 0) {
      alert('Tiada slot jadual waktu semasa untuk dieksport.');
      return;
    }
    const csvContent = exportTimetableToStandardGridCSV(academicSchedule, rooms, { includeNightSlots: true });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `kpmbp_jadual_rasmi_terkini_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Timetable CSV File Handler with Auto-Sync to Firebase
  const handleScheduleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScheduleCsvFile(file);
    setScheduleSyncSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const res = parseTimetableCSV(text, rooms);
      setParsedScheduleSlots(res.slots);
      setScheduleParseSummary(res.summary);
      setScheduleParseErrors(res.errors);

      // Auto-sync immediately to Firebase Cloud when slots are successfully parsed
      if (res.slots.length > 0 && onSyncAcademicSchedule) {
        setIsSyncingSchedule(true);
        try {
          await onSyncAcademicSchedule(res.slots, scheduleSyncMode);
          if (scheduleSyncMode === 'replace') {
            setScheduleSyncSuccessMsg(
              `🟢 Berjaya auto-sync & MENGUNCI ${res.slots.length} slot baharu merentasi ${res.summary.roomsAffected.length} ruang ke Cloud Firebase (Mod Ganti Sepenuhnya)!`
            );
          } else {
            setScheduleSyncSuccessMsg(
              `🟢 Berjaya auto-sync & menggabungkan ${res.slots.length} slot jadual di ${res.summary.roomsAffected.length} ruang ke Cloud Firebase!`
            );
          }
        } catch (err) {
          console.error('Schedule auto sync error:', err);
        } finally {
          setIsSyncingSchedule(false);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleTriggerScheduleSync = () => {
    if (parsedScheduleSlots.length === 0) {
      alert('Tiada slot jadual waktu CSV yang sah untuk disinkronkan.');
      return;
    }

    if (scheduleSyncMode === 'replace') {
      setShowConfirmTotalOverwriteModal(true);
    } else {
      executeActualSync('merge');
    }
  };

  const executeActualSync = async (mode: 'merge' | 'replace') => {
    if (onSyncAcademicSchedule) {
      setIsSyncingSchedule(true);
      try {
        await onSyncAcademicSchedule(parsedScheduleSlots, mode);
        setShowConfirmTotalOverwriteModal(false);
        if (mode === 'replace') {
          setScheduleSyncSuccessMsg(
            `🟢 Berjaya membersihkan jadual terdahulu dan MENGUNCI ${parsedScheduleSlots.length} slot baharu merentasi ${scheduleParseSummary?.roomsAffected.length || 0} ruang (Mod Ganti Sepenuhnya)!`
          );
        } else {
          setScheduleSyncSuccessMsg(
            `🟢 Berjaya menggabungkan dan mengemas kini ${parsedScheduleSlots.length} slot di ${scheduleParseSummary?.roomsAffected.length || 0} ruang!`
          );
        }
      } catch (err) {
        alert('Gagal menyinkronkan data jadual waktu.');
      } finally {
        setIsSyncingSchedule(false);
      }
    } else {
      setShowConfirmTotalOverwriteModal(false);
      setScheduleSyncSuccessMsg(`🟢 Berjaya memproses ${parsedScheduleSlots.length} slot jadual secara tempatan!`);
    }
  };

  const handleExecuteClearSchedule = async () => {
    if (!onClearAcademicSchedule) {
      alert('Fungsi pembersihan jadual tidak tersedia.');
      return;
    }
    setIsClearingSchedule(true);
    try {
      await onClearAcademicSchedule();
      setShowClearScheduleModal(false);
      setParsedScheduleSlots([]);
      setScheduleCsvFile(null);
      setScheduleParseSummary(null);
      setScheduleSyncSuccessMsg(
        `🟢 Semua data jadual akademik telah berjaya dibersihkan sepenuhnya (0 slot aktif). Semua bilik kini berstatus kosong dan sedia ditempah secara ad-hoc.`
      );
    } catch (err) {
      alert('Ralat semasa membersihkan data jadual akademik.');
    } finally {
      setIsClearingSchedule(false);
    }
  };

  const handleCreateBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockTitle.trim()) {
      alert('Sila masukkan tajuk program/aktiviti!');
      return;
    }

    onAddBlock({
      roomId: blockRoomId,
      date: blockDate,
      startTime: blockStartTime,
      endTime: blockEndTime,
      title: blockTitle,
      reason: blockReason || 'Program Rasmi Kolej',
      createdBy: blockCreatedBy
    });

    setBlockTitle('');
    setBlockReason('');
    alert('🟢 Block Institusi berjaya diletakkan pada ruang!');
  };

  // Download Example CSV Template (6 official profile fields only - NO credentials)
  const handleDownloadCSVTemplate = () => {
    const csvContent = 
`id,department,name,role,phone,email
ST001,Pengurusan,Pn. Maznah Binti Ismail,Pensyarah,019-1234567,maznah.ismail@kpmbp.edu.my
ST002,Perakaunan,En. Rosli Bin Ahmad,Pensyarah,012-9876543,rosli.ahmad@kpmbp.edu.my
ST003,Pengajian Am,Cik Siti Sarah Binti Razak,Pensyarah,013-5558899,siti.sarah@kpmbp.edu.my`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'kpmbp_staf_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Registered Staff Profiles to CSV (Standard Profile Export - NO PIN credentials)
  const handleExportStaffListCSV = () => {
    const header = 'id,department,name,role,phone,email';
    const rows = staffList.map(s => 
      `"${s.id}","${(s.department || '').replace(/"/g, '""')}","${(s.name || '').replace(/"/g, '""')}","${(s.role || '').replace(/"/g, '""')}","${s.phone || ''}","${s.email || ''}"`
    );
    const csvContent = [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `kpmbp_senarai_staf_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Ad-Hoc Bookings to CSV (Full Backup with all 17 fields & UTF-8 BOM)
  const handleExportBookingsCSV = (filterStatus: 'ALL' | 'CONFIRMED' | 'PENDING' = 'ALL') => {
    let toExport = bookings;
    let label = 'semua';
    if (filterStatus === 'CONFIRMED') {
      toExport = bookings.filter(b => b.status === 'CONFIRMED');
      label = 'disahkan';
    } else if (filterStatus === 'PENDING') {
      toExport = bookings.filter(b => b.status === 'PENDING');
      label = 'menunggu';
    }

    if (toExport.length === 0) {
      alert(`Tiada rekod tempahan ad-hoc (${label}) untuk dieksport.`);
      return;
    }

    const res = exportBookingsToCSV(toExport, `kpmbp_tempahan_adhoc_${label}_backup`);
    if (res.success) {
      alert(`✅ Berjaya memuat turun fail sandaran: ${res.filename} (${res.count} rekod tempahan).`);
    }
  };

  // Export current rooms list to CSV
  const handleExportRoomsListCSV = () => {
    if (!rooms || rooms.length === 0) {
      alert('Tiada maklumat ruang untuk dieksport.');
      return;
    }
    const res = exportRoomsToCSV(rooms);
    if (res.success) {
      alert(`✅ Berjaya mengeksport ${res.count} ruang ke ${res.filename}`);
    }
  };

  // Download sample rooms CSV template
  const handleDownloadRoomsCSVTemplate = () => {
    downloadRoomsCSVTemplate();
  };

  // Handle uploaded rooms CSV file
  const handleRoomFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRoomCsvFile(file);
    setRoomParseErrors([]);
    setRoomSyncSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setRoomParseErrors(['Fail CSV kosong atau tidak dapat dibaca.']);
        return;
      }

      const result = parseRoomsCSV(text, rooms);
      setParsedRoomsList(result.rooms);
      setRoomParseSummary(result.summary);
      setRoomParseErrors(result.errors);
    };

    reader.onerror = () => {
      setRoomParseErrors(['Ralat semasa membaca fail CSV.']);
    };

    reader.readAsText(file);
  };

  // Execute sync rooms to system and cloud
  const handleSyncRoomsToSystem = async () => {
    if (parsedRoomsList.length === 0) {
      alert('Tiada data ruang yang sah untuk disinkronkan.');
      return;
    }

    if (roomSyncMode === 'replace') {
      const confirmed = window.confirm(
        `⚠️ AMARAN: Mod 'Ganti Semua' dipilih!\n\nSemua ${rooms.length} ruang sedia ada akan digantikan sepenuhnya dengan ${parsedRoomsList.length} ruang daripada fail CSV.\n\nAdakah anda pasti mahu meneruskan?`
      );
      if (!confirmed) return;
    }

    setIsSyncingRooms(true);
    setRoomSyncSuccessMsg(null);

    try {
      if (onSyncRooms) {
        await onSyncRooms(parsedRoomsList, roomSyncMode);
      }
      setRoomSyncSuccessMsg(
        `✅ Berjaya menyinkronkan ${parsedRoomsList.length} ruang (${roomParseSummary?.updated || 0} dikemaskini, ${roomParseSummary?.added || 0} ditambah) ke sistem!`
      );
      setRoomCsvFile(null);
      setParsedRoomsList([]);
      setRoomParseSummary(null);
    } catch (err) {
      setRoomParseErrors(['Gagal menyinkronkan data ruang ke pangkalan data.']);
    } finally {
      setIsSyncingRooms(false);
    }
  };

  // CSV File Handler with Auto-Sync to Firebase
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setSyncSuccessMsg(null);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSVText(text);

      // Auto-sync immediately to Firebase Cloud when staff records are parsed
      if (parsed && parsed.length > 0) {
        if (staffSyncMode === 'replace') {
          const confirmProceed = window.confirm(
            'PERHATIAN: Anda memilih mod "Ganti Semua (padam data lama)". Semua rekod staf di Cloud Firestore yang tiada di dalam fail CSV ini akan DIPADAMKAN secara kekal.\n\nAdakah anda pasti mahu meneruskan?'
          );
          if (!confirmProceed) {
            setCsvFile(null);
            setParsedStaffList([]);
            return;
          }
        }

        if (onSyncStaffUsers) {
          setIsSyncing(true);
          try {
            const res = await onSyncStaffUsers(parsed, staffSyncMode, resetAllPinsOnSync);
            const written = res && 'written' in res ? res.written : parsed.length;
            const deleted = res && 'deleted' in res ? res.deleted : 0;
            if (staffSyncMode === 'replace') {
              setSyncSuccessMsg(
                `🟢 Mod Ganti Semua berjaya! ${written} rekod staf disimpan, ${deleted} rekod lama telah dipadamkan dari Cloud Firebase.`
              );
            } else {
              setSyncSuccessMsg(`🟢 Berjaya auto-sync ${written} rekod staf ke Cloud Firebase secara automatik!`);
            }
          } catch (err) {
            console.error('Auto sync error:', err);
            alert('Ralat semasa auto-sync data staf ke Cloud Firebase.');
          } finally {
            setIsSyncing(false);
          }
        } else {
          setSyncSuccessMsg(`🟢 Berjaya memproses ${parsed.length} rekod staf secara tempatan.`);
        }
      }
    };
    reader.readAsText(file);
  };

  const parseCSVText = (text: string): StaffUser[] => {
    // 1. Tolerate UTF-8 BOM if present
    const cleanText = text.replace(/^\uFEFF/, '');
    const lines = cleanText.split(/\r\n|\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) {
      setParseErrors(['Fail CSV kosong atau tiada baris data selepas tajuk (header).']);
      setParsedStaffList([]);
      return [];
    }

    // Detect delimiter
    const headerLine = lines[0];
    const delimiter = headerLine.includes(';') ? ';' : ',';
    
    const headers = headerLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, '').trim());
    
    const findIndex = (keys: string[]) => {
      return headers.findIndex(h => keys.some(k => h.includes(k)));
    };

    const idIdx = findIndex(['id', 'staf']);
    const deptIdx = findIndex(['department', 'jabatan']);
    const nameIdx = findIndex(['name', 'nama']);
    const roleIdx = findIndex(['role', 'jawatan']);
    const phoneIdx = findIndex(['phone', 'telefon', 'tel']);
    const emailIdx = findIndex(['email', 'emel', 'e-mel']);
    const passcodeIdx = findIndex(['passcode', 'pin', 'code']);

    const parsed: StaffUser[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const rawLine = lines[i];
      if (!rawLine) continue;

      // 2. Trim every value and remove surrounding quotes
      const cols = rawLine.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, '').trim());
      
      const email = (emailIdx !== -1 ? cols[emailIdx] : cols[5] || '').trim();
      const name = (nameIdx !== -1 ? cols[nameIdx] : cols[2] || '').trim();
      const dept = (deptIdx !== -1 ? cols[deptIdx] : cols[1] || 'Umum').trim();
      const role = (roleIdx !== -1 ? cols[roleIdx] : cols[3] || 'Pensyarah').trim();
      const phone = (phoneIdx !== -1 ? cols[phoneIdx] : cols[4] || '').trim();
      const customId = (idIdx !== -1 ? cols[idIdx] : cols[0] || '').trim();
      const customPin = (passcodeIdx !== -1 ? cols[passcodeIdx] : '').trim();

      if (!email || !email.includes('@')) {
        errors.push(`Baris ${i + 1}: E-mel tidak sah ("${email}")`);
        continue;
      }

      if (!name) {
        errors.push(`Baris ${i + 1}: Nama tidak dinyatakan.`);
        continue;
      }

      // 3. Lowercase emails
      const cleanEmail = email.toLowerCase();
      const id = (customId || `ST-${String(parsed.length + 100).padStart(3, '0')}`).trim();

      // SES v4.4: Staff ID is PRIMARY IDENTITY. Email is an editable attribute.
      const existing = staffList.find(
        s => s.id && s.id.trim().toLowerCase() === id.toLowerCase()
      );

      let pin = '1234';
      let pinStatus: 'DEFAULT' | 'CUSTOM' = 'DEFAULT';
      let pinChangedAt: string | undefined = undefined;

      if (existing) {
        // EXISTING STAFF: Update profile fields ONLY, MUST PRESERVE existing credentials!
        const isCustom = existing.pinStatus === 'CUSTOM' && existing.pin && existing.pin !== '1234' && !!existing.pinChangedAt;
        pin = isCustom ? existing.pin : '1234';
        pinStatus = isCustom ? 'CUSTOM' : 'DEFAULT';
        pinChangedAt = isCustom ? existing.pinChangedAt : undefined;
      } else {
        // NEW STAFF: System automatically assigns default PIN 1234 & DEFAULT status
        pin = '1234';
        pinStatus = 'DEFAULT';
      }

      parsed.push({
        id,
        department: dept,
        name,
        role,
        phone,
        email: cleanEmail,
        pin,
        pinStatus,
        pinChangedAt
      });
    }

    setParseErrors(errors);
    setParsedStaffList(parsed);
    return parsed;
  };

  const handleExecuteSync = async () => {
    if (parsedStaffList.length === 0) {
      alert('Tiada data CSV yang sah untuk disinkronkan.');
      return;
    }

    if (staffSyncMode === 'replace') {
      const confirmProceed = window.confirm(
        'PERHATIAN: Anda memilih mod "Ganti Semua (padam data lama)". Semua rekod staf di Cloud Firestore yang tiada di dalam fail CSV ini akan DIPADAMKAN secara kekal.\n\nAdakah anda pasti mahu meneruskan?'
      );
      if (!confirmProceed) return;
    }

    const count = parsedStaffList.length;

    if (onSyncStaffUsers) {
      setIsSyncing(true);
      try {
        const res = await onSyncStaffUsers(parsedStaffList, staffSyncMode, resetAllPinsOnSync);
        const written = res && 'written' in res ? res.written : count;
        const deleted = res && 'deleted' in res ? res.deleted : 0;
        if (staffSyncMode === 'replace') {
          setSyncSuccessMsg(
            `🟢 Mod Ganti Semua berjaya! ${written} rekod staf disimpan, ${deleted} rekod lama telah dipadamkan dari Cloud Firebase.`
          );
        } else {
          setSyncSuccessMsg(`🟢 Berjaya menyinkronkan ${written} rekod staf ke Cloud Firebase!`);
        }
        setIsSyncing(false);
        // SES v4.4: CSV Preview workspace is temporary. Clear it after successful sync!
        setParsedStaffList([]);
        setCsvFile(null);
      } catch (err) {
        setIsSyncing(false);
        alert('Gagal menyinkronkan data ke Cloud.');
      }
    } else {
      setSyncSuccessMsg(`🟢 Berjaya memproses ${count} rekod staf secara tempatan!`);
      setParsedStaffList([]);
      setCsvFile(null);
    }
  };

  const [copiedPinId, setCopiedPinId] = useState<string | null>(null);
  const [resettingPinStaffId, setResettingPinStaffId] = useState<string | null>(null);

  const handleCopyPin = (st: StaffUser) => {
    navigator.clipboard.writeText(st.pin || '1234');
    setCopiedPinId(st.id);
    setTimeout(() => setCopiedPinId(null), 2500);
  };

  const handleResetStaffPin = async (st: StaffUser) => {
    const confirmReset = window.confirm(
      `Adakah anda pasti ingin menetapkan semula PIN untuk ${st.name} kepada PIN lalai (1234)?\n\nStaf akan diminta menetapkan PIN 4-digit baharu semasa log masuk seterusnya.`
    );
    if (!confirmReset) return;

    setResettingPinStaffId(st.id);
    try {
      await updateStaffPinInCloud(st.id, '1234', 'DEFAULT');
      if (onSyncStaffUsers) {
        const updated = staffList.map(item =>
          item.id === st.id ? { ...item, pin: '1234', pinStatus: 'DEFAULT' as const } : item
        );
        await onSyncStaffUsers(updated);
      }
      alert(`PIN untuk ${st.name} telah berjaya diset semula kepada 1234 (Lalai).`);
    } catch (err) {
      alert('Ralat semasa menetapkan semula PIN staf.');
    } finally {
      setResettingPinStaffId(null);
    }
  };

  const [isResettingAllPins, setIsResettingAllPins] = useState<boolean>(false);

  const handleResetAllPinsToDefault = async () => {
    const confirmReset = window.confirm(
      'Adakah anda pasti ingin menetapkan semula SEMUA staf kepada PIN lalai (1234)?\n\nSemua akaun akan berstatus lalai dan diminta menetapkan PIN keselamatan sendiri semasa log masuk kali pertama.'
    );
    if (!confirmReset) return;

    setIsResettingAllPins(true);
    try {
      const resetList: StaffUser[] = staffList.map(item => ({
        ...item,
        pin: '1234',
        pinStatus: 'DEFAULT' as const,
        pinChangedAt: undefined
      }));
      if (onSyncStaffUsers) {
        await onSyncStaffUsers(resetList);
      }
      alert('🟢 Berjaya! Semua PIN staf telah ditetapkan semula kepada 1234 (Lalai) dan disinkronkan ke Cloud Firebase.');
    } catch (err) {
      alert('Ralat semasa menetapkan semula semua PIN staf.');
    } finally {
      setIsResettingAllPins(false);
    }
  };

  const filteredStaffList = staffList.filter(s => 
    s.name.toLowerCase().includes(staffSearchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(staffSearchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-bold mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Mod Pentadbir & Pengurusan Block
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              Kawalan Pentadbir & Kelulusan Tempahan
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm mt-0.5">
              Luluskan permohonan tempahan ad-hoc, sekat ruang untuk aktiviti rasmi, dan kemas kini senarai staf via CSV.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowCloudSyncModal(true)}
              className="bg-blue-900/80 hover:bg-blue-800 text-blue-100 border border-blue-700/80 text-xs font-semibold py-2 px-3.5 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-xs"
              title="Status Firebase Cloud Firestore Multi-Device"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Cloud className="w-3.5 h-3.5 text-blue-300" />
              <span>Status Cloud Sync</span>
            </button>

            {onLogoutAdmin && (
              <button
                id="btn-admin-panel-logout"
                onClick={onLogoutAdmin}
                className="bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold border border-amber-400 text-xs py-2 px-3.5 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-md shadow-amber-950/20"
                title="Log keluar dari mod admin dan kembali ke paparan utama"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-950" />
                <span>Log Keluar Admin</span>
              </button>
            )}

            <button
              onClick={() => {
                if (confirm('Adakah anda pasti mahu menetapkan semula (reset) semua data ke nilai asal KPMBP (Zero Demo Data)?')) {
                  onResetData();
                }
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold py-2 px-3.5 rounded-xl transition flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Reset Data Asal</span>
            </button>

            <button
              onClick={() => {
                if (confirm('Adakah anda pasti mahu membersihkan sebarang sisa data demo daripada peranti dan pangkalan data Cloud?')) {
                  onResetData();
                }
              }}
              className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-100 border border-rose-800/80 text-xs font-semibold py-2 px-3.5 rounded-xl transition flex items-center gap-2 cursor-pointer"
              title="Pembersihan sifar data demo"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
              <span>Sahkan Sifar Data Demo</span>
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mt-4 text-xs">
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
            <span className="text-slate-400 block font-medium">Permohonan Menunggu:</span>
            <strong className="text-xl font-bold text-amber-400">{pendingBookings.length} Permohonan</strong>
          </div>
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
            <span className="text-slate-400 block font-medium">Institutional Block:</span>
            <strong className="text-xl font-bold text-indigo-300">{institutionalBlocks.length} Block</strong>
          </div>
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80 flex flex-col justify-between">
            <div>
              <span className="text-slate-400 block font-medium">Tempahan Ad-Hoc:</span>
              <strong className="text-xl font-bold text-emerald-400">{bookings.length} Rekod</strong>
            </div>
            <button
              type="button"
              onClick={() => handleExportBookingsCSV('ALL')}
              className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-2.5 rounded-lg text-[11px] transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              title="Muat turun sandaran CSV semua tempahan adhoc masuk"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Eksport Sandaran CSV</span>
            </button>
          </div>
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80 flex flex-col justify-between">
            <div>
              <span className="text-slate-400 block font-medium">Direktori Ruang Kuliah:</span>
              <strong className="text-xl font-bold text-cyan-400">{rooms.length} Ruang &amp; Fasiliti</strong>
            </div>
            <button
              type="button"
              onClick={handleExportRoomsListCSV}
              className="mt-2 w-full bg-cyan-700 hover:bg-cyan-600 text-white font-bold py-1.5 px-2.5 rounded-lg text-[11px] transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              title="Muat turun data direktori ruang semasa ke fail CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Eksport CSV Ruang</span>
            </button>
          </div>
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
            <span className="text-slate-400 block font-medium">Jadual Akademik Aktif:</span>
            <strong className="text-xl font-bold text-blue-400">{academicSchedule.length} Slot Terkunci</strong>
          </div>
        </div>
      </div>

      {/* SECTION: TIMETABLE CSV UPLOAD & AUTOMATIC ROOM LOCKING */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200 space-y-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full text-xs font-bold mb-1">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Unit Jadual Waktu &amp; Penguncian Slot Kolej</span>
            </div>
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-lg">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              <h3>Penyelarasan Data CSV &amp; Ketetapan Slot Terkunci (Locked)</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Admin boleh menetapkan dan menyinkronkan slot yang akan dikunci (locked) menggunakan fail CSV mengikut format standard <code>Perkara, Hari, [Slot Masa...]</code>.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleDownloadStandardGridTemplate}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 text-xs font-bold py-2 px-3 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Muat turun templat CSV format standard matriks jadual"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>Templat Standard (Perkara/Hari)</span>
            </button>

            <button
              onClick={handleExportCurrentScheduleCSV}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold py-2 px-3 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Eksport jadual waktu aktif semasa ke fail CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Eksport CSV Semasa</span>
            </button>

            <button
              onClick={() => setShowClearScheduleModal(true)}
              disabled={academicSchedule.length === 0}
              className="bg-rose-50 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed text-rose-800 border border-rose-300 text-xs font-bold py-2 px-3 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Kosongkan dan padamkan semua rekod jadual kuliah sedia ada dari sistem"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Kosongkan Semua ({academicSchedule.length} Slot)</span>
            </button>
          </div>
        </div>

        {/* Upload Zone & Instructions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-3">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Ketetapan Susunan CSV (Locked Slots)</span>
            </h4>
            <p className="text-slate-600 leading-relaxed">
              Format ini bertindak sebagai <em>source of truth</em> rasmi. Admin menyusun baris mengikut ruang dan hari:
            </p>
            <div className="bg-slate-900 text-indigo-300 p-2.5 rounded-lg font-mono text-[10.5px] overflow-x-auto border border-slate-800 leading-tight">
              Perkara,Hari,8:30 - 9:30,9:30 - 10:30,...<br />
              SURAU 1,MON,AFIF,AFIF,,...<br />
              SURAU 2,MON,NIZAM,NIZAM,,...
            </div>
            <ul className="space-y-1.5 text-slate-600 text-[11px]">
              <li className="flex items-start gap-1.5">
                <span className="text-indigo-600 font-bold">•</span>
                <span><strong>Ruang (Perkara)</strong>: Kod atau nama ruang (cth: <code>SURAU 1</code>, <code>SURAU 2</code>, <code>BK01</code>, <code>DEWAN MAKAN</code>).</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-indigo-600 font-bold">•</span>
                <span><strong>Hari</strong>: <code>MON</code>, <code>TUE</code>, <code>WED</code>, <code>THU</code>, <code>FRI</code> atau ejaan Bahasa Melayu.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-rose-600 font-bold">•</span>
                <span><strong>Slot Bernilai (Locked)</strong>: Sebarang nama (cth: <code>AFIF</code>, <code>NIZAM</code>, atau subjek) akan <strong>mengunci slot</strong> secara automatik dari tempahan umum.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-600 font-bold">•</span>
                <span><strong>Slot Kosong (Available)</strong>: Biarkan sel kosong untuk membiarkan slot dibuka untuk tempahan ad-hoc.</span>
              </li>
            </ul>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={handleDownloadTimetableCSVTemplate}
                className="text-[11px] text-slate-500 hover:text-indigo-600 underline cursor-pointer"
              >
                Muat turun templat format penuh FET/Unit Jadual
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {/* Sync Mode Selection Cards */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Pilihan Mod Penyelarasan Jadual Waktu:
                </span>
                <span className="text-[11px] font-normal text-slate-500">
                  Jadual aktif semasa di sistem: <strong className="text-indigo-900 font-bold">{academicSchedule.length} slot</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option 1: Total Overwrite */}
                <div 
                  onClick={() => setScheduleSyncMode('replace')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between gap-2.5 ${
                    scheduleSyncMode === 'replace'
                      ? 'bg-amber-50/80 border-amber-500 shadow-sm ring-2 ring-amber-400/20'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="scheduleSyncMode"
                        value="replace"
                        checked={scheduleSyncMode === 'replace'}
                        onChange={() => setScheduleSyncMode('replace')}
                        className="text-amber-600 focus:ring-amber-500 mt-0.5"
                      />
                      <div>
                        <span className="font-extrabold text-slate-900 text-xs block leading-tight">
                          Ganti Sepenuhnya (Total Overwrite)
                        </span>
                        <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wide">
                          Bersihkan Lama &amp; Ganti Baharu
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 shrink-0">
                      Disyorkan
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed pl-5">
                    Memadamkan kesemua <strong>{academicSchedule.length} slot sedia ada</strong> secara bersih dari Cloud Firestore dan menggantikannya 100% dengan fail jadual baharu ini (Sesuai semester baharu).
                  </p>
                </div>

                {/* Option 2: Merge Mode */}
                <div 
                  onClick={() => setScheduleSyncMode('merge')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between gap-2.5 ${
                    scheduleSyncMode === 'merge'
                      ? 'bg-indigo-50/80 border-indigo-500 shadow-sm ring-2 ring-indigo-400/20'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="scheduleSyncMode"
                        value="merge"
                        checked={scheduleSyncMode === 'merge'}
                        onChange={() => setScheduleSyncMode('merge')}
                        className="text-indigo-600 focus:ring-indigo-500 mt-0.5"
                      />
                      <div>
                        <span className="font-extrabold text-slate-900 text-xs block leading-tight">
                          Gabung &amp; Kemas Kini (Merge)
                        </span>
                        <span className="text-[10px] text-indigo-700 font-bold uppercase tracking-wide">
                          Kemas Kini Bilik Terlibat Sahaja
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 shrink-0">
                      Kemas Kini Terhad
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed pl-5">
                    Hanya mengemas kini bilik-bilik yang disenaraikan dalam fail CSV ini. Bilik-bilik lain yang tidak terdapat dalam fail dikekalkan.
                  </p>
                </div>
              </div>
            </div>

            <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer relative ${
              isSyncingSchedule
                ? 'border-indigo-500 bg-indigo-50/60'
                : 'border-indigo-200 hover:border-indigo-500 bg-indigo-50/20 hover:bg-indigo-50/50'
            }`}>
              <input
                type="file"
                accept=".csv"
                onChange={handleScheduleFileUpload}
                disabled={isSyncingSchedule}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                title="Pilih fail CSV jadual waktu untuk auto-sync ke Firebase"
              />
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold border border-indigo-300 mb-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                <span>Auto-Sync ke Firebase Aktif</span>
              </div>
              <UploadCloud className={`w-10 h-10 mx-auto mb-2 ${isSyncingSchedule ? 'text-indigo-600 animate-bounce' : 'text-indigo-600'}`} />
              <div className="font-bold text-slate-800 text-sm">
                {isSyncingSchedule ? (
                  <span className="text-indigo-700 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                    Sedang auto-sync jadual ke Firebase Cloud...
                  </span>
                ) : scheduleCsvFile ? (
                  `Fail dipilih: ${scheduleCsvFile.name}`
                ) : (
                  'Pilih atau Tarik Fail CSV Jadual Waktu di Sini'
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {isSyncingSchedule
                  ? 'Slot jadual sedang disinkronkan dan dikunci secara langsung ke Cloud Firestore...'
                  : 'Slot jadual akan auto-sync dan dikunci ke Firebase sebaik sahaja fail CSV dimasukkan (format Perkara/Hari atau fail FET).'}
              </p>
            </div>

            {/* Parse Errors */}
            {scheduleParseErrors.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Ralat pembacaan CSV:</span>
                </div>
                {scheduleParseErrors.map((err, idx) => (
                  <div key={idx} className="pl-5 text-[11px]">• {err}</div>
                ))}
              </div>
            )}

            {/* Sync Success Message */}
            {scheduleSyncSuccessMsg && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 text-xs font-bold text-emerald-800 flex items-start gap-2.5 shadow-xs">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{scheduleSyncSuccessMsg}</span>
              </div>
            )}

            {/* Parsed Schedule Summary & Table Preview */}
            {parsedScheduleSlots.length > 0 && (
              <div className="space-y-3 pt-2">
                {scheduleSyncMode === 'replace' && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-950 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Pengesanan Mod Ganti Sepenuhnya (Clean Overwrite):</strong>
                      <span className="text-[11px] text-amber-900 leading-relaxed block mt-0.5">
                        Sistem akan <strong>membersihkan kesemua {academicSchedule.length} slot lama</strong> dan menggantikannya dengan <strong>{parsedScheduleSlots.length} slot baharu</strong> di Cloud Firestore.
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-indigo-50/80 p-3.5 rounded-xl border border-indigo-200">
                  <div className="text-xs">
                    <span className="font-bold text-indigo-950 block text-sm">Ringkasan Imbasan Jadual Waktu:</span>
                    <span className="text-indigo-800 text-[11px] mt-0.5 block">
                      <strong>{scheduleParseSummary?.validSlotsCount} slot terkunci</strong> dikesan merentasi <strong>{scheduleParseSummary?.roomsAffected.join(', ')}</strong> ({scheduleParseSummary?.roomsAffected.length} ruang).
                    </span>
                  </div>

                  <button
                    onClick={handleTriggerScheduleSync}
                    disabled={isSyncingSchedule}
                    className={`font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-md shrink-0 active:scale-95 cursor-pointer text-white ${
                      scheduleSyncMode === 'replace'
                        ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30'
                    }`}
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncingSchedule ? 'animate-spin' : ''}`} />
                    <span>
                      {isSyncingSchedule 
                        ? 'Sedang Memproses...' 
                        : scheduleSyncMode === 'replace' 
                          ? `GANTIKAN SEMUA (${parsedScheduleSlots.length} SLOT)` 
                          : `GABUNGKAN ${parsedScheduleSlots.length} SLOT`}
                    </span>
                  </button>
                </div>

                <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="p-2">Ruang / BK</th>
                        <th className="p-2">Hari</th>
                        <th className="p-2">Masa</th>
                        <th className="p-2">Kod Subjek</th>
                        <th className="p-2">Kelas</th>
                        <th className="p-2">Pensyarah</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {parsedScheduleSlots.slice(0, 50).map((slot, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 font-bold text-indigo-700">{slot.roomId}</td>
                          <td className="p-2 font-medium">{slot.dayOfWeek}</td>
                          <td className="p-2 text-slate-600 font-mono text-[11px]">{slot.startTime} - {slot.endTime}</td>
                          <td className="p-2 font-bold">{slot.courseCode === 'TERKUNCI' ? 'LOCKED' : slot.courseCode}</td>
                          <td className="p-2 text-slate-700">{slot.className}</td>
                          <td className="p-2 text-slate-600 truncate max-w-[150px]">{slot.lecturerName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedScheduleSlots.length > 50 && (
                    <div className="p-2 text-center text-xs text-slate-500 bg-slate-50 border-t border-slate-200">
                      ... dan {parsedScheduleSlots.length - 50} slot lagi.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION: BUNDLE CSV IMPORT & SYNCHRONIZATION */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200 space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-lg">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <h3>Import & Sinkronisasi E-mel Staf (Bundle CSV)</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Muat naik fail CSV untuk menambah atau mengemaskini senarai e-mel staf berdaftar bagi pengesahan automatik tempahan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleExportStaffListCSV}
              className="bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold py-2 px-3.5 rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer"
              title="Eksport senarai profil staf ke CSV (tanpa PIN credential)"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-600" />
              <span>Eksport Profil Staf (.csv)</span>
            </button>

            <button
              onClick={handleDownloadCSVTemplate}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold py-2 px-3.5 rounded-xl transition flex items-center gap-2 shadow-xs shrink-0 cursor-pointer"
              title="Muat turun templat CSV rasmi (6 medan asas tanpa PIN)"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Muat Turun Template CSV (.csv)</span>
            </button>
          </div>
        </div>

        {/* Upload Zone & Instructions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-3">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Panduan Format Header CSV</span>
            </h4>
            <p className="text-slate-600 leading-relaxed">
              Muat naik fail CSV yang mengandungi 6 maklumat asas profil staf:
            </p>
            <div className="bg-slate-900 text-amber-300 p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto border border-slate-800">
              id,department,name,role,phone,email
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-blue-900 text-[11px] space-y-1">
              <p className="font-bold flex items-center gap-1 text-blue-950">
                <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>PIN tidak perlu dimasukkan.</span>
              </p>
              <p className="text-blue-800/90 leading-relaxed text-[10.5px]">
                Sistem akan menetapkan PIN lalai <strong className="font-mono font-bold">1234</strong> secara automatik untuk staf baharu. Staf akan diminta menukar PIN tersebut semasa log masuk kali pertama. Bagi staf sedia ada, PIN tersendiri akan dikekalkan.
              </p>
            </div>

            <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
              <li><strong>email</strong>: Alamat e-mel rasmi kolej (@kpmbp.edu.my)</li>
              <li><strong>phone</strong>: Nombor telefon bimbit untuk urusan WhatsApp</li>
              <li><strong>department / role</strong>: Jabatan dan jawatan pensyarah/staf</li>
            </ul>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {/* Staff Sync Mode Selection Cards */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  Pilihan Mod Penyelarasan E-mel &amp; Profil Staf:
                </span>
                <span className="text-[11px] font-normal text-slate-500">
                  Staf berdaftar semasa di sistem: <strong className="text-emerald-900 font-bold">{staffList.length} orang</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option 1: Gabung (kemaskini & tambah) */}
                <div 
                  onClick={() => setStaffSyncMode('merge')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between gap-2.5 ${
                    staffSyncMode === 'merge'
                      ? 'bg-emerald-50/80 border-emerald-500 shadow-sm ring-2 ring-emerald-400/20'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="staffSyncMode"
                        value="merge"
                        checked={staffSyncMode === 'merge'}
                        onChange={() => setStaffSyncMode('merge')}
                        className="text-emerald-600 focus:ring-emerald-500 mt-0.5"
                      />
                      <div>
                        <span className="font-extrabold text-slate-900 text-xs block leading-tight">
                          Gabung (kemaskini &amp; tambah)
                        </span>
                        <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wide">
                          Kemas Kini Staf Terlibat
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                      Lalai (Default)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed pl-5">
                    Hanya mengemas kini atau menambah staf yang terdapat dalam fail CSV. Staf lain yang sedia ada dalam sistem akan dikekalkan.
                  </p>
                </div>

                {/* Option 2: Ganti Semua (padam data lama) */}
                <div 
                  onClick={() => setStaffSyncMode('replace')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between gap-2.5 ${
                    staffSyncMode === 'replace'
                      ? 'bg-rose-50/80 border-rose-500 shadow-sm ring-2 ring-rose-400/20'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="staffSyncMode"
                        value="replace"
                        checked={staffSyncMode === 'replace'}
                        onChange={() => setStaffSyncMode('replace')}
                        className="text-rose-600 focus:ring-rose-500 mt-0.5"
                      />
                      <div>
                        <span className="font-extrabold text-slate-900 text-xs block leading-tight">
                          Ganti Semua (padam data lama)
                        </span>
                        <span className="text-[10px] text-rose-700 font-bold uppercase tracking-wide">
                          Padam Rekod Tiada Dalam CSV
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-200 text-rose-900 shrink-0">
                      Pembersihan Penuh
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed pl-5">
                    Memadamkan kesemua rekod staf lama di Cloud Firestore yang tiada di dalam fail CSV ini dan hanya mengekalkan senarai baharu (contoh: 75 staf rasmi).
                  </p>
                </div>
              </div>

              {/* Reset semua PIN kepada 1234 Checkbox */}
              {staffSyncMode === 'replace' && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={resetAllPinsOnSync}
                      onChange={(e) => setResetAllPinsOnSync(e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 border-amber-400"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Reset semua PIN kepada 1234</span>
                      <span className="text-[11px] text-slate-600">
                        Jika ditandakan, semua staf akan ditetapkan semula kepada PIN lalai 1234 (status DEFAULT). Jika tidak ditandakan, PIN tersendiri staf sedia ada akan dikekalkan.
                      </span>
                    </div>
                  </label>
                </div>
              )}
            </div>

            <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer relative ${
              isSyncing
                ? 'border-blue-500 bg-blue-50/50'
                : 'border-slate-300 hover:border-emerald-500 bg-slate-50/50 hover:bg-emerald-50/30'
            }`}>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={isSyncing}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                title="Pilih fail CSV profil staf untuk auto-sync ke Firebase"
              />
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300 mb-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Auto-Sync ke Firebase Aktif</span>
              </div>
              <UploadCloud className={`w-10 h-10 mx-auto mb-2 ${isSyncing ? 'text-blue-600 animate-bounce' : 'text-emerald-600'}`} />
              <div className="font-bold text-slate-800 text-sm">
                {isSyncing ? (
                  <span className="text-blue-700 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                    Sedang auto-sync ke Firebase Cloud...
                  </span>
                ) : csvFile ? (
                  `Fail dipilih: ${csvFile.name}`
                ) : (
                  'Pilih atau Tarik Fail CSV ke Sini'
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {isSyncing
                  ? 'Data sedang disinkronkan secara langsung ke Firebase Cloud Firestore...'
                  : 'Data akan auto-sync ke Firebase secara automatik sebaik sahaja fail CSV dimasukkan.'}
              </p>
            </div>

            {/* Parse Error Messages */}
            {parseErrors.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Beberapa baris CSV tidak lengkap atau mengandungi ralat:</span>
                </div>
                {parseErrors.map((err, idx) => (
                  <div key={idx} className="pl-5 text-[11px]">• {err}</div>
                ))}
              </div>
            )}

            {/* Sync Status Banner */}
            {syncSuccessMsg && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-xs font-bold text-emerald-800 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{syncSuccessMsg}</span>
              </div>
            )}

            {/* Parsed Preview Table & Sync Trigger */}
            {parsedStaffList.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Pratonton Rekod CSV Ditemui ({parsedStaffList.length} rekod):
                  </span>

                  <button
                    onClick={handleExecuteSync}
                    disabled={isSyncing}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold py-2 px-4 rounded-xl text-xs transition flex items-center gap-2 shadow-md active:scale-95 cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Menyinkronkan...' : `SINKRONISASI ${parsedStaffList.length} REKOD KE FIREBASE`}</span>
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="p-2">ID</th>
                        <th className="p-2">Nama</th>
                        <th className="p-2">E-mel</th>
                        <th className="p-2">Jabatan</th>
                        <th className="p-2">Telefon</th>
                        <th className="p-2">Status Akaun &amp; PIN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {parsedStaffList.map((st, idx) => {
                        const existing = staffList.find(
                          s => s.id && s.id.trim().toLowerCase() === st.id.trim().toLowerCase()
                        );
                        const isNew = !existing;
                        const isEmailChanged = existing && existing.email.toLowerCase() !== st.email.toLowerCase();
                        const isProfileChanged = existing && (
                          isEmailChanged ||
                          existing.name.trim() !== st.name.trim() ||
                          existing.department.trim() !== st.department.trim() ||
                          existing.phone.trim() !== st.phone.trim()
                        );

                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 font-mono text-[11px] font-bold">{st.id}</td>
                            <td className="p-2 font-semibold">{st.name}</td>
                            <td className="p-2 text-blue-600 font-medium">
                              <div>{st.email}</div>
                              {isEmailChanged && (
                                <div className="text-[10px] text-amber-700 line-through">
                                  {existing.email}
                                </div>
                              )}
                            </td>
                            <td className="p-2">{st.department}</td>
                            <td className="p-2 font-mono">{st.phone}</td>
                            <td className="p-2 whitespace-nowrap">
                              {isNew ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 inline-flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-emerald-600" />
                                  STAF BAHARU (PIN LALAI 1234)
                                </span>
                              ) : isProfileChanged ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1" title={isEmailChanged ? `Email dikemas kini dari ${existing.email}` : 'Maklumat profil dikemas kini'}>
                                  <Check className="w-3 h-3 text-blue-600" />
                                  KEMAS KINI PROFIL (PIN DIKEKALKAN)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 inline-flex items-center gap-1">
                                  TIADA PERUBAHAN
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Existing Registered Staff List Search */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Senarai Staf & E-mel Berdaftar Sedia Ada ({staffList.length})</span>
            </h4>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleResetAllPinsToDefault}
                disabled={isResettingAllPins}
                className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                title="Setkan semula semua user kepada PIN lalai (1234)"
              >
                <RotateCcw className={`w-3.5 h-3.5 text-amber-600 ${isResettingAllPins ? 'animate-spin' : ''}`} />
                <span>{isResettingAllPins ? 'Sedang Memproses...' : 'Set Semua PIN Lalai (1234)'}</span>
              </button>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama atau e-mel..."
                  value={staffSearchTerm}
                  onChange={(e) => setStaffSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-900 text-white font-bold sticky top-0">
                <tr>
                  <th className="p-2.5">ID</th>
                  <th className="p-2.5">Nama Staf</th>
                  <th className="p-2.5">E-mel</th>
                  <th className="p-2.5">PIN</th>
                  <th className="p-2.5">Status PIN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800 bg-white">
                {filteredStaffList.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono font-bold text-slate-500 whitespace-nowrap">{s.id}</td>
                    <td className="p-2.5 font-bold text-slate-900">{s.name}</td>
                    <td className="p-2.5 text-blue-600 font-medium">{s.email}</td>
                    <td className="p-2.5 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <span className="font-mono font-bold bg-slate-100 text-slate-900 px-2 py-0.5 rounded text-xs">
                          {s.pin || '1234'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyPin(s)}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-[10px] transition cursor-pointer"
                          title="Salin PIN Staf"
                        >
                          {copiedPinId === s.id ? '✓ Disalin' : 'Salin'}
                        </button>
                        {s.phone && (
                          <a
                            href={`https://wasap.my/6${s.phone.replace(/\D/g, '').replace(/^0/, '')}?text=${encodeURIComponent(`Salam ${s.name}, PIN semasa akaun BookBK KPMBP anda ialah: ${s.pin || '1234'}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 bg-[#25D366]/10 hover:bg-[#25D366]/25 text-[#25D366] rounded transition inline-flex items-center"
                            title={`Hantar PIN ke WhatsApp ${s.name}`}
                          >
                            <WhatsAppIcon className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="p-2.5 whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        {s.pinStatus === 'CUSTOM' ? (
                          <>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              PIN Telah Ditukar
                            </span>
                            <button
                              type="button"
                              disabled={resettingPinStaffId === s.id}
                              onClick={() => handleResetStaffPin(s)}
                              className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 font-bold rounded text-[10px] transition cursor-pointer disabled:opacity-50"
                              title="Set semula PIN ke 1234 (Lalai) jika staf terlupa"
                            >
                              {resettingPinStaffId === s.id ? '...' : 'Reset ke 1234'}
                            </button>
                          </>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            PIN Belum Ditukar
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION: ROOMS & DIRECTORY CSV TEMPLATE, EXPORT & IMPORT */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200 space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-cyan-50 text-cyan-800 border border-cyan-200 px-2.5 py-0.5 rounded-full text-xs font-bold mb-1">
              <Building className="w-3.5 h-3.5 text-cyan-600" />
              <span>Unit Pengurusan Fasiliti &amp; Ruang KPMBP</span>
            </div>
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-lg">
              <FileSpreadsheet className="w-5 h-5 text-cyan-600" />
              <h3>Pengurusan Maklumat Ruang &amp; Aras (Template, Eksport &amp; Import CSV)</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Ubah suai perincian aras/tingkat (contoh: <strong>Gamma &amp; Alfa - 1st Floor</strong>, <strong>Sigma, Beta &amp; S. Classroom - Ground Floor</strong>, <strong>Bilik Inkubator - Ground Floor</strong>), blok bangunan, kapasiti, dan kemudahan melalui templat CSV atau muat naik fail CSV.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleExportRoomsListCSV}
              className="bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold py-2 px-3.5 rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer"
              title="Eksport senarai penuh ruang semasa ke fail CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-cyan-600" />
              <span>Eksport CSV Ruang Semasa (.csv)</span>
            </button>

            <button
              onClick={handleDownloadRoomsCSVTemplate}
              className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold py-2 px-3.5 rounded-xl transition flex items-center gap-2 shadow-md shadow-cyan-600/20 shrink-0 cursor-pointer"
              title="Muat turun templat CSV piawai dengan contoh penetapan aras"
            >
              <Download className="w-4 h-4" />
              <span>Muat Turun Templat CSV Ruang (.csv)</span>
            </button>
          </div>
        </div>

        {/* Upload Zone & Guide */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-3">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
              <Building className="w-4 h-4 text-cyan-600" />
              <span>Panduan Format Header CSV Ruang</span>
            </h4>
            <p className="text-slate-600 leading-relaxed">
              Fail CSV mengandungi maklumat direktori ruang bilik kuliah &amp; fasiliti:
            </p>
            <div className="bg-slate-900 text-cyan-300 p-2.5 rounded-lg font-mono text-[10.5px] overflow-x-auto border border-slate-800 leading-relaxed">
              id,code,name,category,capacity,block,level,facilities,hasAircond,isSmartClassroom,notes
            </div>

            <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-2.5 text-cyan-950 text-[11px] space-y-1.5">
              <p className="font-bold flex items-center gap-1 text-cyan-900">
                <Sparkles className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                <span>Contoh Penetapan Aras (Level / Floor):</span>
              </p>
              <div className="space-y-1 pl-1 text-[11px]">
                <div className="flex items-center justify-between border-b border-cyan-200/60 pb-1">
                  <span className="font-semibold text-slate-800">Gamma, Alfa:</span>
                  <span className="bg-cyan-100 text-cyan-900 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">1st Floor</span>
                </div>
                <div className="flex items-center justify-between border-b border-cyan-200/60 pb-1">
                  <span className="font-semibold text-slate-800">Sigma, Beta, S. Classroom:</span>
                  <span className="bg-cyan-100 text-cyan-900 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">Ground Floor</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Bilik Inkubator:</span>
                  <span className="bg-cyan-100 text-cyan-900 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">Ground Floor</span>
                </div>
              </div>
            </div>

            <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px] leading-relaxed">
              <li><strong>level</strong>: Menerima <code>Ground Floor</code>, <code>1st Floor</code>, <code>2nd Floor</code>, <code>3rd Floor</code>.</li>
              <li><strong>code / name</strong>: Kod bilik (cth: <code>LAB GAMMA</code>, <code>BK01</code>, <code>BLK. INKUBATOR</code>).</li>
              <li><strong>facilities</strong>: Kemudahan dipisahkan dengan tanda titik bertindih (<code>;</code>).</li>
              <li><strong>Tip Admin</strong>: Anda boleh muat turun senarai sedia ada melalui <em>Eksport CSV Ruang Semasa</em>, edit detail aras/tingkat di Excel, dan import semula.</li>
            </ul>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {/* Sync Mode Selection */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-cyan-600" />
                  Pilihan Mod Penyelarasan Ruang:
                </span>
                <span className="text-[11px] font-normal text-slate-500">
                  Ruang sedia ada di sistem: <strong className="text-cyan-900 font-bold">{rooms.length} ruang</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option 1: Gabung / Kemaskini */}
                <div
                  onClick={() => setRoomSyncMode('merge')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between gap-2.5 ${
                    roomSyncMode === 'merge'
                      ? 'bg-cyan-50/80 border-cyan-500 shadow-sm ring-2 ring-cyan-400/20'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="roomSyncMode"
                        value="merge"
                        checked={roomSyncMode === 'merge'}
                        onChange={() => setRoomSyncMode('merge')}
                        className="text-cyan-600 focus:ring-cyan-500 mt-0.5"
                      />
                      <div>
                        <span className="font-extrabold text-slate-900 text-xs block leading-tight">
                          Gabung &amp; Kemas Kini (Disyorkan)
                        </span>
                        <span className="text-[10px] text-cyan-700 font-bold uppercase tracking-wide">
                          Kemas Kini Ruang Padanan
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800 shrink-0">
                      Lalai (Default)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed pl-5">
                    Hanya mengemas kini aras atau perincian bilik yang dinyatakan dalam fail CSV. Ruang lain yang sedia ada akan kekal tidak terjejas.
                  </p>
                </div>

                {/* Option 2: Ganti Semua */}
                <div
                  onClick={() => setRoomSyncMode('replace')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between gap-2.5 ${
                    roomSyncMode === 'replace'
                      ? 'bg-rose-50/80 border-rose-500 shadow-sm ring-2 ring-rose-400/20'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="roomSyncMode"
                        value="replace"
                        checked={roomSyncMode === 'replace'}
                        onChange={() => setRoomSyncMode('replace')}
                        className="text-rose-600 focus:ring-rose-500 mt-0.5"
                      />
                      <div>
                        <span className="font-extrabold text-slate-900 text-xs block leading-tight">
                          Ganti Semua (Total Replace)
                        </span>
                        <span className="text-[10px] text-rose-700 font-bold uppercase tracking-wide">
                          Format Semula Direktori
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed pl-5">
                    Menggantikan keseluruhan senarai direktori ruang dengan data daripada fail CSV yang dimuat naik.
                  </p>
                </div>
              </div>
            </div>

            {/* File Upload Zone */}
            <div className="border-2 border-dashed border-slate-300 hover:border-cyan-500 rounded-2xl p-5 text-center transition bg-slate-50/50 hover:bg-cyan-50/20 group">
              <input
                id="rooms-csv-file-input"
                type="file"
                accept=".csv"
                onChange={handleRoomFileChange}
                className="hidden"
              />
              <label htmlFor="rooms-csv-file-input" className="cursor-pointer flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-cyan-100 text-cyan-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <span className="font-bold text-slate-900 text-sm block">
                    {roomCsvFile ? roomCsvFile.name : 'Pilih atau Seret Fail CSV Maklumat Ruang'}
                  </span>
                  <span className="text-xs text-slate-500 block mt-0.5">
                    Format: <code>.csv</code> (UTF-8) mengandungi maklumat ID/Kod, Nama, Aras (Level), Blok &amp; Kapasiti
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-cyan-600 bg-cyan-50 border border-cyan-200 px-3 py-1 rounded-lg mt-1 group-hover:bg-cyan-600 group-hover:text-white transition">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  {roomCsvFile ? 'Tukar Fail CSV' : 'Semak & Muat Naik Fail CSV'}
                </span>
              </label>
            </div>

            {/* Success Notification */}
            {roomSyncSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{roomSyncSuccessMsg}</span>
              </div>
            )}

            {/* Parse Errors */}
            {roomParseErrors.length > 0 && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Ralat memproses fail CSV:</span>
                </div>
                <ul className="list-disc list-inside text-rose-700 pl-2 space-y-0.5">
                  {roomParseErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Parsed Preview Table & Confirmation */}
            {parsedRoomsList.length > 0 && (
              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h5 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-cyan-600" />
                      Pratonton Perubahan ({parsedRoomsList.length} ruang dijumpai):
                    </h5>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-600">
                      <span className="bg-cyan-100 text-cyan-900 font-bold px-2 py-0.5 rounded">
                        {roomParseSummary?.updated || 0} dikemaskini
                      </span>
                      <span className="bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded">
                        {roomParseSummary?.added || 0} bilik baharu
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRoomCsvFile(null);
                        setParsedRoomsList([]);
                        setRoomParseSummary(null);
                        setRoomParseErrors([]);
                      }}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={isSyncingRooms}
                      onClick={handleSyncRoomsToSystem}
                      className="px-4 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                    >
                      {isSyncingRooms ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Menyimpan ke Cloud...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Sahkan &amp; Sinkronkan ({parsedRoomsList.length} Ruang)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg text-xs">
                  <table className="w-full text-left divide-y divide-slate-200">
                    <thead className="bg-slate-50 text-slate-700 sticky top-0 text-[11px]">
                      <tr>
                        <th className="p-2">Kod Ruang</th>
                        <th className="p-2">Nama Ruang</th>
                        <th className="p-2">Aras / Tingkat (Level)</th>
                        <th className="p-2">Blok / Bangunan</th>
                        <th className="p-2">Kapasiti</th>
                        <th className="p-2">Kategori</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {parsedRoomsList.slice(0, 15).map((rm, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 font-bold text-slate-900">{rm.code}</td>
                          <td className="p-2 text-slate-700">{rm.name}</td>
                          <td className="p-2">
                            <span className="bg-cyan-50 border border-cyan-200 text-cyan-800 font-bold px-2 py-0.5 rounded text-[10.5px]">
                              {formatLevel(rm.level)}
                            </span>
                          </td>
                          <td className="p-2 text-slate-600">{rm.block}</td>
                          <td className="p-2 text-slate-700 font-mono">{rm.capacity} pax</td>
                          <td className="p-2 text-slate-500">{rm.category}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedRoomsList.length > 15 && (
                    <div className="p-2 text-center text-slate-400 text-[11px] bg-slate-50 border-t border-slate-200">
                      ... dan {parsedRoomsList.length - 15} ruang lagi
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Searchable Room Directory Inspection Table */}
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                <Building className="w-4 h-4 text-cyan-600" />
                Senarai Direktori 42 Ruang Semasa dalam Sistem:
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Semak aras, blok, dan kapasiti semasa bagi setiap bilik di sini.
              </p>
            </div>
            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari cth: Gamma, Alfa, Sigma, BK01..."
                value={roomSearchTerm}
                onChange={(e) => setRoomSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-700 text-[11px] uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="p-2.5">Kod Ruang</th>
                  <th className="p-2.5">Nama Ruang</th>
                  <th className="p-2.5">Aras / Tingkat</th>
                  <th className="p-2.5">Blok / Bangunan</th>
                  <th className="p-2.5">Kategori</th>
                  <th className="p-2.5 text-center">Kapasiti</th>
                  <th className="p-2.5 text-center">Aircond</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {rooms
                  .filter(r => {
                    if (!roomSearchTerm.trim()) return true;
                    const q = roomSearchTerm.toLowerCase();
                    return (
                      r.code.toLowerCase().includes(q) ||
                      r.name.toLowerCase().includes(q) ||
                      r.block.toLowerCase().includes(q) ||
                      formatLevel(r.level).toLowerCase().includes(q) ||
                      r.category.toLowerCase().includes(q)
                    );
                  })
                  .map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 transition">
                      <td className="p-2.5 font-bold text-slate-900">{r.code}</td>
                      <td className="p-2.5 text-slate-700">{r.name}</td>
                      <td className="p-2.5">
                        <span className="bg-cyan-50 border border-cyan-200 text-cyan-900 font-bold px-2 py-0.5 rounded text-[10.5px]">
                          {formatLevel(r.level)}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-600">{r.block}</td>
                      <td className="p-2.5 text-slate-500">{r.category}</td>
                      <td className="p-2.5 text-center font-mono text-slate-700">{r.capacity} pax</td>
                      <td className="p-2.5 text-center">
                        {r.hasAircond ? (
                          <span className="text-cyan-700 font-bold text-[10.5px]">Ya 💠</span>
                        ) : (
                          <span className="text-slate-400 text-[10.5px]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION: AD-HOC BOOKINGS BACKUP & CSV EXPORT */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-lg">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <h3>Sandaran Data &amp; Eksport CSV Tempahan Ad-Hoc</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Simpan dan muat turun kesemua rekod tempahan ad-hoc yang telah didaftarkan ke dalam fail spreadsheet CSV bagi tujuan sandaran offline, pelan kontigensi, atau audit institusi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleExportBookingsCSV('ALL')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
              title="Muat turun semua rekod tempahan ke fail CSV"
            >
              <Download className="w-4 h-4" />
              <span>Muat Turun Sandaran Semua ({bookings.length} Rekod)</span>
            </button>

            <button
              type="button"
              onClick={() => handleExportBookingsCSV('CONFIRMED')}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 px-3 rounded-xl text-xs transition flex items-center gap-1.5 border border-slate-300 cursor-pointer"
              title="Eksport rekod tempahan yang disahkan sahaja"
            >
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Disahkan ({bookings.filter(b => b.status === 'CONFIRMED').length})</span>
            </button>

            <button
              type="button"
              onClick={() => handleExportBookingsCSV('PENDING')}
              className="bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold py-2.5 px-3 rounded-xl text-xs transition flex items-center gap-1.5 border border-amber-300 cursor-pointer"
              title="Eksport permohonan tempahan menunggu sahaja"
            >
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Menunggu ({bookings.filter(b => b.status === 'PENDING').length})</span>
            </button>
          </div>
        </div>

        {/* Informative Security & Contingency Callout */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Fungsi Perlindungan &amp; Kesinambungan Data (Business Continuity):</span>
          </div>
          <p className="text-slate-600 leading-relaxed text-[11px]">
            Fail sandaran CSV ini merekodkan 17 medan data penting (ID Tempahan, Kod &amp; Nama Bilik Kuliah, Tarikh, Hari, Slot Masa Mula &amp; Tamat, Nama &amp; E-mel Pemohon, No Telefon Rasmi, Jawatan, Jabatan, Kategori Tujuan, Tajuk Aktiviti, Bilangan Hadirin, Status, Tarikh Dicipta, dan Catatan). Format ini mengandungi pengekodan UTF-8 BOM yang serasi dengan <strong>Microsoft Excel</strong> dan <strong>Google Sheets</strong> untuk kegunaan kecemasan sekiranya berlaku masalah talian atau pelayan awan.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* SECTION 1: PENDING APPROVALS */}
        <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-amber-500" />
              <span>Kelulusan Permohonan Menunggu ({pendingBookings.length})</span>
            </h3>
          </div>

          {pendingBookings.length > 0 ? (
            <div className="space-y-3">
              {pendingBookings.map(p => (
                <div key={p.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold bg-slate-900 text-amber-400 px-2 py-0.5 rounded">
                      {p.id}
                    </span>
                    <span className="text-slate-500 font-medium">{p.purposeCategory}</span>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{p.title}</h4>
                    <div className="text-xs text-slate-600 mt-0.5">
                      Pemohon: <strong>{p.applicantName}</strong> ({p.applicantRole} - {p.department})
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs space-y-1 text-slate-700 font-medium">
                    <div>🏫 Ruang: <strong>{p.roomName} ({p.roomId})</strong></div>
                    <div>📅 Tarikh: <strong>{formatDateMalay(p.date)}</strong></div>
                    <div>🕐 Masa: <strong>{p.startTime} – {p.endTime}</strong></div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => onApproveBooking(p.id)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition flex items-center justify-center gap-1 shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Luluskan</span>
                    </button>
                    <button
                      onClick={() => onRejectBooking(p.id)}
                      className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition flex items-center justify-center gap-1 shadow-xs"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Tolak</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-1">
              <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
              <p className="font-bold text-slate-700">Tiada permohonan menunggu kelulusan lagi.</p>
              <p className="text-slate-400">Sebarang permohonan baharu yang memerlukan kelulusan pentadbir akan dipaparkan di sini secara automatik.</p>
            </div>
          )}
        </div>

        {/* SECTION 2: ADD INSTITUTIONAL BLOCK */}
        <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-indigo-600" />
              <span>Sekat Ruang (Institutional Block)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Gunakan borang ini untuk melock ruang tertentu bagi program kolej, majlis rasmi, atau peperiksaan.
            </p>
          </div>

          <form onSubmit={handleCreateBlock} className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Pilih Ruang Dibatasi:</label>
              <select
                value={blockRoomId}
                onChange={(e) => setBlockRoomId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>{r.name} ({r.category})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tarikh Block:</label>
                <input
                  type="date"
                  value={blockDate}
                  onChange={(e) => setBlockDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Dicipta Oleh:</label>
                <input
                  type="text"
                  value={blockCreatedBy}
                  onChange={(e) => setBlockCreatedBy(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Masa Mula:</label>
                <input
                  type="text"
                  value={blockStartTime}
                  onChange={(e) => setBlockStartTime(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none"
                  placeholder="08:00"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Masa Tamat:</label>
                <input
                  type="text"
                  value={blockEndTime}
                  onChange={(e) => setBlockEndTime(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none"
                  placeholder="17:00"
                />
              </div>
            </div>

            {/* Quick Session Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-400 font-semibold">Pilihan Pantas:</span>
              <button
                type="button"
                onClick={() => { setBlockStartTime('08:00'); setBlockEndTime('17:00'); }}
                className="text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded font-medium transition"
              >
                ☀️ Siang (08:00–17:00)
              </button>
              <button
                type="button"
                onClick={() => { setBlockStartTime('20:00'); setBlockEndTime('23:00'); }}
                className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded font-medium transition"
              >
                🌙 Malam Penuh (20:00–23:00)
              </button>
              <button
                type="button"
                onClick={() => { setBlockStartTime('20:00'); setBlockEndTime('21:00'); }}
                className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded transition"
              >
                20:00–21:00
              </button>
              <button
                type="button"
                onClick={() => { setBlockStartTime('21:00'); setBlockEndTime('22:00'); }}
                className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded transition"
              >
                21:00–22:00
              </button>
              <button
                type="button"
                onClick={() => { setBlockStartTime('22:00'); setBlockEndTime('23:00'); }}
                className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded transition"
              >
                22:00–23:00
              </button>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Tajuk Program / Aktiviti:</label>
              <input
                type="text"
                placeholder="cth: Minggu Mesra Siswa (MMS) / Peperiksaan Selaras"
                value={blockTitle}
                onChange={(e) => setBlockTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Tujuan / Sebab Lock:</label>
              <input
                type="text"
                placeholder="cth: Program rasmi peringkat kolej"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>TAMBAH BLOCK RUANG</span>
            </button>
          </form>
        </div>

      </div>

      {/* INSTITUTIONAL BLOCKS LIST */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200 space-y-4">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Lock className="w-5 h-5 text-slate-800" />
          <span>Senarai Block Institusi Aktif ({institutionalBlocks.length})</span>
        </h3>

        {institutionalBlocks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {institutionalBlocks.map(blk => {
              const r = rooms.find(rm => rm.id === blk.roomId);

              return (
                <div key={blk.id} className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        {r ? (r.code === r.name ? r.name : `${r.code} (${r.name})`) : blk.roomId}
                      </span>
                      <span className="text-slate-400 font-medium">{formatDateMalay(blk.date)}</span>
                    </div>

                    <h4 className="font-bold text-slate-100 text-sm mt-1">{blk.title}</h4>
                    <div className="text-slate-400 text-[11px]">
                      Jam: {blk.startTime} – {blk.endTime} • Oleh: {blk.createdBy}
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteBlock(blk.id)}
                    className="text-slate-400 hover:text-rose-400 p-1 transition cursor-pointer"
                    title="Padam Block Ruang"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-1">
            <Lock className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
            <p className="font-bold text-slate-700 text-sm">Tiada data sekatan bilik lagi.</p>
            <p className="text-slate-500 text-xs">Semua 42 ruang dibuka mengikut ketersediaan jadual akademik tanpa sebarang sekatan institusi.</p>
          </div>
        )}
      </div>

      {/* Cloud Sync Status & Multi-Device Details Modal */}
      <CloudSyncModal 
        isOpen={showCloudSyncModal} 
        onClose={() => setShowCloudSyncModal(false)} 
      />

      {/* CONFIRMATION MODAL: CLEAR ALL ACADEMIC SCHEDULE */}
      {showClearScheduleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mb-1">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900">Kosongkan Keseluruhan Jadual Waktu?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tindakan ini akan memadamkan secara kekal kesemua <strong className="text-rose-600 font-bold">{academicSchedule.length} slot</strong> jadual waktu kuliah sedia ada dari sistem dan pangkalan data awan Cloud Firestore.
              </p>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900 space-y-1">
              <span className="font-bold block flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                Kesan Pembersihan:
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-800">
                <li>Semua bilik akan dibuka tanpa sebarang slot kuliah terkunci (0 slot).</li>
                <li>Staf boleh menempah bilik secara bebas pada mana-mana slot.</li>
                <li>Anda boleh memuat naik jadual baharu pada bila-bila masa melalui fail CSV.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowClearScheduleModal(false)}
                disabled={isClearingSchedule}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteClearSchedule}
                disabled={isClearingSchedule}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition flex items-center gap-2 shadow-md shadow-rose-600/20 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isClearingSchedule ? 'Sedang Memadamkan...' : `Ya, Kosongkan Semua (${academicSchedule.length} Slot)`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: TOTAL OVERWRITE (REPLACE MODE) */}
      {showConfirmTotalOverwriteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Pengesahan Ganti Sepenuhnya (Total Overwrite)</h3>
                <span className="text-xs text-amber-700 font-medium">Pembersihan Bersih Semula Pangkalan Data Jadual</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Anda memilih <strong>Mod Ganti Sepenuhnya</strong>. Sistem akan membersihkan kesemua slot terdahulu di Cloud Firestore dan menggantikannya secara total dengan kandungan fail CSV baharu ini.
            </p>

            {/* Comparison Box */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                <span className="text-[10px] uppercase font-bold text-rose-600 block">Jadual Lama Dipadamkan</span>
                <strong className="text-lg font-extrabold text-rose-900">{academicSchedule.length} Slot</strong>
                <p className="text-[10px] text-rose-700 mt-1">Dibersihkan dari Firestore &amp; memori</p>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <span className="text-[10px] uppercase font-bold text-emerald-600 block">Jadual Baharu Dimasukkan</span>
                <strong className="text-lg font-extrabold text-emerald-900">{parsedScheduleSlots.length} Slot</strong>
                <p className="text-[10px] text-emerald-700 mt-1">{scheduleParseSummary?.roomsAffected.length} ruang bilik terlibat</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 space-y-1">
              <span className="font-bold text-slate-800 block">Ruang Terlibat dalam CSV Baharu:</span>
              <p className="font-mono text-slate-700 break-words">
                {scheduleParseSummary?.roomsAffected.join(', ') || 'Tiada'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfirmTotalOverwriteModal(false)}
                disabled={isSyncingSchedule}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => executeActualSync('replace')}
                disabled={isSyncingSchedule}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition flex items-center gap-2 shadow-md shadow-amber-600/20 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncingSchedule ? 'animate-spin' : ''}`} />
                <span>{isSyncingSchedule ? 'Sedang Menggantikan...' : `Sahkan & Gantikan (${parsedScheduleSlots.length} Slot)`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
