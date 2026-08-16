import { 
  Room, 
  AcademicScheduleSlot, 
  AdHocBooking, 
  InstitutionalBlock, 
  RoomAvailabilityCheck, 
  DayOfWeek,
  SearchFilterParams 
} from '../types';

export const MALAY_DAYS: DayOfWeek[] = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];

export function getMalayDayOfWeek(dateStr: string): DayOfWeek {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Isnin';
  return MALAY_DAYS[d.getDay()];
}

export function parseTimeMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.replace('.', ':').split(':').map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  return h * 60 + m;
}

export function calculateDurationText(startTime: string, endTime: string): string {
  if (!startTime || !endTime) return '';
  
  let startMin = parseTimeMinutes(startTime);
  let endMin = parseTimeMinutes(endTime);

  if (endMin <= startMin) {
    if (endMin + 720 > startMin) {
      endMin += 720; // 12 hours = 720 minutes
    } else {
      return '0 jam';
    }
  }

  const diffMin = endMin - startMin;
  const hours = Math.floor(diffMin / 60);
  const minutes = diffMin % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} jam ${minutes} minit`;
  } else if (hours > 0) {
    return `${hours} jam`;
  } else if (minutes > 0) {
    return `${minutes} minit`;
  }
  return '0 jam';
}

export function isTimeOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const minStartA = parseTimeMinutes(startA);
  const minEndA = parseTimeMinutes(endA);
  const minStartB = parseTimeMinutes(startB);
  const minEndB = parseTimeMinutes(endB);

  return minStartA < minEndB && minEndA > minStartB;
}

export function checkRoomAvailability(
  room: Room,
  date: string,
  startTime: string,
  endTime: string,
  academicSchedule: AcademicScheduleSlot[],
  adhocBookings: AdHocBooking[],
  institutionalBlocks: InstitutionalBlock[]
): RoomAvailabilityCheck {
  // Layer 3: Check Institutional Block
  const block = institutionalBlocks.find(b => 
    b.roomId === room.id && 
    b.date === date && 
    isTimeOverlap(startTime, endTime, b.startTime, b.endTime)
  );

  if (block) {
    return {
      roomId: room.id,
      room,
      status: 'BLOCKED',
      institutionalBlock: block,
      conflictReason: `Program/Aktiviti Institusi: ${block.title} (${block.createdBy})`
    };
  }

  // Layer 1: Check Academic Schedule Timetable
  const dayOfWeek = getMalayDayOfWeek(date);
  const acadSlot = academicSchedule.find(s => 
    s.roomId === room.id && 
    s.dayOfWeek === dayOfWeek && 
    isTimeOverlap(startTime, endTime, s.startTime, s.endTime)
  );

  if (acadSlot) {
    return {
      roomId: room.id,
      room,
      status: 'OCCUPIED_ACADEMIC',
      academicSlot: acadSlot,
      conflictReason: `Jadual Akademik: ${acadSlot.courseCode} ${acadSlot.courseName} [${acadSlot.className}] oleh ${acadSlot.lecturerName}`
    };
  }

  // Layer 2: Check Existing Ad-hoc Bookings
  const existingBooking = adhocBookings.find(b => 
    b.roomId === room.id && 
    b.date === date && 
    (b.status === 'CONFIRMED' || b.status === 'PENDING') &&
    isTimeOverlap(startTime, endTime, b.startTime, b.endTime)
  );

  if (existingBooking) {
    const isPending = existingBooking.status === 'PENDING';
    return {
      roomId: room.id,
      room,
      status: isPending ? 'PENDING_BOOKING' : 'OCCUPIED_BOOKING',
      existingBooking,
      conflictReason: isPending 
        ? `Permohonan Menunggu Kelulusan: ${existingBooking.title} (${existingBooking.applicantName})`
        : `Tempahan Disahkan: ${existingBooking.title} (${existingBooking.applicantName})`
    };
  }

  // Layer 4: Clear -> AVAILABLE
  return {
    roomId: room.id,
    room,
    status: 'AVAILABLE'
  };
}

export function findSmartAlternatives(
  targetRoomId: string,
  params: SearchFilterParams,
  rooms: Room[],
  academicSchedule: AcademicScheduleSlot[],
  adhocBookings: AdHocBooking[],
  institutionalBlocks: InstitutionalBlock[]
): {
  alternativeRooms: RoomAvailabilityCheck[];
  alternativeSlots: { startTime: string; endTime: string; status: 'AVAILABLE' }[];
} {
  const { date, startTime, endTime, minCapacity, category, isAircondOnly, isSmartClassroomOnly } = params;

  // 1. Find other rooms available at the exact same time slot
  const candidateRooms = rooms.filter(r => {
    if (r.id === targetRoomId) return false; // exclude original conflicted room
    if (category !== 'Semua' && r.category !== category) return false;
    if (minCapacity > 0 && r.capacity < minCapacity) return false;
    if (isAircondOnly && !r.hasAircond) return false;
    if (isSmartClassroomOnly && !r.hasAircond && !r.isSmartClassroom) return false;
    return true;
  });

  const availableAlternatives: RoomAvailabilityCheck[] = [];

  for (const r of candidateRooms) {
    const check = checkRoomAvailability(r, date, startTime, endTime, academicSchedule, adhocBookings, institutionalBlocks);
    if (check.status === 'AVAILABLE') {
      availableAlternatives.push(check);
    }
  }

  // Sort alternatives by closest capacity and aircond status
  availableAlternatives.sort((a, b) => {
    if (a.room.hasAircond && !b.room.hasAircond) return -1;
    if (!a.room.hasAircond && b.room.hasAircond) return 1;
    return Math.abs(a.room.capacity - minCapacity) - Math.abs(b.room.capacity - minCapacity);
  });

  // 2. Find alternative time slots on the SAME target room if user wants to adjust time
  const sampleTimeSlots = [
    { startTime: '08:30', endTime: '09:30' },
    { startTime: '09:30', endTime: '10:30' },
    { startTime: '10:30', endTime: '11:30' },
    { startTime: '11:30', endTime: '12:30' },
    { startTime: '12:30', endTime: '13:30' },
    { startTime: '13:30', endTime: '14:30' },
    { startTime: '14:30', endTime: '15:30' },
    { startTime: '15:30', endTime: '16:30' }
  ];

  const targetRoom = rooms.find(r => r.id === targetRoomId);
  const alternativeSlots: { startTime: string; endTime: string; status: 'AVAILABLE' }[] = [];

  if (targetRoom) {
    for (const slot of sampleTimeSlots) {
      if (slot.startTime === startTime) continue;
      const slotCheck = checkRoomAvailability(
        targetRoom, 
        date, 
        slot.startTime, 
        slot.endTime, 
        academicSchedule, 
        adhocBookings, 
        institutionalBlocks
      );
      if (slotCheck.status === 'AVAILABLE') {
        alternativeSlots.push({
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: 'AVAILABLE'
        });
      }
    }
  }

  return {
    alternativeRooms: availableAlternatives.slice(0, 5), // top 5
    alternativeSlots
  };
}

export function formatWhatsAppMessage(booking: AdHocBooking): string {
  const statusEmoji = booking.status === 'CONFIRMED' ? '🟢 CONFIRMED' : '🟡 PENDING';
  const emailLine = booking.applicantEmail ? `\n✉️ *E-mel Rasmi:* ${booking.applicantEmail}` : '';
  const text = `*KPMBP SMARTHUB — TEMPAHAN RUANG*
