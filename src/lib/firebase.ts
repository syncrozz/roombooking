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
  getStoredRooms,
  getStoredStaffUsers
} from '../utils/storage';
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
    
    // Set a race timeout of 6 seconds so slow connections don't block
    const testPromise = (async () => {
      await setDoc(testDocRef, { 
        lastPing: new Date().toISOString(),
        source: 'BookBK-KPMBP-App',
        database: firebaseConfig.firestoreDatabaseId 
      });
      await getDocFromServer(testDocRef);
    })();

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Masa tamat sambungan ke Cloud Firestore (6s). Sistem beroperasi dalam Mod Tempatan / Luar Talian.')), 6000)
    );

    await Promise.race([testPromise, timeoutPromise]);

    const latencyMs = Date.now() - start;
    return {
      connected: true,
      databaseId: firebaseConfig.firestoreDatabaseId,
      latencyMs
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return {
      connected: false,
      databaseId: firebaseConfig.firestoreDatabaseId,
      error: errMsg
    };
  }
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
      pin: '1234',
      pinStatus: 'DEFAULT'
    };
  }

  // Determine single authoritative credential 'pin'
  // Rule: Since all users have not logged in for the first time yet, all default to '1234' with 'DEFAULT' status.
  // A PIN is only treated as CUSTOM if explicitly changed by user (has valid pinChangedAt and is not 1234).
  const rawPin = typeof st.pin === 'string' ? st.pin.trim() : (st.pin ? String(st.pin).trim() : '');

  let effectivePin = '1234';
  let pinStatus: 'DEFAULT' | 'CUSTOM' = 'DEFAULT';

  if (st.pinStatus === 'CUSTOM' && rawPin && /^\d{4}$/.test(rawPin) && rawPin !== '1234' && st.pinChangedAt) {
    effectivePin = rawPin;
    pinStatus = 'CUSTOM';
  } else {
    effectivePin = '1234';
    pinStatus = 'DEFAULT';
  }

  const user: StaffUser = {
    id: st.id || '',
    department: st.department || '',
    name: st.name || '',
    role: st.role || '',
    phone: st.phone || '',
    email: (st.email || '').trim().toLowerCase(),
    pin: effectivePin,
    pinStatus
  };

  if (pinStatus === 'CUSTOM' && st.pinChangedAt) {
    user.pinChangedAt = st.pinChangedAt;
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
 */
export function subscribeToStaffUsers(onUpdate: (staffList: StaffUser[]) => void): () => void {
  try {
    const colRef = collection(db, STAFF_COLLECTION);
    return onSnapshot(colRef, (snapshot) => {
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
            const isExistingCustom = existing.pinStatus === 'CUSTOM' && existing.pin && existing.pin !== '1234' && !!existing.pinChangedAt;
            const isStaffCustom = staff.pinStatus === 'CUSTOM' && staff.pin && staff.pin !== '1234' && !!staff.pinChangedAt;
            const preservedPin = isExistingCustom ? existing.pin : (isStaffCustom ? staff.pin : '1234');
            const preservedStatus = (isExistingCustom || isStaffCustom) ? 'CUSTOM' : 'DEFAULT';
            const preservedChangedAt = isExistingCustom ? existing.pinChangedAt : (isStaffCustom ? staff.pinChangedAt : undefined);
            staffMap.set(key, {
              ...(preferNew ? staff : existing),
              pin: preservedPin,
              pinStatus: preservedStatus,
              pinChangedAt: preservedChangedAt
            });
          }
        }
      });
      onUpdate(Array.from(staffMap.values()));
    }, (error) => {
      console.warn('Firestore offline / local fallback mode for staff users.');
      const localStaff = getStoredStaffUsers();
      if (localStaff && localStaff.length > 0) {
        onUpdate(localStaff);
      }
    });
  } catch (err) {
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
          pin: '1234',
          pinStatus: 'DEFAULT' as const,
          pinChangedAt: undefined
        };
      }

      // If id exists in both old and new data, keep existing pin, pinStatus and pinChangedAt
      if (existing) {
        const isCustom = existing.pinStatus === 'CUSTOM' && existing.pin && existing.pin !== '1234' && !!existing.pinChangedAt;
        return {
          ...normalized,
          id: docId,
          pin: isCustom ? existing.pin : (normalized.pin || '1234'),
          pinStatus: isCustom ? 'CUSTOM' as const : 'DEFAULT' as const,
          pinChangedAt: isCustom ? existing.pinChangedAt : undefined
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
 * Update Staff Owner PIN in Cloud Firestore.
 */
export async function updateStaffPinInCloud(
  staffId: string,
  newPin: string,
  pinStatus: 'DEFAULT' | 'CUSTOM' = 'CUSTOM'
): Promise<void> {
  try {
    const docRef = doc(db, STAFF_COLLECTION, staffId);
    const pinChangedAt = new Date().toISOString();
    const payload = sanitizeForFirestore({
      pin: newPin,
      pinStatus,
      pinChangedAt
    });
    await setDoc(docRef, payload, { merge: true });
    console.log(`Successfully updated PIN in Cloud Firestore for staff ${staffId}`);
  } catch (err) {
    console.warn('Error updating staff PIN in Cloud Firestore:', err);
    throw err;
  }
}

/**
 * Verification Engine:
 * Validates whether email matches a registered staff member AND PIN matches the 4-digit PIN.
 * Generic error: "Email atau PIN tidak sah."
 * NO last4 phone fallback, NO development 5313 bypass.
 */
export function verifyStaffCredentialsLocally(
  email: string,
  pin: string,
  staffList: StaffUser[] = INITIAL_STAFF_DATA
): { success: boolean; staff?: StaffUser; errorMsg?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPin = pin.trim();

  // Validate format: must be non-empty and exactly 4 digits numeric
  if (!cleanEmail || !cleanPin || !/^\d{4}$/.test(cleanPin)) {
    return { success: false, errorMsg: 'Email atau PIN tidak sah.' };
  }

  // Find staff by email
  const staffRaw = staffList.find(s => s.email.trim().toLowerCase() === cleanEmail);

  if (!staffRaw) {
    return { 
      success: false, 
      errorMsg: 'Email atau PIN tidak sah.' 
    };
  }

  const staff = normalizeStaffUser(staffRaw);

  // Exact PIN comparison
  if (staff.pin === cleanPin) {
    return { success: true, staff };
  } else {
    return { 
      success: false, 
      errorMsg: 'Email atau PIN tidak sah.' 
    };
  }
}


/**
 * Real-time listener for AdHoc Bookings in Firestore.
 * When any user adds, updates, or cancels a booking, all connected clients receive the update live.
 */
export function subscribeToBookings(onUpdate: (bookings: AdHocBooking[]) => void): () => void {
  try {
    const colRef = collection(db, BOOKINGS_COLLECTION);
    
    return onSnapshot(colRef, (snapshot) => {
      if (snapshot.empty) {
        onUpdate([]);
        return;
      }

      const bookings: AdHocBooking[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as AdHocBooking;
        // Strict Zero Demo Data Filter
        if (data.id !== 'BK-2026-000101' && data.id !== 'BK-2026-000102' && data.id !== 'BK-2026-000103') {
          bookings.push(data);
        }
      });
      
      bookings.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
      onUpdate(bookings);
    }, (error) => {
      // Graceful fallback to local storage if Firestore is offline or quota exceeded
      console.warn('Firestore offline / local storage fallback mode for bookings.');
      onUpdate(getStoredAdHocBookings());
    });
  } catch (err) {
    onUpdate(getStoredAdHocBookings());
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
      // Graceful fallback to local storage if Firestore is offline or quota exceeded
      console.warn('Firestore offline / local storage fallback mode for institutional blocks.');
      onUpdate(getStoredInstitutionalBlocks());
    });
  } catch (err) {
    onUpdate(getStoredInstitutionalBlocks());
    return () => {};
  }
}

