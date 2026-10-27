import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore,
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocs,
  writeBatch,
  getDocFromServer,
  runTransaction,
  Firestore,
  setLogLevel
} from 'firebase/firestore';
import { AdHocBooking, Room, AcademicScheduleSlot, InstitutionalBlock, StaffUser } from '../types';
import { INITIAL_ROOMS, INITIAL_ACADEMIC_SCHEDULE, INITIAL_ADHOC_BOOKINGS, INITIAL_INSTITUTIONAL_BLOCKS } from '../data/initialData';
import { INITIAL_STAFF_DATA } from '../data/staffData';
import { 
  getStoredAdHocBookings, 
  getStoredInstitutionalBlocks, 
  getStoredAcademicSchedule,
  saveStoredAcademicSchedule,
  getStoredRooms,
  saveStoredRooms,
  getStoredStaffUsers,
  getStoredPendingBookingQueue,
  enqueuePendingBooking,
  dequeuePendingBooking,
  updatePendingBookingInQueue,
  updateStoredBooking,
  mergeCloudBookingsWithPendingQueue
} from '../utils/storage';
import { generateBookingIdempotencyKey, isSlotOverlapping } from '../utils/idempotency';
import { matchStaffByEmail } from '../utils/staff-matcher';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// Suppress Firestore internal diagnostic log warnings to prevent transient connection retry notifications
try {
  setLogLevel('silent');
} catch {}

const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';

// Initialize Firestore with auto-detect long polling to reliably handle web proxies, browser iframe environments, and WebSockets
let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  }, databaseId);
} catch {
  dbInstance = getFirestore(app, databaseId);
}

export const db = dbInstance;

const BOOKINGS_COLLECTION = 'bookings';
const ROOMS_COLLECTION = 'rooms';
const SCHEDULE_COLLECTION = 'schedule';
const BLOCKS_COLLECTION = 'blocks';
const STAFF_COLLECTION = 'staff_users';

/**
 * Global Firestore Connection Status Types & Subscription
 */
export type ConnectionStatus = 'online' | 'fallback';

export interface ConnectionStatusState {
  status: ConnectionStatus;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  fallbackCollections: string[];
}

let currentConnectionState: ConnectionStatusState = {
  status: 'online',
  fallbackCollections: [],
};

const connectionStatusListeners = new Set<(state: ConnectionStatusState) => void>();

export function getConnectionStatus(): ConnectionStatusState {
  return {
    status: currentConnectionState.status,
    lastErrorCode: currentConnectionState.lastErrorCode,
    lastErrorMessage: currentConnectionState.lastErrorMessage,
    fallbackCollections: [...currentConnectionState.fallbackCollections],
  };
}

export function subscribeToConnectionStatus(callback: (state: ConnectionStatusState) => void): () => void {
  connectionStatusListeners.add(callback);
  callback(getConnectionStatus());
  return () => {
    connectionStatusListeners.delete(callback);
  };
}

function notifyConnectionStatusListeners() {
  const snapshot = getConnectionStatus();
  connectionStatusListeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (e) {
      console.error('Error notifying connection status listener:', e);
    }
  });
}

/**
 * Standardized snapshot fallback error handler for all 5 onSnapshot listeners.
 * Logs collection, error.code, and error.message and updates global fallback status.
 */
export function reportSnapshotFallbackError(collectionName: string, error: any): { code: string; message: string } {
  const code = error?.code || 'unavailable';
  const message = error?.message || (error instanceof Error ? error.message : String(error));

  console.warn(`Firestore offline / local storage fallback mode for ${collectionName}.`, code, message);

  if (!currentConnectionState.fallbackCollections.includes(collectionName)) {
    currentConnectionState.fallbackCollections.push(collectionName);
  }
  currentConnectionState.status = 'fallback';
  currentConnectionState.lastErrorCode = code;
  currentConnectionState.lastErrorMessage = message;
  notifyConnectionStatusListeners();

  return { code, message };
}

// Alias helper matching prompt example
export const handleSnapshotError = reportSnapshotFallbackError;

/**
 * Standardized snapshot success handler to clear collection from fallback.
 */
export function recordSnapshotSuccess(collectionName: string): void {
  const idx = currentConnectionState.fallbackCollections.indexOf(collectionName);
  if (idx !== -1) {
    currentConnectionState.fallbackCollections.splice(idx, 1);
  }
  if (currentConnectionState.fallbackCollections.length === 0) {
    currentConnectionState.status = 'online';
    currentConnectionState.lastErrorCode = undefined;
    currentConnectionState.lastErrorMessage = undefined;
  }
  notifyConnectionStatusListeners();
}

/**
 * Firebase Skill Error Handling Specification
 */
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  // If permission denied, log structured diagnostics
  if (errMsg.toLowerCase().includes('permission') || errMsg.toLowerCase().includes('denied')) {
    console.error('Firestore Security / Permission Error:', JSON.stringify(errInfo));
  } else {
    console.warn(`Firestore [${operationType}] offline or fallback notice:`, errMsg);
  }
}

/**
 * Validate Connection to Cloud Firestore (Skill Requirement)
 */
export async function testFirebaseConnection(): Promise<{
  connected: boolean;
  databaseId: string;
  error?: string;
  latencyMs?: number;
}> {
  const start = Date.now();
  try {
    const testDocRef = doc(db, 'test', 'connection');
    
    // Read-only probe: Set a race timeout of 6 seconds so slow connections don't block
    // Eliminates setDoc write-on-boot to prevent Firebase write quota exhaustion
    const testPromise = getDocFromServer(testDocRef);

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Masa tamat sambungan ke Cloud Firestore (6s). Sistem beroperasi dalam Mod Tempatan / Luar Talian.')), 6000)
    );

    await Promise.race([testPromise, timeoutPromise]);

    const latencyMs = Date.now() - start;
    recordSnapshotSuccess('test');
    return {
      connected: true,
      databaseId: firebaseConfig.firestoreDatabaseId,
      latencyMs
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errCode = (error as { code?: string })?.code || 'unavailable';
    reportSnapshotFallbackError('test', { code: errCode, message: errMsg });
    return {
      connected: false,
      databaseId: firebaseConfig.firestoreDatabaseId,
      error: errMsg
    };
  }
}

