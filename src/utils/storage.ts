import { Room, AcademicScheduleSlot, AdHocBooking, InstitutionalBlock } from '../types';
import { INITIAL_ROOMS, INITIAL_ACADEMIC_SCHEDULE, INITIAL_ADHOC_BOOKINGS, INITIAL_INSTITUTIONAL_BLOCKS } from '../data/initialData';

const ROOMS_KEY = 'kpmbp_rooms_v3';
const ACADEMIC_SCHEDULE_KEY = 'kpmbp_academic_schedule_v3';
const ADHOC_BOOKINGS_KEY = 'kpmbp_adhoc_bookings_v1';
const INSTITUTIONAL_BLOCKS_KEY = 'kpmbp_institutional_blocks_v1';

export function getStoredRooms(): Room[] {
  try {
    const data = localStorage.getItem(ROOMS_KEY);
    let rooms: Room[] = data ? JSON.parse(data) : INITIAL_ROOMS;
    if (!rooms || rooms.length !== INITIAL_ROOMS.length) {
      rooms = INITIAL_ROOMS;
      localStorage.setItem(ROOMS_KEY, JSON.stringify(INITIAL_ROOMS));
    }
    return rooms;
  } catch {
    return INITIAL_ROOMS;
  }
}

export function isTargetVenue(room: { code: string; name: string; category?: string; id?: string }): boolean {
  const codeUpper = (room.code || '').toUpperCase();
  const nameUpper = (room.name || '').toUpperCase();
  const idUpper = (room.id || '').toUpperCase();

  return (
    idUpper === 'DEWAN_BESAR' ||
    idUpper === 'DEWAN_SEMINAR' ||
    idUpper === 'DKA' ||
    idUpper === 'DKB' ||
    codeUpper === 'DKA' ||
    codeUpper === 'DKB' ||
    codeUpper.includes('DKA') ||
    codeUpper.includes('DKB') ||
    nameUpper.includes('DEWAN BESAR') ||
    nameUpper.includes('DEWAN SEMINAR') ||
    (nameUpper.includes('DEWAN') && nameUpper.includes('BESAR')) ||
    (nameUpper.includes('DEWAN') && nameUpper.includes('SEMINAR'))
  );
}

export function formatLevel(level: number | string): string {
  const lvlStr = String(level).trim();
  if (lvlStr === '1' || lvlStr === 'G' || lvlStr === 'g' || lvlStr.toLowerCase() === 'ground floor') {
    return 'Ground Floor';
  }
  if (lvlStr === '2' || lvlStr.toLowerCase() === '2nd floor') {
    return '2nd Floor';
  }
  if (lvlStr === '3' || lvlStr.toLowerCase() === '3rd floor') {
    return '3rd Floor';
  }
  if (lvlStr === '4' || lvlStr.toLowerCase() === '4th floor') {
    return '4th Floor';
  }
  return level ? `${level} Floor` : '';
}

export function saveStoredRooms(rooms: Room[]): void {
  localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
}

export function getStoredAcademicSchedule(): AcademicScheduleSlot[] {
  try {
    const data = localStorage.getItem(ACADEMIC_SCHEDULE_KEY);
    return data ? JSON.parse(data) : INITIAL_ACADEMIC_SCHEDULE;
  } catch {
    return INITIAL_ACADEMIC_SCHEDULE;
  }
}

export function saveStoredAcademicSchedule(schedule: AcademicScheduleSlot[]): void {
  localStorage.setItem(ACADEMIC_SCHEDULE_KEY, JSON.stringify(schedule));
}

export function getStoredAdHocBookings(): AdHocBooking[] {
  try {
    const data = localStorage.getItem(ADHOC_BOOKINGS_KEY);
    return data ? JSON.parse(data) : INITIAL_ADHOC_BOOKINGS;
  } catch {
    return INITIAL_ADHOC_BOOKINGS;
  }
}

export function saveStoredAdHocBookings(bookings: AdHocBooking[]): void {
  localStorage.setItem(ADHOC_BOOKINGS_KEY, JSON.stringify(bookings));
}

export function getStoredInstitutionalBlocks(): InstitutionalBlock[] {
  try {
    const data = localStorage.getItem(INSTITUTIONAL_BLOCKS_KEY);
    return data ? JSON.parse(data) : INITIAL_INSTITUTIONAL_BLOCKS;
  } catch {
    return INITIAL_INSTITUTIONAL_BLOCKS;
  }
}

