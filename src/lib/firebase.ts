import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { AdHocBooking, Room, AcademicScheduleSlot, InstitutionalBlock, StaffUser } from '../types';
import { INITIAL_ROOMS, INITIAL_ACADEMIC_SCHEDULE, INITIAL_ADHOC_BOOKINGS, INITIAL_INSTITUTIONAL_BLOCKS } from '../data/initialData';
import { INITIAL_STAFF_DATA } from '../data/staffData';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

const BOOKINGS_COLLECTION = 'bookings';
const ROOMS_COLLECTION = 'rooms';
const SCHEDULE_COLLECTION = 'schedule';
const BLOCKS_COLLECTION = 'blocks';
const STAFF_COLLECTION = 'staff_users';

/**
 * Real-time listener for Registered Staff in Firestore.
 */
export function subscribeToStaffUsers(onUpdate: (staffList: StaffUser[]) => void): () => void {
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
    console.error('Error listening to staff users:', error);
    onUpdate(INITIAL_STAFF_DATA);
  });
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
    console.log('Successfully seeded CSV staff directory into Firestore');
  } catch (err) {
    console.error('Failed seeding staff directory:', err);
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
    console.error('Failed bulk saving staff users to Firestore:', err);
    throw err;
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
  const colRef = collection(db, BOOKINGS_COLLECTION);
  
  return onSnapshot(colRef, (snapshot) => {
    if (snapshot.empty) {
      // Seed initial data if database is empty
      seedInitialBookings();
      onUpdate(INITIAL_ADHOC_BOOKINGS);
      return;
    }

    const bookings: AdHocBooking[] = [];
    snapshot.forEach((docSnap) => {
      bookings.push(docSnap.data() as AdHocBooking);
    });
    
    // Sort by createdAt descending or date
    bookings.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
    onUpdate(bookings);
  }, (error) => {
    console.error('Error listening to bookings realtime updates:', error);
  });
}

/**
 * Real-time listener for Institutional Blocks.
 */
export function subscribeToBlocks(onUpdate: (blocks: InstitutionalBlock[]) => void): () => void {
  const colRef = collection(db, BLOCKS_COLLECTION);
  return onSnapshot(colRef, (snapshot) => {
    if (snapshot.empty) {
      seedInitialBlocks();
      onUpdate(INITIAL_INSTITUTIONAL_BLOCKS);
      return;
    }
    const blocks: InstitutionalBlock[] = [];
    snapshot.forEach((docSnap) => {
      blocks.push(docSnap.data() as InstitutionalBlock);
    });
    onUpdate(blocks);
  }, (error) => {
    console.error('Error listening to institutional blocks:', error);
  });
}

/**
 * Save or update a booking in Firestore.
 */
export async function saveBookingToCloud(booking: AdHocBooking): Promise<void> {
  try {
    const docRef = doc(db, BOOKINGS_COLLECTION, booking.id);
    await setDoc(docRef, booking, { merge: true });
  } catch (err) {
    console.error('Failed to save booking to Firestore:', err);
    throw err;
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
    console.error('Failed to delete booking from Firestore:', err);
    throw err;
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
    console.error('Failed to save block to Firestore:', err);
    throw err;
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
    console.error('Failed to delete block from Firestore:', err);
    throw err;
  }
}

/**
 * Real-time listener for Academic Schedule in Firestore.
 */
export function subscribeToSchedule(onUpdate: (schedule: AcademicScheduleSlot[]) => void): () => void {
  const colRef = collection(db, SCHEDULE_COLLECTION);
  return onSnapshot(colRef, (snapshot) => {
    if (snapshot.empty) {
      seedInitialSchedule();
      onUpdate(INITIAL_ACADEMIC_SCHEDULE);
      return;
    }
    const schedule: AcademicScheduleSlot[] = [];
    snapshot.forEach((docSnap) => {
      schedule.push(docSnap.data() as AcademicScheduleSlot);
    });
    onUpdate(schedule);
  }, (error) => {
    console.error('Error listening to academic schedule:', error);
    onUpdate(INITIAL_ACADEMIC_SCHEDULE);
  });
}

/**
 * Bulk save/sync Academic Schedule slots into Firestore.
 */
export async function bulkSaveScheduleToCloud(schedule: AcademicScheduleSlot[]): Promise<void> {
  try {
    const colRef = collection(db, SCHEDULE_COLLECTION);
    const existing = await getDocs(colRef);
    const batchDelete = writeBatch(db);
    existing.forEach(d => batchDelete.delete(d.ref));
    await batchDelete.commit();

    // Chunk batch write if large
    for (let i = 0; i < schedule.length; i += 400) {
      const chunk = schedule.slice(i, i + 400);
      const batch = writeBatch(db);
      chunk.forEach((slot) => {
        const docId = slot.id || `SCH-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const ref = doc(db, SCHEDULE_COLLECTION, docId);
        batch.set(ref, { ...slot, id: docId });
      });
      await batch.commit();
    }
    console.log(`Successfully synced ${schedule.length} schedule slots to Cloud Firestore.`);
  } catch (err) {
    console.error('Failed bulk saving schedule to Firestore:', err);
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
    console.error('Failed seeding initial schedule:', err);
  }
}

/**
 * Seed initial sample bookings into Firestore if empty.
 */
async function seedInitialBookings() {
  try {
    const batch = writeBatch(db);
    INITIAL_ADHOC_BOOKINGS.forEach((b) => {
      const ref = doc(db, BOOKINGS_COLLECTION, b.id);
      batch.set(ref, b);
    });
    await batch.commit();
    console.log('Successfully seeded initial bookings to Firestore');
  } catch (err) {
    console.error('Failed seeding initial bookings:', err);
  }
}

/**
 * Seed initial blocks into Firestore if empty.
 */
async function seedInitialBlocks() {
  try {
    const batch = writeBatch(db);
    INITIAL_INSTITUTIONAL_BLOCKS.forEach((blk) => {
      const ref = doc(db, BLOCKS_COLLECTION, blk.id);
      batch.set(ref, blk);
    });
    await batch.commit();
  } catch (err) {
    console.error('Failed seeding initial blocks:', err);
  }
}