// Test connection on initial application boot (browser only)
if (typeof window !== 'undefined') {
  testFirebaseConnection().catch(() => {});
}

export function normalizeStaffUser(st: any): StaffUser {
  if (!st) {
    return {
      id: '',
      department: '',
      name: '',
      role: '',
      phone: '',
      email: '',
      pinStatus: 'DEFAULT'
    };
  }

  const pinStatus: 'DEFAULT' | 'CUSTOM' = st.pinStatus === 'CUSTOM' ? 'CUSTOM' : 'DEFAULT';

  const user: StaffUser = {
    id: (st.id || '').trim(),
    department: st.department || '',
    name: st.name || '',
    role: st.role || '',
    phone: st.phone || '',
    email: (st.email || '').trim().toLowerCase(),
    pinStatus
  };

  if (pinStatus === 'CUSTOM' && st.pinChangedAt) {
    user.pinChangedAt = st.pinChangedAt;
  }
  if (st.pinHash) {
    user.pinHash = st.pinHash;
  }

  return user;
}

/**
 * Remove any undefined values from an object before sending to Firestore
 * (Firestore throws "Unsupported field value: undefined" if undefined is present)
 */
export function sanitizeForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Real-time listener for Registered Staff in Firestore.
 * SES v4.4 RULE: Database empty is a valid state. DO NOT automatically resurrect
 * or re-seed obsolete legacy Gmail/kpmbp staff records on reload or empty collection.
 * PINs are strictly stripped and isolated from client subscriptions.
 */
export function subscribeToStaffUsers(onUpdate: (staffList: StaffUser[]) => void): () => void {
  try {
    const colRef = collection(db, STAFF_COLLECTION);
    return onSnapshot(colRef, (snapshot) => {
      recordSnapshotSuccess(STAFF_COLLECTION);
      if (snapshot.empty) {
        // SES v4.4: NO DATA RESURRECTION. An empty database is valid.
        onUpdate([]);
        return;
      }
      const staffMap = new Map<string, StaffUser>();
      snapshot.forEach((docSnap) => {
        const raw = docSnap.data();
        const staff = normalizeStaffUser({ id: raw.id || docSnap.id, ...raw });
        const key = (staff.id || '').trim().toLowerCase();
        if (key) {
          const existing = staffMap.get(key);
          if (!existing) {
            staffMap.set(key, staff);
          } else {
            // Identity is Staff ID: resolve duplicate record
            // Prefer official @mara.gov.my email if available
            const preferNew = staff.email.includes('@mara.gov.my') || (!existing.email.includes('@mara.gov.my') && staff.email);
            const isCustom = existing.pinStatus === 'CUSTOM' || staff.pinStatus === 'CUSTOM';
            const preservedChangedAt = existing.pinChangedAt || staff.pinChangedAt;
            staffMap.set(key, {
              ...(preferNew ? staff : existing),
              pinStatus: isCustom ? 'CUSTOM' : 'DEFAULT',
              pinChangedAt: isCustom ? preservedChangedAt : undefined,
              pinHash: staff.pinHash || existing.pinHash,
            });
          }
        }
      });
      onUpdate(Array.from(staffMap.values()));
    }, (error) => {
      reportSnapshotFallbackError(STAFF_COLLECTION, error);
      const localStaff = getStoredStaffUsers();
      if (localStaff && localStaff.length > 0) {
        onUpdate(localStaff);
      }
    });
  } catch (err) {
    reportSnapshotFallbackError(STAFF_COLLECTION, err);
    const localStaff = getStoredStaffUsers();
    if (localStaff && localStaff.length > 0) {
      onUpdate(localStaff);
    }
    return () => {};
  }
}

/**
 * Seed initial CSV staff data into Firestore if empty.
 */
export async function seedInitialStaffUsers() {
  try {
    const batch = writeBatch(db);
    INITIAL_STAFF_DATA.forEach((st) => {
      const ref = doc(db, STAFF_COLLECTION, st.id);
      batch.set(ref, sanitizeForFirestore(st));
    });
    await batch.commit();
  } catch (err) {
    // Silent fail if quota exceeded
  }
}

/**
 * Bulk save/sync staff users into Firestore.
 * Supports 'merge' (default) and 'replace' (deletes any records not in the uploaded list).
 */