export function saveStoredInstitutionalBlocks(blocks: InstitutionalBlock[]): void {
  localStorage.setItem(INSTITUTIONAL_BLOCKS_KEY, JSON.stringify(blocks));
}

export interface UserProfileHistory {
  applicantName: string;
  applicantEmail: string;
  applicantRole: string;
  department: string;
  applicantPhone?: string;
  lastUsedAt?: string;
}

const USER_PROFILES_KEY = 'kpmbp_user_profiles_v1';
const ACTIVE_USER_KEY = 'kpmbp_active_user_v1';

export const DEFAULT_USER_PROFILES: UserProfileHistory[] = [
  {
    applicantName: 'Ahmad Khairi bin Ali',
    applicantEmail: 'khairi@bpenawar.kpm.edu.my',
    applicantRole: 'Pensyarah Kanan',
    department: 'Jabatan Sains Komputer',
    applicantPhone: '012-3456789',
    lastUsedAt: new Date().toISOString()
  },
  {
    applicantName: 'Pn. Tahira binti Mohamed',
    applicantEmail: 'tahira@bpenawar.kpm.edu.my',
    applicantRole: 'Pensyarah Kanan',
    department: 'Jabatan Sains Komputer',
    applicantPhone: '019-8765432',
    lastUsedAt: new Date().toISOString()
  },
  {
    applicantName: 'Dr. Faridah binti Hassan',
    applicantEmail: 'faridah@bpenawar.kpm.edu.my',
    applicantRole: 'Ketua Jabatan',
    department: 'Jabatan Perniagaan',
    applicantPhone: '013-4567890',
    lastUsedAt: new Date().toISOString()
  }
];

export function getStoredUserProfiles(): UserProfileHistory[] {
  try {
    const data = localStorage.getItem(USER_PROFILES_KEY);
    if (!data) return DEFAULT_USER_PROFILES;
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_USER_PROFILES;
  } catch {
    return DEFAULT_USER_PROFILES;
  }
}

export function findProfileByEmail(email: string): UserProfileHistory | null {
  if (!email || !email.trim()) return null;
  const cleanEmail = email.trim().toLowerCase();
  const profiles = getStoredUserProfiles();
  return profiles.find(p => p.applicantEmail.trim().toLowerCase() === cleanEmail) || null;
}

export function getStoredActiveUser(): UserProfileHistory {
  try {
    const data = localStorage.getItem(ACTIVE_USER_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed && parsed.applicantEmail) return parsed;
    }
  } catch {
    // fallback
  }
  const profiles = getStoredUserProfiles();
  return profiles[0] || DEFAULT_USER_PROFILES[0];
}

export function saveActiveUser(profile: UserProfileHistory): void {
  try {
    const updated = { ...profile, lastUsedAt: new Date().toISOString() };
    localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(updated));
    saveUserProfile(updated);
  } catch (err) {
    console.error('Error saving active user:', err);
  }
}

export function clearActiveUser(): void {
  localStorage.removeItem(ACTIVE_USER_KEY);
}

export function saveUserProfile(profile: UserProfileHistory): void {
  try {
    const existing = getStoredUserProfiles();
    const filtered = existing.filter(p => p.applicantEmail.toLowerCase() !== profile.applicantEmail.toLowerCase());
    const updated = [
      { ...profile, lastUsedAt: new Date().toISOString() },
      ...filtered
    ].slice(0, 10);
    localStorage.setItem(USER_PROFILES_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Error saving user profile:', err);
  }
}

export function resetToDefaults(): void {
  localStorage.setItem(ROOMS_KEY, JSON.stringify(INITIAL_ROOMS));
  localStorage.setItem(ACADEMIC_SCHEDULE_KEY, JSON.stringify(INITIAL_ACADEMIC_SCHEDULE));
  localStorage.setItem(ADHOC_BOOKINGS_KEY, JSON.stringify(INITIAL_ADHOC_BOOKINGS));
  localStorage.setItem(INSTITUTIONAL_BLOCKS_KEY, JSON.stringify(INITIAL_INSTITUTIONAL_BLOCKS));
  localStorage.setItem(USER_PROFILES_KEY, JSON.stringify(DEFAULT_USER_PROFILES));
}

export function generateBookingId(): string {
  const rand = Math.floor(100 + Math.random() * 900);
  const ts = Date.now().toString().slice(-4);
  return `BK-2026-${ts}${rand}`;
}
