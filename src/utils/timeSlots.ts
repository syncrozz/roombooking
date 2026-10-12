/**
 * Single Source of Truth for KPMBP SmartHub Operating Hours & Time Slots
 * Standard: SYNCROZZ ENGINEERING STANDARD (SES) v4.4
 *
 * Sesi Siang: 08:30 - 16:30 (atau selewatnya 18:30)
 * Sesi Malam: 20:00 - 23:00 (Maksimum 23:00)
 */

export type TimeSlotPeriod = 'DAY' | 'NIGHT';

export interface TimeSlot {
  id: string;
  start: string;
  end: string;
  label: string;
  period: TimeSlotPeriod;
  periodLabel: string;
}

export interface TimeOption {
  value: string;
  label: string;
  period: TimeSlotPeriod;
}

// Operating Hours Configuration (Extended to 08:00 - 24:00 to support Examination & Institutional Hall Blocks)
export const OPERATING_HOURS = {
  EARLIEST_BOOKING_START: '08:00',
  DAYTIME_START: '08:00',
  DAYTIME_STANDARD_END: '17:30',
  DAYTIME_MAX_END: '18:30',
  NIGHT_START: '20:00',
  NIGHT_END: '23:00',
  LATEST_BOOKING_END: '24:00',
} as const;

export const EARLIEST_BOOKING_START = OPERATING_HOURS.EARLIEST_BOOKING_START;
export const LATEST_BOOKING_END = OPERATING_HOURS.LATEST_BOOKING_END;
export const NIGHT_START = OPERATING_HOURS.NIGHT_START;
export const NIGHT_END = OPERATING_HOURS.NIGHT_END;

// Parse HH:MM to total minutes (Handles 24:00, 23:59, 12:00 AM midnight as 1440 minutes)
export function parseTimeMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim().toLowerCase();
  if (clean === '24:00' || clean === '24.00' || clean === '23:59' || clean === '12:00 am') {
    return 1440;
  }
  const parts = timeStr.replace('.', ':').split(':').map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  if (h === 24) return 1440;
  return h * 60 + m;
}

// Convert minutes to HH:MM format
export function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Standard 1-Hour Daytime Slots (used in Matrix and slot-level checks)
export const DAY_TIME_SLOTS: TimeSlot[] = [
  { id: 'DAY-0830', start: '08:30', end: '09:30', label: '08:30 - 09:30', period: 'DAY', periodLabel: '☀️ Waktu Siang' },
  { id: 'DAY-0930', start: '09:30', end: '10:30', label: '09:30 - 10:30', period: 'DAY', periodLabel: '☀️ Waktu Siang' },
  { id: 'DAY-1030', start: '10:30', end: '11:30', label: '10:30 - 11:30', period: 'DAY', periodLabel: '☀️ Waktu Siang' },
  { id: 'DAY-1130', start: '11:30', end: '12:30', label: '11:30 - 12:30', period: 'DAY', periodLabel: '☀️ Waktu Siang' },
  { id: 'DAY-1230', start: '12:30', end: '13:30', label: '12:30 - 13:30', period: 'DAY', periodLabel: '☀️ Waktu Siang' },
  { id: 'DAY-1330', start: '13:30', end: '14:30', label: '13:30 - 14:30', period: 'DAY', periodLabel: '☀️ Waktu Siang' },
  { id: 'DAY-1430', start: '14:30', end: '15:30', label: '14:30 - 15:30', period: 'DAY', periodLabel: '☀️ Waktu Siang' },
  { id: 'DAY-1530', start: '15:30', end: '16:30', label: '15:30 - 16:30', period: 'DAY', periodLabel: '☀️ Waktu Siang' },
  { id: 'DAY-1630', start: '16:30', end: '17:30', label: '16:30 - 17:30', period: 'DAY', periodLabel: '☀️ Waktu Siang' },
];

// Standard 1-Hour Night Slots (20:00 - 23:00 max)
export const NIGHT_TIME_SLOTS: TimeSlot[] = [
  { id: 'NIGHT-2000', start: '20:00', end: '21:00', label: '20:00 - 21:00', period: 'NIGHT', periodLabel: '🌙 Waktu Malam' },
  { id: 'NIGHT-2100', start: '21:00', end: '22:00', label: '21:00 - 22:00', period: 'NIGHT', periodLabel: '🌙 Waktu Malam' },
  { id: 'NIGHT-2200', start: '22:00', end: '23:00', label: '22:00 - 23:00', period: 'NIGHT', periodLabel: '🌙 Waktu Malam' },
];

// Unified List of All System Time Slots (Single Source of Truth)
export const ALL_BOOKING_TIME_SLOTS: TimeSlot[] = [
  ...DAY_TIME_SLOTS,
  ...NIGHT_TIME_SLOTS,
];