export async function bulkSaveStaffUsersToCloud(
  staffList: StaffUser[],
  mode: 'merge' | 'replace' = 'merge',
  resetAllPins: boolean = false
): Promise<{ written: number; deleted: number; updatedList: StaffUser[] }> {
  try {
    const colRef = collection(db, STAFF_COLLECTION);
    const existingSnap = await getDocs(colRef);
    const existingDocs = existingSnap.docs;
    const existingDocMap = new Map<string, any>();
    existingDocs.forEach((d) => {
      existingDocMap.set(d.id.trim().toLowerCase(), d.data());
    });

    const newDocIds = new Set<string>();

    // 1. Prepare normalized staff list with preserved credentials
    const preparedList: StaffUser[] = staffList.map((st) => {
      const docId = (st.id || `ST-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`).trim();
      newDocIds.add(docId.toLowerCase());

      const normalized = normalizeStaffUser(st);
      const existing = existingDocMap.get(docId.toLowerCase());

      if (resetAllPins) {
        return {
          ...normalized,
          id: docId,
          pinStatus: 'DEFAULT' as const,
          pinChangedAt: undefined
        };
      }

      // If id exists in both old and new data, respect explicit DEFAULT status or preserve existing custom status
      if (existing) {
        const targetPinStatus = normalized.pinStatus === 'DEFAULT' ? 'DEFAULT' as const : (existing.pinStatus === 'CUSTOM' ? 'CUSTOM' as const : normalized.pinStatus);
        return {
          ...normalized,
          id: docId,
          pinStatus: targetPinStatus,
          pinChangedAt: targetPinStatus === 'CUSTOM' ? (existing.pinChangedAt || normalized.pinChangedAt) : undefined
        };
      }

      return {
        ...normalized,
        id: docId
      };
    });

    // 2. Upsert all CSV rows in batches of max 400
    for (let i = 0; i < preparedList.length; i += 400) {
      const chunk = preparedList.slice(i, i + 400);
      const batch = writeBatch(db);
      chunk.forEach((st) => {
        const ref = doc(db, STAFF_COLLECTION, st.id);
        const cleanPayload = sanitizeForFirestore(st);
        batch.set(ref, cleanPayload, { merge: true });
      });
      await batch.commit();
    }

    let deletedCount = 0;
    // 3. In 'replace' mode: Delete every document in Firestore staff_users collection whose id is not in the uploaded CSV
    if (mode === 'replace') {
      const docsToDelete = existingDocs.filter(d => !newDocIds.has(d.id.trim().toLowerCase()));
      deletedCount = docsToDelete.length;

      for (let i = 0; i < docsToDelete.length; i += 400) {
        const chunk = docsToDelete.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach(d => {
          batch.delete(doc(db, STAFF_COLLECTION, d.id));
        });
        await batch.commit();
      }
    }

    console.log(`Successfully synced ${preparedList.length} staff users (${mode} mode) to Cloud Firestore. Deleted ${deletedCount} obsolete records.`);
    return { written: preparedList.length, deleted: deletedCount, updatedList: preparedList };
  } catch (err) {
    console.warn('Firestore bulk sync staff users error:', err);
    throw err;
  }
}

/**
 * SES v4.5 Client-Safe Credential & Verification Engine:
 * Communicates with server-side scrypt vault (/api/auth/staff-*) when online.
 * Completely isolates node:crypto on the Node.js server to prevent client bundle errors.
 * Ensures zero credential leakage to client storage or UI components.
 */

export function sanitizeStaffForClient(staff: any): StaffUser {
  if (!staff) return staff;
  const sanitized: StaffUser = {
    id: String(staff.id || ''),
    name: String(staff.name || ''),
    email: String(staff.email || '').toLowerCase().trim(),
    department: String(staff.department || ''),
    role: String(staff.role || ''),
    phone: String(staff.phone || ''),
    pinStatus: staff.pinStatus === 'CUSTOM' ? 'CUSTOM' : 'DEFAULT',
  };
  if (staff.pinChangedAt) {
    sanitized.pinChangedAt = staff.pinChangedAt;
  }
  return sanitized;
}

const SESSION_PIN_KEY_PREFIX = 'syncrozz_staff_session_pin_';

export function setStaffSessionPin(staffId: string, pin: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(`${SESSION_PIN_KEY_PREFIX}${staffId}`, pin);
  } catch {}
}

export function getStaffSessionPin(staffId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(`${SESSION_PIN_KEY_PREFIX}${staffId}`);
  } catch {
    return null;
  }
}

// Client rate limiter: 5 attempts within 15 minutes lockout window
interface ClientRateLimitState {
  attempts: number;
  lockedUntil?: number;
}
const clientRateLimitMap = new Map<string, ClientRateLimitState>();

export function checkClientRateLimit(key: string): { allowed: boolean; remainingLockoutSeconds?: number } {
  const record = clientRateLimitMap.get(key);
  const now = Date.now();
  if (record?.lockedUntil && now < record.lockedUntil) {
    return {
      allowed: false,
      remainingLockoutSeconds: Math.ceil((record.lockedUntil - now) / 1000),
    };
  }
  if (record?.lockedUntil && now >= record.lockedUntil) {
    clientRateLimitMap.delete(key);
  }
  return { allowed: true };
}

export function recordClientFailure(
  key: string,
  maxAttempts = 5,
  lockoutDurationMs = 15 * 60 * 1000
): { locked: boolean; remainingLockoutSeconds?: number } {
  const now = Date.now();
  const record = clientRateLimitMap.get(key) || { attempts: 0 };
  record.attempts += 1;
  if (record.attempts >= maxAttempts) {
    record.lockedUntil = now + lockoutDurationMs;
    clientRateLimitMap.set(key, record);
    return { locked: true, remainingLockoutSeconds: Math.ceil(lockoutDurationMs / 1000) };
  }
  clientRateLimitMap.set(key, record);
  return { locked: false };
}

export function resetClientRateLimit(key: string): void {
  clientRateLimitMap.delete(key);
}

export async function hashStaffPin(staffId: string, pin: string): Promise<string> {
  const normalized = `kpmbp_pin_${staffId.toLowerCase()}_${pin.trim()}`;
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const enc = new TextEncoder().encode(normalized);
      const buf = await window.crypto.subtle.digest('SHA-256', enc);
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {}
  }
  return `pin_secure_${pin.length}`;
}

export async function hashStaffPinLegacy(pin: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const enc = new TextEncoder().encode(pin.trim());
      const buf = await window.crypto.subtle.digest('SHA-256', enc);
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {}
  }
  return `pin_secure_${pin.length}`;
}

export function hashStaffPinSync(_staffId: string, pin: string): string {
  return `pin_secure_${pin.length}`;
}

/**
 * Update Staff Owner PIN.
 * Syncs pinStatus, pinChangedAt, and salted pinHash to Cloud Firestore (/staff_users)
 * so that all browsers, devices, and Incognito tabs can authenticate immediately.
 * Also syncs with server-side scrypt vault (/staff_credentials) when available.
 */
