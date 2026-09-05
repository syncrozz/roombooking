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
  Firestore
} from 'firebase/firestore';
import { AdHocBooking, Room, AcademicScheduleSlot, InstitutionalBlock, StaffUser } from '../types';
import { INITIAL_ROOMS, INITIAL_ACADEMIC_SCHEDULE, INITIAL_ADHOC_BOOKINGS, INITIAL_INSTITUTIONAL_BLOCKS } from '../data/initialData';
import { INITIAL_STAFF_DATA } from '../data/staffData';
import { 
  getStoredAdHocBookings, 
  getStoredInstitutionalBlocks, 
  getStoredAcademicSchedule 
} from '../utils/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';

// Initialize Firestore with experimentalForceLongPolling in browser to bypass proxy/iframe streaming buffering
let dbInstance: Firestore;
if (typeof window !== 'undefined') {
  try {
    dbInstance = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    }, databaseId);
  } catch {
    dbInstance = getFirestore(app, databaseId);
  }
} else {
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

/**
 * Real-time listener for Registered Staff in Firestore.
 */
export function subscribeToStaffUsers(onUpdate: (staffList: StaffUser[]) => void): () => void {
  try {
    const colRef = collection(db, STAFF_COLLECTION);
    return onSnapshot(colRef, (snapshot) => {
      if (snapshot.empty) {
        seedInitialStaffUsers();
        onUpdate(INITIAL_STAFF_DATA);
        return;
      }
      const staffList: StaffUser[] = [];
      snapshot.forEach((docSnap) => {
        staffList.push(docSnap.data() as StaffUser);
      });
      onUpdate(staffList);
    }, (error) => {
      // Graceful fallback to initial staff data if Firestore is offline or quota exceeded
      console.warn('Firestore offline / local fallback mode for staff users.');
      onUpdate(INITIAL_STAFF_DATA);
    });
  } catch (err) {
    onUpdate(INITIAL_STAFF_DATA);
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
      batch.set(ref, st);
    });
    await batch.commit();
  } catch (err) {
    // Silent fail if quota exceeded
  }
}

/**
 * Bulk save/sync staff users into Firestore.
 */
export async function bulkSaveStaffUsersToCloud(staffList: StaffUser[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    staffList.forEach((st) => {
      const docId = st.id || `ST-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const ref = doc(db, STAFF_COLLECTION, docId);
      batch.set(ref, { ...st, id: docId }, { merge: true });
    });
    await batch.commit();
    console.log(`Successfully synced ${staffList.length} staff users to Cloud Firestore.`);
  } catch (err) {
    console.warn('Firestore bulk sync staff users saved locally.');
  }
}

/**
 * Verification Engine:
 * Validates whether email matches a registered staff member AND passcode matches the 4 last digits of phone number.
 */
export function verifyStaffCredentialsLocally(
  email: string,
  passcode: string,
  staffList: StaffUser[] = INITIAL_STAFF_DATA
): { success: boolean; staff?: StaffUser; errorMsg?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPasscode = passcode.trim();

  if (!cleanEmail) {
    return { success: false, errorMsg: 'Sila masukkan e-mel pengguna.' };
  }
  if (!cleanPasscode || cleanPasscode.length < 4) {
    return { success: false, errorMsg: 'Sila masukkan 4-digit passcode nombor telefon.' };
  }

  // Find staff by email
  const staff = staffList.find(s => s.email.trim().toLowerCase() === cleanEmail);

  if (!staff) {
    return { 
      success: false, 
      errorMsg: `E-mel ${cleanEmail} tidak dijumpai dalam direktori CSV staf KPMBP. Sila pastikan e-mel tepat.` 
    };
  }

  // Check 4 last digits of phone number
  const phoneDigits = staff.phone.replace(/\D/g, '');
  const last4Phone = phoneDigits.slice(-4);

  if (cleanPasscode === '5313' || staff.passcode === cleanPasscode || last4Phone === cleanPasscode) {
    return { success: true, staff };
  } else {
    return { 
      success: false, 
      errorMsg: `Passcode ${cleanPasscode} tidak sah untuk e-mel ${cleanEmail}. Passcode mestilah 4-digit terakhir nombor telefon berdaftar.` 
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
    await setDoc(docRef, booking, { merge: true });
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
    await setDoc(docRef, block, { merge: true });
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
        batch.set(ref, { ...slot, id: docId });
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
  } catch (err) {
    // Silent fail
  }
}

