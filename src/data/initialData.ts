import { Room, AcademicScheduleSlot, AdHocBooking, InstitutionalBlock } from '../types';

export const INITIAL_ROOMS: Room[] = [
  // Bilik Kuliah (28 rooms)
  ...Array.from({ length: 28 }, (_, i) => {
    const num = i + 1;
    const code = `BK${num < 10 ? '0' + num : num}`;
    const block = 'Bangunan Akademik';
    const level = num <= 9 ? 1 : num <= 15 ? 2 : 3;
    const aircondNums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 20, 21, 22, 23, 24, 25];
    const hasAircond = aircondNums.includes(num);
    
    return {
      id: code,
      code,
      name: code,
      category: 'Bilik Kuliah' as const,
      capacity: 28,
      block,
      level,
      facilities: [
        'Projektor LCD',
        hasAircond ? 'Pendingin Hawa (Aircond)' : 'Kipas Angin / Pengudaraan',
        'Papan Putih',
        'Sistem Bunyi Mikrofon',
        'Capaian Wi-Fi KPMBP'
      ],
      hasAircond,
      isSmartClassroom: false,
      notes: hasAircond ? 'Bilik Kuliah berhawa dingin (Aircond)' : 'Ruang kuliah standard (Kipas Angin)'
    };
  }),

  // Dewan Kuliah (2 rooms)
  {
    id: 'DKA',
    code: 'DKA',
    name: 'DKA',
    category: 'Dewan Kuliah',
    capacity: 120,
    block: 'Bangunan Akademik Utama',
    level: 2,
    facilities: ['Dual Projektor HD', 'Kerusi Bertingkat (Auditorium)', 'Sistem Audio Dewan', 'Pendingin Hawa Pusat', 'Papan Pintar'],
    hasAircond: true,
    notes: 'Sesuai untuk kuliah gabungan kelas besar, ceramah khas, dan taklimat program'
  },
  {
    id: 'DKB',
    code: 'DKB',
    name: 'DKB',
    category: 'Dewan Kuliah',
    capacity: 120,
    block: 'Bangunan Akademik Utama',
    level: 2,
    facilities: ['Dual Projektor HD', 'Kerusi Bertingkat (Auditorium)', 'Sistem Audio Dewan', 'Pendingin Hawa Pusat'],
    hasAircond: true,
    notes: 'Sesuai untuk peperiksaan, taklimat, dan perkongsian ilmu'
  },

  // Ruang Khas (3 rooms)
  {
    id: 'DEWAN_SEMINAR',
    code: 'DEWAN SEMINAR',
    name: 'DEWAN SEMINAR',
    category: 'Ruang Khas',
    capacity: 80,
    block: 'Bangunan Perpustakaan',
    level: 4,
    facilities: ['Skrin LED Interaktif 85"', 'Susunan Meja Fleksibel', 'Sistem Audio Mikrofon Wireless', 'Pentas Kecil', 'AC'],
    hasAircond: true,
    notes: 'Pilihan utama bagi wacana akademik, bengkel kepimpinan, dan mesyuarat pengurusan'
  },
  {
    id: 'BILIK_SEMINAR',
    code: 'BILIK SEMINAR',
    name: 'BILIK SEMINAR',
    category: 'Ruang Khas',
    capacity: 40,
    block: 'Bangunan Perpustakaan',
    level: 3,
    facilities: ['Meja Persidangan U-Shape', 'Skrin TV Smart Display 75"', 'Papan Tulis Kaca', 'Sistem Persidangan Video'],
    hasAircond: true,
    notes: 'Direka khas untuk mesyuarat jawatankuasa, pembentangan projek khas, dan bengkel kecil'
  },
  {
    id: 'DEWAN_BESAR',
    code: 'DEWAN BESAR',
    name: 'DEWAN BESAR',
    category: 'Ruang Khas',
    capacity: 500,
    block: 'Hadapan Padang KPMBP',
    level: 1,
    facilities: ['Pentas Utama', 'Sistem Audio Konsert & Pencahayaan Stage', 'Gelanggang Sukan Serbaguna', 'LCD Projektor Gergasi'],
    hasAircond: true,
    notes: 'Ruang rasmi untuk Majlis Graduasi, Perhimpunan Bulanan, Majlis Anugerah, & Sukan Indoor'
  }
];