━━━━━━━━━━━━━━━━━━━━━
📌 *ID Tempahan:* ${booking.id}
🏫 *Ruang:* ${booking.roomName} (${booking.roomId})
📅 *Tarikh:* ${booking.date} (${getMalayDayOfWeek(booking.date)})
🕐 *Masa:* ${booking.startTime} - ${booking.endTime}
👤 *Pemohon:* ${booking.applicantName} (${booking.applicantRole})${emailLine}
🏢 *Jabatan:* ${booking.department}
🎯 *Tujuan:* ${booking.purposeCategory} - ${booking.title}
👥 *Jumlah Hadirin:* ${booking.paxCount} orang
⚡ *Status:* ${statusEmoji}
━━━━━━━━━━━━━━━━━━━━━
_Mesej ini dijana secara automatik oleh Sistem Tempahan Ruang KPMBP SmartHub._`;

  return text;
}

export function generateWhatsAppLink(booking: AdHocBooking): string {
  const msg = formatWhatsAppMessage(booking);
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

export function formatDateMalay(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dayName = getMalayDayOfWeek(dateStr);
  const day = d.getDate();
  const months = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
  const monthName = months[d.getMonth()];
  const year = d.getFullYear();
  return `${dayName}, ${day} ${monthName} ${year}`;
}