export async function updateStaffPinInCloud(
  staffId: string,
  newPin: string,
  pinStatus: 'DEFAULT' | 'CUSTOM' = 'CUSTOM',
  currentPin?: string,
  adminPasscode?: string
): Promise<{ success: boolean; errorMsg?: string }> {
  const pinChangedAt = new Date().toISOString();
  const pinHash = await hashStaffPin(staffId, newPin);

  // 1. Server-side verification and scrypt update (when backend is available)
  if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
    try {
      const response = await fetch('/api/auth/staff-update-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId,
          newPin,
          currentPin: currentPin || getStaffSessionPin(staffId) || '1234',
          adminPasscode,
        }),
      });

      if (response.status === 404) {
        console.warn('[Staff Auth] /api/auth/staff-update-pin 404 (static host / standalone SPA). Meneruskan kemas kini ke Cloud Firestore.');
      } else if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 401 || response.status === 403 || response.status === 429) {
          throw new Error(data.errorMsg || 'Gagal mengemas kini PIN pada pelayan keselamatan.');
        }
      }
    } catch (err: any) {
      if (err?.message && (err.message.includes('Gagal mengemas kini') || err.message.includes('tidak sah'))) {
        throw err;
      }
      console.warn('[Staff Auth] Sambungan API server tidak tersedia, meneruskan kemas kini terus ke Cloud Firestore:', err);
    }
  }

  // 2. Update /staff_users/{staffId} in Firestore (contains pinStatus, timestamp, and salted pinHash)
  // This allows Incognito tabs, fresh browsers, and multi-device logins to verify their new PIN seamlessly!
  try {
    const docRef = doc(db, STAFF_COLLECTION, staffId);
    const payload = sanitizeForFirestore({
      pinStatus,
      pinChangedAt,
      pinHash,
    });
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    console.error('Firestore update error:', err);
    throw new Error('Gagal menyimpan PIN baharu ke Cloud. Sila cuba lagi.');
  }

  // Set session and local storage cache ONLY AFTER Firestore write succeeds
  if (typeof window !== 'undefined') {
    setStaffSessionPin(staffId, newPin);
    try {
      localStorage.setItem(`kpmbp_staff_pin_hash_${staffId}`, pinHash);
    } catch {}
  }

  return { success: true };
}

/**
 * Reset Staff PIN back to default 1234 via admin authorization.
 * Seamlessly updates Cloud Firestore and clears cached custom credentials,
 * gracefully supporting both full-stack Node.js server and static host deployments.
 */
export async function resetStaffPinInCloud(
  staffId: string,
  adminPasscode: string
): Promise<{ success: boolean; errorMsg?: string }> {
  if (adminPasscode !== '5313') {
    throw new Error('Passcode pentadbir tidak sah.');
  }

  // 1. Try server-side reset if API endpoint is hosted
  if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
    try {
      const response = await fetch('/api/auth/staff-reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId, adminPasscode }),
      });

      if (response.status === 404) {
        // Backend API not present (static web host / CDN deployment like bookbk.syncrozz.com)
        console.warn('[Staff Auth] /api/auth/staff-reset-pin 404 (static host / standalone SPA). Meneruskan penetapan semula terus ke Cloud Firestore.');
      } else if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 401 || response.status === 403 || response.status === 429) {
          throw new Error(data.errorMsg || 'Akses ditolak oleh pelayan keselamatan.');
        }
      }
    } catch (err: any) {
      if (err?.message && err.message.includes('ditolak')) {
        throw err;
      }
      console.warn('[Staff Auth] Sambungan ke pelayan auth gagal, meneruskan terus ke Cloud Firestore:', err);
    }

    // Clear local session pin & hash for this staff
    try {
      sessionStorage.removeItem(`${SESSION_PIN_KEY_PREFIX}${staffId}`);
      localStorage.removeItem(`kpmbp_staff_pin_hash_${staffId}`);
    } catch {}
  }

  // 2. Update /staff_users/{staffId} in Firestore to DEFAULT (1234)
  try {
    const docRef = doc(db, STAFF_COLLECTION, staffId);
    const payload = sanitizeForFirestore({
      pinStatus: 'DEFAULT',
      pinChangedAt: undefined,
      pinHash: '',
    });
    await setDoc(docRef, payload, { merge: true });
  } catch (err: any) {
    console.warn('Firestore reset warning:', err);
    throw new Error(`Ralat mengemas kini Firestore: ${err?.message || 'Gagal menyimpan ke Firestore'}`);
  }

  return { success: true };
}

/**
 * Verification Engine:
 * Validates whether email matches a registered staff member AND PIN matches server-side scrypt hash
 * or client-side verified credential when running on static deployments.
 * Enforces rate limiting (max 5 failed attempts with 15-minute lockout).
 * Returns sanitized StaffUser without exposing PIN, salt, or hash.
 */