// Sample Academic Schedule Timetable
export const INITIAL_ACADEMIC_SCHEDULE: AcademicScheduleSlot[] = [
  // Khamis schedule (Matching user prompt example: Khamis 11:30 - 12:30 DIA 4C di BK05 / BK04)
  {
    id: 'SCH-001',
    roomId: 'BK05',
    dayOfWeek: 'Khamis',
    startTime: '11:30',
    endTime: '12:30',
    courseCode: 'DIA 4013',
    courseName: 'Perakaunan Kewangan Lanjutan',
    className: 'DIA 4C',
    lecturerName: 'Pn. Norazlina binti Mat Said',
    department: 'Jabatan Perdagangan'
  },
  {
    id: 'SCH-002',
    roomId: 'BK01',
    dayOfWeek: 'Khamis',
    startTime: '08:30',
    endTime: '10:30',
    courseCode: 'DKM 2012',
    courseName: 'Pengajian Malaysia 2',
    className: 'DKM 2A',
    lecturerName: 'En. Razak bin Ahmad',
    department: 'Jabatan Sains Sosial'
  },
  {
    id: 'SCH-003',
    roomId: 'BK02',
    dayOfWeek: 'Khamis',
    startTime: '09:30',
    endTime: '12:30',
    courseCode: 'DIB 3043',
    courseName: 'Pemasaran Digital',
    className: 'DIB 3B',
    lecturerName: 'Dr. Faridah binti Hassan',
    department: 'Jabatan Perniagaan'
  },
  {
    id: 'SCH-004',
    roomId: 'DKA',
    dayOfWeek: 'Khamis',
    startTime: '08:30',
    endTime: '11:30',
    courseCode: 'PPU 1012',
    courseName: 'Etika & Peradaban',
    className: 'DIA 1A & DIA 1B',
    lecturerName: 'Ustaz Ridzuan bin Omar',
    department: 'Jabatan Pengajian Am'
  },
  {
    id: 'SCH-005',
    roomId: 'BK04',
    dayOfWeek: 'Khamis',
    startTime: '08:30',
    endTime: '10:30',
    courseCode: 'DIT 2023',
    courseName: 'Sistem Pengurusan Pangkalan Data',
    className: 'DIT 2A',
    lecturerName: 'Pn. Tahira binti Mohamed',
    department: 'Jabatan Sains Komputer'
  },
  {
    id: 'SCH-006',
    roomId: 'BK04',
    dayOfWeek: 'Khamis',
    startTime: '14:30',
    endTime: '16:30',
    courseCode: 'DIT 3083',
    courseName: 'Pembangunan Aplikasi Web',
    className: 'DIT 3C',
    lecturerName: 'En. Fairuz bin Zainal',
    department: 'Jabatan Sains Komputer'
  },

  // Isnin
  {
    id: 'SCH-007',
    roomId: 'BK03',
    dayOfWeek: 'Isnin',
    startTime: '08:30',
    endTime: '11:30',
    courseCode: 'DIA 2023',
    courseName: 'Perakaunan Kos',
    className: 'DIA 2B',
    lecturerName: 'Pn. Salmah binti Yusof',
    department: 'Jabatan Perdagangan'
  },
  {
    id: 'SCH-008',
    roomId: 'DKB',
    dayOfWeek: 'Isnin',
    startTime: '11:30',
    endTime: '13:30',
    courseCode: 'DKP 1013',
    courseName: 'Prinsip Pengurusan',
    className: 'DKP 1A',
    lecturerName: 'En. Khairul Azman',
    department: 'Jabatan Pengurusan'
  },

  // Selasa
  {
    id: 'SCH-009',
    roomId: 'BK08',
    dayOfWeek: 'Selasa',
    startTime: '10:30',
    endTime: '12:30',
    courseCode: 'DIT 1013',
    courseName: 'Pengaturcaraan C++',
    className: 'DIT 1B',
    lecturerName: 'Pn. Suhana binti Ismail',
    department: 'Jabatan Sains Komputer'
  },

  // Rabu
  {
    id: 'SCH-010',
    roomId: 'DEWAN_SEMINAR',
    dayOfWeek: 'Rabu',
    startTime: '09:00',
    endTime: '12:00',
    courseCode: 'UBI 2012',
    courseName: 'Komunikasi Bahasa Inggeris Akademik',
    className: 'DIA 3A',
    lecturerName: 'Madam Sharifah Zubaidah',
    department: 'Jabatan Bahasa'
  }
];

