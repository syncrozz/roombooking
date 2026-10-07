import { Room, AcademicScheduleSlot, AdHocBooking, InstitutionalBlock, StaffUser } from '../types';
import { INITIAL_ROOMS, INITIAL_ACADEMIC_SCHEDULE, INITIAL_ADHOC_BOOKINGS, INITIAL_INSTITUTIONAL_BLOCKS } from '../data/initialData';

const ROOMS_KEY = 'kpmbp_rooms_v4';
const ACADEMIC_SCHEDULE_KEY = 'kpmbp_academic_schedule_v3';
const ADHOC_BOOKINGS_KEY = 'kpmbp_adhoc_bookings_v1';
const INSTITUTIONAL_BLOCKS_KEY = 'kpmbp_institutional_blocks_v1';

export function getStoredRooms(): Room[] {
  try {
    const data = localStorage.getItem(ROOMS_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    localStorage.setItem(ROOMS_KEY, JSON.stringify(INITIAL_ROOMS));
    return INITIAL_ROOMS;
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
  if (!level) return '';
  const lvlStr = String(level).trim();
  const lower = lvlStr.toLowerCase();
  if (lower === 'g' || lower === 'ground' || lower === 'ground floor' || lower === '0' || lower === 'aras g' || lower === 'aras bawah') {
    return 'Ground Floor';
  }
  if (lower === '1' || lower === '1st' || lower === '1st floor' || lower === 'aras 1' || lower === 'tingkat 1') {
    return '1st Floor';
  }
  if (lower === '2' || lower === '2nd' || lower === '2nd floor' || lower === 'aras 2' || lower === 'tingkat 2') {
    return '2nd Floor';
  }
  if (lower === '3' || lower === '3rd' || lower === '3rd floor' || lower === 'aras 3' || lower === 'tingkat 3') {
    return '3rd Floor';
  }
  if (lower === '4' || lower === '4th' || lower === '4th floor' || lower === 'aras 4' || lower === 'tingkat 4') {
    return '4th Floor';
  }
  return lvlStr;
}

export function saveStoredRooms(rooms: Room[]): void {
  try {
    localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
  } catch (err) {
    console.error('Failed to save rooms to storage:', err);
  }
}

export function getStoredAcademicSchedule(): AcademicScheduleSlot[] {
  try {
    const isCustomized = localStorage.getItem('kpmbp_schedule_customized') === 'true';
    const data = localStorage.getItem(ACADEMIC_SCHEDULE_KEY);
    if (isCustomized) {
      return data ? JSON.parse(data) : [];
    }
    return data ? JSON.parse(data) : INITIAL_ACADEMIC_SCHEDULE;
  } catch {
    return INITIAL_ACADEMIC_SCHEDULE;
  }
}

export function saveStoredAcademicSchedule(schedule: AcademicScheduleSlot[]): void {
  try {
    localStorage.setItem('kpmbp_schedule_customized', 'true');
    localStorage.setItem(ACADEMIC_SCHEDULE_KEY, JSON.stringify(schedule));
  } catch (err) {
    console.error('Error storing academic schedule locally:', err);
  }
}

export function getStoredAdHocBookings(): AdHocBooking[] {
  try {
    const data = localStorage.getItem(ADHOC_BOOKINGS_KEY);
    const list: AdHocBooking[] = data ? JSON.parse(data) : INITIAL_ADHOC_BOOKINGS;
    // Strict Zero Demo Data Filter
    return list.filter(b => b.id !== 'BK-2026-000101' && b.id !== 'BK-2026-000102' && b.id !== 'BK-2026-000103');
  } catch {
    return INITIAL_ADHOC_BOOKINGS;
  }
}

export function saveStoredAdHocBookings(bookings: AdHocBooking[]): void {
  const cleanBookings = bookings.filter(b => b.id !== 'BK-2026-000101' && b.id !== 'BK-2026-000102' && b.id !== 'BK-2026-000103');
  localStorage.setItem(ADHOC_BOOKINGS_KEY, JSON.stringify(cleanBookings));
}

export function getStoredInstitutionalBlocks(): InstitutionalBlock[] {
  try {
    const data = localStorage.getItem(INSTITUTIONAL_BLOCKS_KEY);
    const list: InstitutionalBlock[] = data ? JSON.parse(data) : INITIAL_INSTITUTIONAL_BLOCKS;
    // Strict Zero Demo Data Filter
    return list.filter(b => b.id !== 'BLK-001' && b.id !== 'BLK-002');
  } catch {
    return INITIAL_INSTITUTIONAL_BLOCKS;
  }
}

export function saveStoredInstitutionalBlocks(blocks: InstitutionalBlock[]): void {
  const cleanBlocks = blocks.filter(b => b.id !== 'BLK-001' && b.id !== 'BLK-002');
  localStorage.setItem(INSTITUTIONAL_BLOCKS_KEY, JSON.stringify(cleanBlocks));
}

export interface UserProfileHistory {
  staffId?: string;
  applicantName: string;
  applicantEmail: string;
  applicantRole: string;
  department: string;
  applicantPhone?: string;
  lastUsedAt?: string;
  pinStatus?: 'DEFAULT' | 'CUSTOM';
}

const USER_PROFILES_KEY = 'kpmbp_user_profiles_v1';
const ACTIVE_USER_KEY = 'kpmbp_active_user_v1';

// Pilot Operational: Zero Demo Profiles
export const DEFAULT_USER_PROFILES: UserProfileHistory[] = [];

export function getStoredUserProfiles(): UserProfileHistory[] {
  try {
    const data = localStorage.getItem(USER_PROFILES_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      // Filter out obsolete fake placeholder emails and null entries
      return parsed.filter(p => p && p.applicantEmail && !['khairi@bpenawar.kpm.edu.my', 'tahira@bpenawar.kpm.edu.my', 'faridah@bpenawar.kpm.edu.my'].includes(p.applicantEmail));
    }
    return [];
  } catch {
    return [];
  }
}

export function findProfileByEmail(email: string): UserProfileHistory | null {
  if (!email || !email.trim()) return null;
  const cleanEmail = email.trim().toLowerCase();
  const profiles = getStoredUserProfiles();
  return profiles.find(p => p && p.applicantEmail && p.applicantEmail.trim().toLowerCase() === cleanEmail) || null;
}

export function getStoredActiveUser(): UserProfileHistory | null {
  try {
    const data = localStorage.getItem(ACTIVE_USER_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed && parsed.applicantEmail) {
        if (['khairi@bpenawar.kpm.edu.my', 'tahira@bpenawar.kpm.edu.my', 'faridah@bpenawar.kpm.edu.my'].includes(parsed.applicantEmail)) {
          return null;
        }
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return null;
}

export type ActiveUserListener = (profile: UserProfileHistory | null) => void;
const activeUserListeners = new Set<ActiveUserListener>();

export function subscribeToActiveUser(listener: ActiveUserListener): () => void {
  activeUserListeners.add(listener);
  return () => {
    activeUserListeners.delete(listener);
  };
}

function notifyActiveUserChanged(profile: UserProfileHistory | null): void {
  activeUserListeners.forEach(listener => {
    try {
      listener(profile);
    } catch {
      // ignore
    }
  });
}

export function saveActiveUser(profile: UserProfileHistory): void {
  try {
    if (!profile || !profile.applicantEmail) return;
    const updated = { ...profile, lastUsedAt: new Date().toISOString() };
    localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(updated));
    saveUserProfile(updated);
    notifyActiveUserChanged(updated);
  } catch (err) {
    console.error('Error saving active user:', err);
  }
}

export function clearActiveUser(): void {
  try {
    localStorage.removeItem(ACTIVE_USER_KEY);
    localStorage.removeItem(USER_PROFILES_KEY);
    notifyActiveUserChanged(null);
  } catch (err) {
    console.error('Error clearing active user:', err);
  }
}

export function saveUserProfile(profile: UserProfileHistory): void {
  try {
    if (!profile || !profile.applicantEmail) return;
    const existing = getStoredUserProfiles();
    const filtered = existing.filter(p => p && p.applicantEmail && p.applicantEmail.toLowerCase() !== profile.applicantEmail.toLowerCase());
    const updated = [
      { ...profile, lastUsedAt: new Date().toISOString() },
      ...filtered
    ].slice(0, 10);
    localStorage.setItem(USER_PROFILES_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Error saving user profile:', err);
  }
}

export function purgeAllDemoDataLocal(): void {
  localStorage.removeItem(ADHOC_BOOKINGS_KEY);
  localStorage.removeItem(INSTITUTIONAL_BLOCKS_KEY);
  localStorage.removeItem(USER_PROFILES_KEY);
  localStorage.removeItem(ACTIVE_USER_KEY);
}

export function resetToDefaults(): void {
  localStorage.removeItem('kpmbp_schedule_customized');
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

const STAFF_CACHE_KEY = 'kpmbp_staff_cache_v1';

export function deduplicateStaffById(list: StaffUser[]): StaffUser[] {
  const map = new Map<string, StaffUser>();
  list.forEach((st) => {
    const rawId = (st.id || '').trim();
    if (!rawId) return;
    const key = rawId.toLowerCase();
    const existing = map.get(key);
    if (!existing) {
      const isCustom = st.pinStatus === 'CUSTOM' && st.pin && /^\d{4}$/.test(st.pin) && st.pin !== '1234' && !!st.pinChangedAt;
      map.set(key, {
        ...st,
        id: rawId,
        pin: isCustom ? st.pin : '1234',
        pinStatus: isCustom ? 'CUSTOM' : 'DEFAULT',
        pinChangedAt: isCustom ? st.pinChangedAt : undefined
      });
    } else {
      // Identity is Staff ID: resolve duplicate record
      // 1. Email: prefer @mara.gov.my over older domains if available
      let chosenEmail = existing.email;
      if (st.email && (st.email.includes('@mara.gov.my') || !existing.email.includes('@mara.gov.my'))) {
        chosenEmail = st.email;
      }
      
      const existingIsCustom = existing.pinStatus === 'CUSTOM' && existing.pin && existing.pin !== '1234' && !!existing.pinChangedAt;
      const stIsCustom = st.pinStatus === 'CUSTOM' && st.pin && st.pin !== '1234' && !!st.pinChangedAt;

      let chosenPin = '1234';
      let chosenStatus: 'DEFAULT' | 'CUSTOM' = 'DEFAULT';
      let chosenChangedAt: string | undefined = undefined;

      if (existingIsCustom) {
        chosenPin = existing.pin;
        chosenStatus = 'CUSTOM';
        chosenChangedAt = existing.pinChangedAt;
      } else if (stIsCustom) {
        chosenPin = st.pin;
        chosenStatus = 'CUSTOM';
        chosenChangedAt = st.pinChangedAt;
      }

      map.set(key, {
        id: existing.id || st.id,
        name: st.name || existing.name,
        department: st.department || existing.department,
        role: st.role || existing.role,
        phone: st.phone || existing.phone,
        email: chosenEmail,
        pin: chosenPin,
        pinStatus: chosenStatus,
        pinChangedAt: chosenChangedAt
      });
    }
  });
  return Array.from(map.values());
}

export function getStoredStaffUsers(): StaffUser[] | null {
  try {
    const data = localStorage.getItem(STAFF_CACHE_KEY);
    if (!data) return null;
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return deduplicateStaffById(parsed);
    }
    return null;
  } catch {
    return null;
  }
}

export function saveStoredStaffUsers(staffList: StaffUser[]): void {
  try {
    const clean = deduplicateStaffById(staffList);
    localStorage.setItem(STAFF_CACHE_KEY, JSON.stringify(clean));
  } catch (err) {
    console.warn('Failed to cache staff list locally:', err);
  }
}