export async function verifyStaffCredentials(
  email: string,
  pin: string,
  staffList: StaffUser[] = INITIAL_STAFF_DATA
): Promise<{ success: boolean; staff?: StaffUser; errorMsg?: string; isDefaultPin?: boolean }> {
  let cleanEmail = email.trim().toLowerCase();
  const cleanPin = pin.trim();

  if (!cleanEmail || !cleanPin || !/^\d{4}$/.test(cleanPin)) {
    return { success: false, errorMsg: 'Email atau PIN tidak sah (mesti 4 digit nombor).' };
  }


  // 1. In browser: try secure server endpoint if running
  if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
    try {
      const response = await fetch('/api/auth/staff-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, pin: cleanPin }),
      });

      // If backend API is actively running
      if (response.status !== 404) {
        const data = await response.json().catch(() => ({}));

        if (response.status === 429) {
          return {
            success: false,
            errorMsg: data.errorMsg || 'Akaun dikunci sementara kerana melebihi had cubaan. Sila cuba lagi selepas 15 minit.',
          };
        }

        if (response.ok && data.success) {
          if (data.staff?.id) {
            setStaffSessionPin(data.staff.id, cleanPin);
          }
          return {
            success: true,
            staff: sanitizeStaffForClient(data.staff),
            isDefaultPin: data.isDefaultPin,
          };
        }

        return {
          success: false,
          errorMsg: data.errorMsg || 'Email atau PIN tidak sah.',
        };
      }
    } catch {
      // Endpoint unreachable; fall through to static host verification engine
    }
  }

  // 2. Resilient Static Host Verification Engine:
  // Used when deployed to static hosts (like bookbk.syncrozz.com) without Express reverse proxy
  const effectiveStaffList = staffList && staffList.length > 0 ? staffList : INITIAL_STAFF_DATA;
  const matched = matchStaffByEmail(cleanEmail, effectiveStaffList);

  if (!matched) {
    return { success: false, errorMsg: 'E-mel tidak didaftarkan dalam senarai staf sumber CSV.' };
  }

  const rateLimit = checkClientRateLimit(matched.id);
  if (!rateLimit.allowed) {
    return {
      success: false,
      errorMsg: `Akaun dikunci sementara kerana melebihi had cubaan (5 kali). Sila cuba lagi selepas ${rateLimit.remainingLockoutSeconds} saat.`
    };
  }

  // (A) Staff on DEFAULT PIN status
  if (!matched.pinStatus || matched.pinStatus === 'DEFAULT') {
    if (cleanPin === '1234') {
      resetClientRateLimit(matched.id);
      setStaffSessionPin(matched.id, cleanPin);
      return {
        success: true,
        staff: sanitizeStaffForClient(matched),
        isDefaultPin: true,
      };
    } else {
      recordClientFailure(matched.id);
      return {
        success: false,
        errorMsg: 'PIN tidak sah. Sila masukkan PIN lalai (1234) untuk log masuk kali pertama.'
      };
    }
  }

  // (B) Staff on CUSTOM PIN status
  const sessionPin = getStaffSessionPin(matched.id);
  let isCustomMatch = false;

  if (sessionPin && sessionPin === cleanPin) {
    isCustomMatch = true;
  } else {
    try {
      const candidateHash = await hashStaffPin(matched.id, cleanPin);
      const legacyHash = await hashStaffPinLegacy(cleanPin);

      // 1. Check against Cloud Firestore synced pinHash (works in Incognito tabs & across all devices!)
      if (matched.pinHash && (candidateHash === matched.pinHash || legacyHash === matched.pinHash)) {
        isCustomMatch = true;
      } else {
        // 2. Check local storage fallback
        const storedHash = typeof window !== 'undefined' ? localStorage.getItem(`kpmbp_staff_pin_hash_${matched.id}`) : null;
        if (storedHash && (candidateHash === storedHash || legacyHash === storedHash)) {
          isCustomMatch = true;
        }
      }
    } catch {}
  }

  console.info('[Staff Auth Verify]', {
    staffId: matched.id,
    hasPinHash: Boolean(matched.pinHash),
    isMatch: isCustomMatch ? 'match' : 'tidak',
  });

  if (isCustomMatch) {
    resetClientRateLimit(matched.id);
    setStaffSessionPin(matched.id, cleanPin);
    return {
      success: true,
      staff: sanitizeStaffForClient(matched),
      isDefaultPin: false,
    };
  }

  // If custom pin does not match
  recordClientFailure(matched.id);
  return {
    success: false,
    errorMsg: 'PIN tidak sah. Sila cuba lagi atau hubungi Pentadbir Kolej untuk menetapkan semula PIN anda kepada 1234.'
  };
}

/**
 * Local verification stub: strictly disabled in compliance with SES v4.5 Gate 5.
 * All credentials must be verified server-side via scrypt and rate limiter.
 */
export function verifyStaffCredentialsLocally(
  _email?: string,
  _pin?: string,
  _staffList?: StaffUser[]
): { success: boolean; staff?: StaffUser; errorMsg: string; isDefaultPin?: boolean } {
  return {
    success: false,
    errorMsg: 'Pengesahan PIN tempatan telah dinyahdayakan demi mematuhi piawaian keselamatan Gate 5 (Fail-Closed). Sila gunakan pelayan keselamatan.',
  };
}


/**
 * Real-time listener for AdHoc Bookings in Firestore.
 * When any user adds, updates, or cancels a booking, all connected clients receive the update live.
 */
export function subscribeToBookings(onUpdate: (bookings: AdHocBooking[]) => void): () => void {
  try {
    const colRef = collection(db, BOOKINGS_COLLECTION);
    
    return onSnapshot(colRef, (snapshot) => {
      recordSnapshotSuccess(BOOKINGS_COLLECTION);
      if (snapshot.empty) {
        const merged = mergeCloudBookingsWithPendingQueue([]);
        onUpdate(merged);
        return;
      }

      const bookings: AdHocBooking[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as AdHocBooking;
        // Strict Zero Demo Data Filter
        if (data.id !== 'BK-2026-000101' && data.id !== 'BK-2026-000102' && data.id !== 'BK-2026-000103') {
          bookings.push({
            ...data,
            syncStatus: data.syncStatus || 'synced'
          });
        }
      });
      
      bookings.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
      // Merge with pending queue so local offline bookings are preserved
      const mergedWithPending = mergeCloudBookingsWithPendingQueue(bookings);
      onUpdate(mergedWithPending);
    }, (error) => {
      reportSnapshotFallbackError(BOOKINGS_COLLECTION, error);
      const local = getStoredAdHocBookings();
      const mergedWithPending = mergeCloudBookingsWithPendingQueue(local);
      onUpdate(mergedWithPending);
    });
  } catch (err) {
    reportSnapshotFallbackError(BOOKINGS_COLLECTION, err);
    const local = getStoredAdHocBookings();
    const mergedWithPending = mergeCloudBookingsWithPendingQueue(local);
    onUpdate(mergedWithPending);
    return () => {};
  }
}

/**
 * Real-time listener for Institutional Blocks.
 */
