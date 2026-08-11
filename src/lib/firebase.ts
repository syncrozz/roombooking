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
import { AdHocBooking, Room, AcademicScheduleSlot, InstitutionalBlock } from '../types';
import { INITIAL_ROOMS, INITIAL_ACADEMIC_SCHEDULE, INITIAL_ADHOC_BOOKINGS, INITIAL_INSTITUTIONAL_BLOCKS } from '../data/initialData';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

const BOOKINGS_COLLECTION = 'bookings';
const ROOMS_COLLECTION = 'rooms';
const SCHEDULE_COLLECTION = 'schedule';
const BLOCKS_COLLECTION = 'blocks';

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