/**
 * Save or update a booking in Firestore.
 */
export async function saveBookingToCloud(booking: AdHocBooking): Promise<void> {
  try {
    const docRef = doc(db, BOOKINGS_COLLECTION, booking.id);
    await setDoc(docRef, sanitizeForFirestore(booking), { merge: true });
  } catch (err) {
    console.warn('Booking saved locally (Cloud sync skipped / quota exceeded).');
  }
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

let hasLoadedScheduleOnce = false;

/**
 * Real-time listener for Academic Schedule in Firestore.
 */
export function subscribeToSchedule(onUpdate: (schedule: AcademicScheduleSlot[]) => void): () => void {
  try {
    const colRef = collection(db, SCHEDULE_COLLECTION);
    return onSnapshot(colRef, (snapshot) => {
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
      // Graceful fallback to local storage if Firestore is offline or quota exceeded
      console.warn('Firestore offline / local storage fallback mode for academic schedule.');
      onUpdate(getStoredAcademicSchedule());
    });
  } catch (err) {
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
      if (!snapshot.empty) {
        const cloudRooms: Room[] = [];
        snapshot.forEach((docSnap) => {
          cloudRooms.push(docSnap.data() as Room);
        });
        onUpdate(cloudRooms);
      }
    }, (error) => {
      console.warn('Firestore offline / local storage fallback mode for rooms.');
      onUpdate(getStoredRooms());
    });
  } catch (err) {
    onUpdate(getStoredRooms());
    return () => {};
  }
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