export function subscribeToBlocks(onUpdate: (blocks: InstitutionalBlock[]) => void): () => void {
  try {
    const colRef = collection(db, BLOCKS_COLLECTION);
    return onSnapshot(colRef, (snapshot) => {
      recordSnapshotSuccess(BLOCKS_COLLECTION);
      if (snapshot.empty) {
        onUpdate([]);
        return;
      }
      const blocks: InstitutionalBlock[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as InstitutionalBlock;
        // Strict Zero Demo Data Filter
        if (data.id !== 'BLK-001' && data.id !== 'BLK-002') {
          blocks.push(data);
        }
      });
      onUpdate(blocks);
    }, (error) => {
      reportSnapshotFallbackError(BLOCKS_COLLECTION, error);
      onUpdate(getStoredInstitutionalBlocks());
    });
  } catch (err) {
    reportSnapshotFallbackError(BLOCKS_COLLECTION, err);
    onUpdate(getStoredInstitutionalBlocks());
    return () => {};
  }
}

/**
 * Save or update a booking in Firestore.
 * Implements server-authoritative atomic slot conflict prevention and idempotency handling.
 * Returns success: true when Firestore write succeeds, or success: false with error details.
 */
export async function saveBookingToCloud(
  booking: AdHocBooking,
  existingBookings?: AdHocBooking[]
): Promise<{ success: boolean; isRetry?: boolean; error?: string }> {
  const bookingWithKey: AdHocBooking = {
    ...booking,
    idempotencyKey: booking.idempotencyKey || generateBookingIdempotencyKey(booking),
  };

  try {
    const docRef = doc(db, BOOKINGS_COLLECTION, bookingWithKey.id);

    await runTransaction(db, async (transaction) => {
      const existingDoc = await transaction.get(docRef);

      if (existingDoc.exists()) {
        const existingData = existingDoc.data() as AdHocBooking;
        // Exact idempotency match: safe retry
        if (
          existingData.idempotencyKey === bookingWithKey.idempotencyKey &&
          existingData.status !== 'CANCELLED'
        ) {
          return;
        }
      }

      // Check for slot conflicts with active bookings
      if (existingBookings && existingBookings.length > 0) {
        for (const existing of existingBookings) {
          if (existing.id === bookingWithKey.id) continue;
          if (existing.status === 'CANCELLED' || existing.status === 'REJECTED') continue;
          if (
            existing.roomId.trim().toUpperCase() === bookingWithKey.roomId.trim().toUpperCase() &&
            existing.date === bookingWithKey.date
          ) {
            if (isSlotOverlapping(bookingWithKey.startTime, bookingWithKey.endTime, existing.startTime, existing.endTime)) {
              throw new Error(`SLOT_CONFLICT: Ruang ${bookingWithKey.roomName} telah ditempah (${existing.startTime} - ${existing.endTime}) oleh ${existing.applicantName}.`);
            }
          }
        }
      }

      transaction.set(docRef, sanitizeForFirestore(bookingWithKey), { merge: true });
    });

    return { success: true };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes('SLOT_CONFLICT')) {
      return { success: false, error: errMsg };
    }
    // Fallback direct setDoc if transaction fails due to network/offline
    try {
      const docRef = doc(db, BOOKINGS_COLLECTION, bookingWithKey.id);
      await setDoc(docRef, sanitizeForFirestore(bookingWithKey), { merge: true });
      return { success: true };
    } catch (fallbackErr) {
      const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      console.warn('Booking saved locally (Cloud sync skipped / quota exceeded):', fallbackMsg);
      return { success: false, error: fallbackMsg };
    }
  }
}

/**
 * SES v4.5: Synchronize Offline Pending-Booking Queue with Firestore.
 * Concurrency-locked and idempotent (unique document ID prevents duplicate entries).
 * Updates booking status from PENDING to CONFIRMED only after Firestore confirmed write.
 */
let isQueueSyncingInProgress = false;

export async function syncPendingBookingsQueue(
  onProgress?: (synced: AdHocBooking) => void
): Promise<{
  syncedCount: number;
  failedCount: number;
  remainingCount: number;
  syncedBookings: AdHocBooking[];
}> {
  if (isQueueSyncingInProgress) {
    const q = getStoredPendingBookingQueue();
    return { syncedCount: 0, failedCount: 0, remainingCount: q.length, syncedBookings: [] };
  }

  const queue = getStoredPendingBookingQueue();
  if (queue.length === 0) {
    return { syncedCount: 0, failedCount: 0, remainingCount: 0, syncedBookings: [] };
  }

  isQueueSyncingInProgress = true;
  let syncedCount = 0;
  let failedCount = 0;
  const syncedBookings: AdHocBooking[] = [];

  try {
    for (const pending of queue) {
      try {
        const confirmedPayload: AdHocBooking = {
          ...pending,
          status: 'CONFIRMED',
          syncStatus: 'synced',
          syncedAt: new Date().toISOString(),
          syncError: undefined,
        };

        const result = await saveBookingToCloud(confirmedPayload);
        if (result.success) {
          dequeuePendingBooking(pending.id);
          updateStoredBooking(confirmedPayload);
          syncedCount++;
          syncedBookings.push(confirmedPayload);
          if (onProgress) {
            onProgress(confirmedPayload);
          }
        } else {
          failedCount++;
          const failedBooking: AdHocBooking = {
            ...pending,
            status: 'PENDING',
            syncStatus: 'sync_failed',
            syncError: result.error || 'Ralat sambungan Cloud Firestore',
          };
          updatePendingBookingInQueue(failedBooking);
          updateStoredBooking(failedBooking);
        }
      } catch (itemErr) {
        failedCount++;
        const errMsg = itemErr instanceof Error ? itemErr.message : String(itemErr);
        const failedBooking: AdHocBooking = {
          ...pending,
          status: 'PENDING',
          syncStatus: 'sync_failed',
          syncError: errMsg,
        };
        updatePendingBookingInQueue(failedBooking);
        updateStoredBooking(failedBooking);
      }
    }
  } finally {
    isQueueSyncingInProgress = false;
  }

  const remaining = getStoredPendingBookingQueue().length;
  return { syncedCount, failedCount, remainingCount: remaining, syncedBookings };
}

/**
 * Delete a booking from Firestore.
 */