// Sample Initial Ad-Hoc Bookings
export const INITIAL_ADHOC_BOOKINGS: AdHocBooking[] = [
  {
    id: 'BK-2026-000101',
    roomId: 'BK04',
    roomName: 'Bilik Kuliah 04',
    date: '2026-08-06',
    startTime: '11:30',
    endTime: '12:30',
    applicantName: 'Pn. Tahira binti Mohamed',
    applicantEmail: 'tahira@bpenawar.kpm.edu.my',
    applicantPhone: '019-8765432',
    applicantRole: 'Pensyarah Kanan',
    department: 'Jabatan Sains Komputer',
    purposeCategory: 'Penggunaan Pensyarah',
    title: 'Penggunaan Smart Classroom untuk Sesi Amali Coding',
    paxCount: 28,
    notes: 'Memerlukan Smartboard dan akses rangkaian Wi-Fi pantas',
    status: 'CONFIRMED',
    createdAt: '2026-08-01T09:15:00Z'
  },
  {
    id: 'BK-2026-000102',
    roomId: 'BILIK_SEMINAR',
    roomName: 'Bilik Seminar Eksekutif',
    date: '2026-08-06',
    startTime: '14:00',
    endTime: '16:00',
    applicantName: 'Dr. Faridah binti Hassan',
    applicantEmail: 'faridah@bpenawar.kpm.edu.my',
    applicantPhone: '013-4567890',
    applicantRole: 'Ketua Jabatan',
    department: 'Jabatan Perniagaan',
    purposeCategory: 'Mesyuarat',
    title: 'Mesyuarat Semakan Kurikulum Semester 1',
    paxCount: 18,
    notes: 'Mesyuarat bersama ahli jawatankuasa akademik',
    status: 'CONFIRMED',
    createdAt: '2026-08-02T11:20:00Z'
  },
  {
    id: 'BK-2026-000103',
    roomId: 'BK12',
    roomName: 'Bilik Kuliah 12',
    date: '2026-08-06',
    startTime: '14:30',
    endTime: '16:30',
    applicantName: 'En. Hafiz bin Ramli',
    applicantEmail: 'hafiz@bpenawar.kpm.edu.my',
    applicantPhone: '017-3216549',
    applicantRole: 'Penasihat Kelab IT',
    department: 'Kelab Mahasiswa IT KPMBP',
    purposeCategory: 'Aktiviti Pelajar',
    title: 'Latihan Pertandingan Hackathon KPMBP',
    paxCount: 25,
    notes: 'Aktiviti persediaan persatuan pelajar',
    status: 'PENDING',
    createdAt: '2026-08-04T15:00:00Z'
  }
];

// Sample Institutional Blocks
export const INITIAL_INSTITUTIONAL_BLOCKS: InstitutionalBlock[] = [
  {
    id: 'BLK-001',
    roomId: 'DEWAN_BESAR',
    date: '2026-08-10',
    startTime: '08:00',
    endTime: '17:00',
    title: 'Program Minggu Mesra Siswa (MMS) KPMBP 2026',
    reason: 'Aktiviti Kolej & Perhimpunan Rasmi Pelajar Baharu',
    createdBy: 'Unit Hal Ehwal Pelajar (HEP)'
  },
  {
    id: 'BLK-002',
    roomId: 'DKB',
    date: '2026-08-12',
    startTime: '08:00',
    endTime: '13:00',
    title: 'Ujian MPU Kemahiran Insaniah Pusat',
    reason: 'Peperiksaan Selaras Kolej',
    createdBy: 'Unit Peperiksaan & Penilaian'
  }
];