// Quick Booking & Filter: Start Time Options
export const BOOKING_START_OPTIONS: TimeOption[] = [
  // Sesi Awal Pagi / Peperiksaan & Majlis
  { value: '08:00', label: '08:00 AM (Awal Pagi / Peperiksaan)', period: 'DAY' },
  // Sesi Pagi & Siang
  { value: '08:30', label: '08:30 AM (Pagi)', period: 'DAY' },
  { value: '09:30', label: '09:30 AM (Pagi)', period: 'DAY' },
  { value: '10:30', label: '10:30 AM (Pagi)', period: 'DAY' },
  { value: '11:30', label: '11:30 AM (Pagi)', period: 'DAY' },
  { value: '12:30', label: '12:30 PM (Tengah Hari)', period: 'DAY' },
  { value: '13:30', label: '01:30 PM (Petang)', period: 'DAY' },
  { value: '14:30', label: '02:30 PM (Petang)', period: 'DAY' },
  { value: '15:30', label: '03:30 PM (Petang)', period: 'DAY' },
  // Sesi Petang Lanjutan (4:00 PM / 16:00)
  { value: '16:00', label: '04:00 PM (Petang)', period: 'DAY' },
  { value: '16:30', label: '04:30 PM (Petang)', period: 'DAY' },
  { value: '17:00', label: '05:00 PM (Petang)', period: 'DAY' },
  { value: '17:30', label: '05:30 PM (Petang)', period: 'DAY' },
  { value: '18:00', label: '06:00 PM (Petang)', period: 'DAY' },
  // Sesi Malam (19:00 - 22:00)
  { value: '19:00', label: '07:00 PM (Malam)', period: 'NIGHT' },
  { value: '20:00', label: '08:00 PM (Malam)', period: 'NIGHT' },
  { value: '21:00', label: '09:00 PM (Malam)', period: 'NIGHT' },
  { value: '22:00', label: '10:00 PM (Malam)', period: 'NIGHT' },
];

// Quick Booking & Filter: End Time Options
export const BOOKING_END_OPTIONS: TimeOption[] = [
  // Sesi Siang
  { value: '09:30', label: '09:30 AM', period: 'DAY' },
  { value: '10:30', label: '10:30 AM', period: 'DAY' },
  { value: '11:30', label: '11:30 AM', period: 'DAY' },
  { value: '12:30', label: '12:30 PM', period: 'DAY' },
  { value: '13:30', label: '01:30 PM', period: 'DAY' },
  { value: '14:30', label: '02:30 PM', period: 'DAY' },
  { value: '15:30', label: '03:30 PM', period: 'DAY' },
  { value: '16:00', label: '04:00 PM', period: 'DAY' },
  { value: '16:30', label: '04:30 PM', period: 'DAY' },
  { value: '17:00', label: '05:00 PM', period: 'DAY' },
  { value: '17:30', label: '05:30 PM', period: 'DAY' },
  { value: '18:00', label: '06:00 PM', period: 'DAY' },
  { value: '18:30', label: '06:30 PM', period: 'DAY' },
  // Sesi Malam
  { value: '19:00', label: '07:00 PM (Malam)', period: 'NIGHT' },
  { value: '20:00', label: '08:00 PM (Malam)', period: 'NIGHT' },
  { value: '21:00', label: '09:00 PM (Malam)', period: 'NIGHT' },
  { value: '22:00', label: '10:00 PM (Malam)', period: 'NIGHT' },
  { value: '23:00', label: '11:00 PM (Malam)', period: 'NIGHT' },
  { value: '24:00', label: '12:00 AM (Tengah Malam / 24 Jam)', period: 'NIGHT' },
];

/**
 * Returns true if a time point is at night (>= 20:00)
 */
export function isNightTime(timeStr: string): boolean {
  if (!timeStr) return false;
  const mins = parseTimeMinutes(timeStr);
  const nightMin = parseTimeMinutes(OPERATING_HOURS.NIGHT_START); // 1200 mins
  return mins >= nightMin;
}

/**
 * Returns true if the given start/end range overlaps or is situated in the night period (20:00 - 23:00)
 */
export function isTimeRangeNight(startTime: string, endTime: string): boolean {
  if (!startTime || !endTime) return false;
  const startMin = parseTimeMinutes(startTime);
  const endMin = parseTimeMinutes(endTime);
  const nightStartMin = parseTimeMinutes(OPERATING_HOURS.NIGHT_START); // 1200 (20:00)
  const nightEndMin = parseTimeMinutes('24:00');                       // 1440 (24:00)

  return startMin < nightEndMin && endMin > nightStartMin;
}

/**
 * Core validation function for booking time range:
 * - Allows start from 08:00 (supporting exam morning sessions)
 * - Allows end up to 24:00 (12:00 midnight)
 * - Rejects end time <= start time
 */
export function validateBookingTime(
  startTime: string,
  endTime: string
): { isValid: boolean; errorMsg?: string } {
  if (!startTime || !endTime) {
    return { isValid: false, errorMsg: 'Sila lengkapkan masa mula dan masa tamat tempahan.' };
  }

  const startMin = parseTimeMinutes(startTime);
  const endMin = parseTimeMinutes(endTime);
  const earliestMin = parseTimeMinutes(OPERATING_HOURS.EARLIEST_BOOKING_START); // 08:00 -> 480
  const latestMin = parseTimeMinutes(OPERATING_HOURS.LATEST_BOOKING_END);       // 24:00 -> 1440

  // 1. End time must be strictly after start time
  if (endMin <= startMin) {
    return {
      isValid: false,
      errorMsg: `Waktu tamat (${endTime}) mestilah selepas waktu mula (${startTime}).`
    };
  }

  // 2. Hard Ceiling: Rejects booking ending after 24:00 (12:00 AM)
  if (endMin > latestMin) {
    return {
      isValid: false,
      errorMsg: `Tempahan tidak dibenarkan melebihi jam 24:00 (12:00 AM Tengah Malam). Had operasi maksimum kolej adalah jam 24:00.`
    };
  }

  // 3. Earliest permissible start: 08:00 AM
  if (startMin < earliestMin) {
    return {
      isValid: false,
      errorMsg: `Waktu tempahan paling awal kolej bermula pada jam 08:00 AM.`
    };
  }

  // 4. Booking cannot start after closing hours (after 24:00)
  if (startMin >= latestMin) {
    return {
      isValid: false,
      errorMsg: `Waktu mula tidak boleh melebihi jam 24:00 (12:00 AM).`
    };
  }

  return { isValid: true };
}