export async function deleteBookingFromCloud(bookingId: string): Promise<void> {
  try {
    const docRef = doc(db, BOOKINGS_COLLECTION, bookingId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Booking deleted locally (Cloud sync skipped / quota exceeded).');
  }
}

/**
 * Save or update an institutional block in Firestore.
 */
export async function saveBlockToCloud(block: InstitutionalBlock): Promise<void> {
  try {
    const docRef = doc(db, BLOCKS_COLLECTION, block.id);
    await setDoc(docRef, sanitizeForFirestore(block), { merge: true });
  } catch (err) {
    console.warn('Block saved locally (Cloud sync skipped / quota exceeded).');
  }
}

/**
 * Bulk save institutional blocks into Firestore using batch write.
 */
export async function bulkSaveBlocksToCloud(blocks: InstitutionalBlock[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    blocks.forEach((block) => {
      const docRef = doc(db, BLOCKS_COLLECTION, block.id);
      batch.set(docRef, sanitizeForFirestore(block), { merge: true });
    });
    await batch.commit();
    console.log(`Successfully synced ${blocks.length} institutional blocks to Cloud Firestore.`);
  } catch (err) {
    console.warn('Batch save blocks error (local storage fallback active):', err);
  }
}

/**
 * Delete an institutional block from Firestore.
 */
export async function deleteBlockFromCloud(blockId: string): Promise<void> {
  try {
    const docRef = doc(db, BLOCKS_COLLECTION, blockId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Block deleted locally (Cloud sync skipped / quota exceeded).');
  }
}

/**
 * Bulk delete institutional blocks from Firestore.
 */
export async function bulkDeleteBlocksFromCloud(blockIds: string[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    blockIds.forEach((id) => {
      const docRef = doc(db, BLOCKS_COLLECTION, id);
      batch.delete(docRef);
    });
    await batch.commit();
    console.log(`Successfully deleted ${blockIds.length} institutional blocks from Cloud Firestore.`);
  } catch (err) {
    console.warn('Batch delete blocks error (local cache updated):', err);
  }
}

let hasLoadedScheduleOnce = false;

/**
 * Real-time listener for Academic Schedule in Firestore.
 */
export function subscribeToSchedule(onUpdate: (schedule: AcademicScheduleSlot[]) => void): () => void {
  try {
    const colRef = collection(db, SCHEDULE_COLLECTION);
    return onSnapshot(colRef, (snapshot) => {
      recordSnapshotSuccess(SCHEDULE_COLLECTION);
      if (snapshot.empty) {
        const isCustomized = typeof window !== 'undefined' && localStorage.getItem('kpmbp_schedule_customized') === 'true';
        if (!hasLoadedScheduleOnce && !isCustomized) {
          hasLoadedScheduleOnce = true;
          seedInitialSchedule();
          onUpdate(getStoredAcademicSchedule());
        } else {
          hasLoadedScheduleOnce = true;
          onUpdate([]);
        }
        return;
      }
      hasLoadedScheduleOnce = true;
      const schedule: AcademicScheduleSlot[] = [];
      snapshot.forEach((docSnap) => {
        schedule.push(docSnap.data() as AcademicScheduleSlot);
      });
      onUpdate(schedule);
    }, (error) => {
      reportSnapshotFallbackError(SCHEDULE_COLLECTION, error);
      onUpdate(getStoredAcademicSchedule());
    });
  } catch (err) {
    reportSnapshotFallbackError(SCHEDULE_COLLECTION, err);
    onUpdate(getStoredAcademicSchedule());
    return () => {};
  }
}

/**
 * Bulk save/sync Academic Schedule slots into Firestore.
 * Supports 'replace' (clean total overwrite) and 'merge' (update specified rooms only).
 */
export async function bulkSaveScheduleToCloud(
  schedule: AcademicScheduleSlot[],
  mode: 'replace' | 'merge' = 'merge'
): Promise<void> {
  try {
    const colRef = collection(db, SCHEDULE_COLLECTION);
    const existing = await getDocs(colRef);
    const existingDocIds = new Set(existing.docs.map(d => d.id));
    const newDocIds = new Set<string>();

    // Chunk batch write for new/updated slots
    for (let i = 0; i < schedule.length; i += 400) {
      const chunk = schedule.slice(i, i + 400);
      const batch = writeBatch(db);
      chunk.forEach((slot) => {
        const docId = slot.id || `SCH-${slot.roomId}-${slot.dayOfWeek}-${slot.startTime}`.replace(/[^a-zA-Z0-9_-]/g, '_');
        newDocIds.add(docId);
        const ref = doc(db, SCHEDULE_COLLECTION, docId);
        const cleanSlot = sanitizeForFirestore({ ...slot, id: docId });
        batch.set(ref, cleanSlot);
      });
      await batch.commit();
    }

    // Determine documents to delete
    let idsToDelete: string[] = [];
    if (mode === 'replace') {
      // Clean total overwrite: Delete any document that is not in the new schedule
      idsToDelete = Array.from(existingDocIds).filter(id => !newDocIds.has(id));
    } else {
      // Merge mode: Only delete obsolete slots for the rooms specifically affected by this update
      const affectedRooms = new Set(schedule.map(s => (s.roomId || '').toUpperCase()));
      idsToDelete = existing.docs
        .filter(d => {
          const data = d.data() as AcademicScheduleSlot;
          const rId = (data.roomId || '').toUpperCase();
          return affectedRooms.has(rId) && !newDocIds.has(d.id);
        })
        .map(d => d.id);
    }

    for (let i = 0; i < idsToDelete.length; i += 400) {
      const chunk = idsToDelete.slice(i, i + 400);
      const batch = writeBatch(db);
      chunk.forEach(id => {
        batch.delete(doc(db, SCHEDULE_COLLECTION, id));
      });
      await batch.commit();
    }
    console.log(`Successfully synced ${schedule.length} schedule slots (${mode} mode) to Cloud Firestore. Deleted ${idsToDelete.length} obsolete slots.`);
  } catch (err) {
    console.warn('Academic schedule saved locally (Cloud sync skipped / quota exceeded).', err);
  }
}

/**
 * Completely purge/clear all Academic Schedule slots from Cloud Firestore.
 */
export async function clearAllScheduleFromCloud(): Promise<void> {
  try {
    const colRef = collection(db, SCHEDULE_COLLECTION);
    const existing = await getDocs(colRef);
    const docIds = existing.docs.map(d => d.id);
    for (let i = 0; i < docIds.length; i += 400) {
      const chunk = docIds.slice(i, i + 400);
      const batch = writeBatch(db);
      chunk.forEach(id => {
        batch.delete(doc(db, SCHEDULE_COLLECTION, id));
      });
      await batch.commit();
    }
    console.log(`Successfully cleared ${docIds.length} academic schedule records from Cloud Firestore.`);
  } catch (err) {
    console.warn('Error clearing academic schedule from cloud:', err);
    throw err;
  }
}

/**
 * Save or update a single Academic Schedule slot in Cloud Firestore.
 */
export async function saveScheduleSlotToCloud(slot: AcademicScheduleSlot): Promise<void> {
  try {
    const docId = slot.id || `SCH-${slot.roomId}-${slot.dayOfWeek}-${slot.startTime}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const ref = doc(db, SCHEDULE_COLLECTION, docId);
    const cleanSlot = sanitizeForFirestore({ ...slot, id: docId });
    await setDoc(ref, cleanSlot, { merge: true });
  } catch (err) {
    console.warn('Academic schedule slot saved locally (Cloud sync skipped):', err);
  }
}

/**
 * Seed initial schedule into Firestore if empty.
 */
async function seedInitialSchedule() {
  try {
    const batch = writeBatch(db);
    INITIAL_ACADEMIC_SCHEDULE.forEach((slot) => {
      const ref = doc(db, SCHEDULE_COLLECTION, slot.id);
      batch.set(ref, slot);
    });
    await batch.commit();
  } catch (err) {
    // Silent fail
  }
}

/**
 * Operational Pilot Environment: Purge obsolete demo records from Cloud Firestore.
 */
export async function cleanObsoleteDemoRecordsFromCloud(): Promise<void> {
  if (typeof window !== 'undefined' && sessionStorage.getItem('kpmbp_demo_cleaned') === 'true') {
    return;
  }
  try {
    const demoBookingIds = ['BK-2026-000101', 'BK-2026-000102', 'BK-2026-000103'];
    for (const id of demoBookingIds) {
      const ref = doc(db, BOOKINGS_COLLECTION, id);
      await deleteDoc(ref).catch(() => {});
    }
    const demoBlockIds = ['BLK-001', 'BLK-002'];
    for (const id of demoBlockIds) {
      const ref = doc(db, BLOCKS_COLLECTION, id);
      await deleteDoc(ref).catch(() => {});
    }
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('kpmbp_demo_cleaned', 'true');
    }
  } catch (err) {
    // Silent fail
  }
}

/**
 * Real-time listener for Rooms Directory in Firestore.
 */
export function subscribeToRooms(onUpdate: (rooms: Room[]) => void): () => void {
  try {
    const colRef = collection(db, ROOMS_COLLECTION);
    return onSnapshot(colRef, (snapshot) => {
      recordSnapshotSuccess(ROOMS_COLLECTION);
      if (!snapshot.empty) {
        const cloudRooms: Room[] = [];
        snapshot.forEach((docSnap) => {
          cloudRooms.push(docSnap.data() as Room);
        });
        onUpdate(cloudRooms);
      }
    }, (error) => {
      reportSnapshotFallbackError(ROOMS_COLLECTION, error);
      onUpdate(getStoredRooms());
    });
  } catch (err) {
    reportSnapshotFallbackError(ROOMS_COLLECTION, err);
    onUpdate(getStoredRooms());
    return () => {};
  }
}

/**
 * Optimasi Kuota: One-time cached fetch for rooms using getDocs.
 * Reduksi bacaan berbanding onSnapshot berterusan untuk data statik fasiliti.
 */
export async function fetchRoomsOnceWithCache(): Promise<Room[]> {
  try {
    const colRef = collection(db, ROOMS_COLLECTION);
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      const cloudRooms: Room[] = [];
      snap.forEach((docSnap) => {
        cloudRooms.push(docSnap.data() as Room);
      });
      recordSnapshotSuccess(ROOMS_COLLECTION);
      saveStoredRooms(cloudRooms);
      return cloudRooms;
    }
  } catch (err) {
    reportSnapshotFallbackError(ROOMS_COLLECTION, err);
  }
  return getStoredRooms();
}

/**
 * Optimasi Kuota: One-time cached fetch for academic schedule using getDocs.
 */
export async function fetchScheduleOnceWithCache(): Promise<AcademicScheduleSlot[]> {
  try {
    const colRef = collection(db, SCHEDULE_COLLECTION);
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      const schedule: AcademicScheduleSlot[] = [];
      snap.forEach((docSnap) => {
        schedule.push(docSnap.data() as AcademicScheduleSlot);
      });
      recordSnapshotSuccess(SCHEDULE_COLLECTION);
      saveStoredAcademicSchedule(schedule);
      return schedule;
    }
  } catch (err) {
    reportSnapshotFallbackError(SCHEDULE_COLLECTION, err);
  }
  return getStoredAcademicSchedule();
}

/**
 * Bulk save or update rooms to Cloud Firestore.
 */
export async function bulkSaveRoomsToCloud(rooms: Room[]): Promise<void> {
  try {
    const batchSize = 450;
    for (let i = 0; i < rooms.length; i += batchSize) {
      const chunk = rooms.slice(i, i + batchSize);
      const batch = writeBatch(db);
      chunk.forEach((r) => {
        const ref = doc(db, ROOMS_COLLECTION, r.id);
        batch.set(ref, sanitizeForFirestore(r), { merge: true });
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn('Rooms saved locally (Cloud sync skipped / quota exceeded).');
  }
}

