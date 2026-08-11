export type RoomCategory = 'Bilik Kuliah' | 'Dewan Kuliah' | 'Ruang Khas';

export interface Room {
  id: string;             // e.g. 'BK01', 'DKA', 'DEWAN_BESAR'
  code: string;           // e.g. 'BK01', 'DKA', 'Dewan Besar'
  name: string;           // e.g. 'Bilik Kuliah 01', 'Dewan Kuliah A'
  category: RoomCategory;
  capacity: number;
  block: string;          // e.g. 'Blok A', 'Blok B', 'Bangunan Pentadbiran'
  level: number | string; // e.g. 1, 2, 'G'
  facilities: string[];   // e.g. ['Papan Pintar (Smartboard)', 'Projektor LCD', 'Pendingin Hawa', 'Sistem Audio']
  hasAircond?: boolean;
  isSmartClassroom?: boolean;
  imageUrl?: string;
  notes?: string;
}

export type DayOfWeek = 'Isnin' | 'Selasa' | 'Rabu' | 'Khamis' | 'Jumaat' | 'Sabtu' | 'Ahad';

export interface AcademicScheduleSlot {
  id: string;
  roomId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;      // e.g. '08:30'
  endTime: string;        // e.g. '10:30'
  courseCode: string;     // e.g. 'DIA 1023'
  courseName: string;     // e.g. 'Perakaunan Kewangan 1'
  className: string;      // e.g. 'DIA 4C'
  lecturerName: string;   // e.g. 'Pn. Tahira Mohamed'
  department: string;     // e.g. 'Jabatan Perdagangan'
}

export type PurposeCategory = 
  | 'Penggunaan Pensyarah'
  | 'Aktiviti Akademik'
  | 'Program'
  | 'Mesyuarat'
  | 'Aktiviti Pelajar'
  | 'Lain-lain';

export type BookingStatus = 'CONFIRMED' | 'PENDING' | 'REJECTED' | 'CANCELLED';

export interface AdHocBooking {
  id: string;             // e.g. 'BK-2026-000124'
  roomId: string;
  roomName: string;
  date: string;           // YYYY-MM-DD e.g. '2026-08-06'
  startTime: string;      // e.g. '11:30'
  endTime: string;        // e.g. '12:30'
  applicantName: string;  // e.g. 'En. Ahmad Khairi'
  applicantEmail?: string;// e.g. 'khairi@bpenawar.kpm.edu.my'
  applicantPhone?: string;// e.g. '012-3456789'
  applicantRole: string;  // e.g. 'Pensyarah DIA' | 'Pegawai Akademik'
  department: string;     // e.g. 'Jabatan Sains Komputer'
  purposeCategory: PurposeCategory;
  title: string;          // e.g. 'Bengkel Khas Coding React'
  paxCount: number;
  notes?: string;
  status: BookingStatus;
  createdAt: string;
}

export interface InstitutionalBlock {
  id: string;
  roomId: string;
  date: string;           // YYYY-MM-DD
  startTime: string;
  endTime: string;
  title: string;          // e.g. 'Minggu Mesra Siswa (MMS)'
  reason: string;         // e.g. 'Penggunaan Rasmi Kolej'
  createdBy: string;
}

export type AvailabilityStatus = 'AVAILABLE' | 'OCCUPIED_ACADEMIC' | 'OCCUPIED_BOOKING' | 'PENDING_BOOKING' | 'BLOCKED';

export interface RoomAvailabilityCheck {
  roomId: string;
  room: Room;
  status: AvailabilityStatus;
  academicSlot?: AcademicScheduleSlot;
  existingBooking?: AdHocBooking;
  institutionalBlock?: InstitutionalBlock;
  conflictReason?: string;
}

export interface SearchFilterParams {
  date: string;
  startTime: string;
  endTime: string;
  minCapacity: number;
  category: RoomCategory | 'Semua';
  purpose: PurposeCategory;
  isAircondOnly?: boolean;
  isSmartClassroomOnly?: boolean;
}

export interface StaffUser {
  id: string;
  department: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  passcode: string; // 4 last digits of phone
}

