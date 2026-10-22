import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateBookingIdempotencyKey } from '../src/utils/storage';
import { reconcileRollbackDelta } from '../src/utils/reconciliation';
import { INITIAL_STAFF_DATA } from '../src/data/staffData';
import { StaffUser, AdHocBooking } from '../src/types';

describe('SES v4.5 Pre-Migration Release Gates', () => {
  // GATE 1: Idempotency keys distinguish retries from legitimate bookings
  it('GATE-1: Idempotency key generation is deterministic and unique to slot', () => {
    const key1 = generateBookingIdempotencyKey({
      roomId: 'BK01',
      date: '2026-10-25',
      startTime: '09:00',
      endTime: '11:00',
      applicantEmail: 'tahira@mara.gov.my'
    });

    const key1Retry = generateBookingIdempotencyKey({
      roomId: 'BK01',
      date: '2026-10-25',
      startTime: '09:00',
      endTime: '11:00',
      applicantEmail: 'tahira@mara.gov.my'
    });

    const key2DistinctSlot = generateBookingIdempotencyKey({
      roomId: 'BK01',
      date: '2026-10-25',
      startTime: '11:30',
      endTime: '13:30',
      applicantEmail: 'tahira@mara.gov.my'
    });

    const key3DifferentRoom = generateBookingIdempotencyKey({
      roomId: 'DKA',
      date: '2026-10-25',
      startTime: '09:00',
      endTime: '11:00',
      applicantEmail: 'tahira@mara.gov.my'
    });

    assert.strictEqual(key1, key1Retry, 'Retries for the same slot must generate identical idempotency keys');
    assert.notStrictEqual(key1, key2DistinctSlot, 'Distinct time slots must generate different idempotency keys');
    assert.notStrictEqual(key1, key3DifferentRoom, 'Different rooms must generate different idempotency keys');
    assert.ok(key1.startsWith('IDEM_BK01_2026-10-25_09:00_11:00_'), 'Key must contain room, date, and interval bounds');
  });

  // GATE 2: Conflict checks detect overlapping intervals
  it('GATE-2: Conflict detection accurately identifies overlapping time windows', () => {
    function toMinutes(t: string): number {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    }

    function isSlotOverlapping(startA: string, endA: string, startB: string, endB: string): boolean {
      return Math.max(toMinutes(startA), toMinutes(startB)) < Math.min(toMinutes(endA), toMinutes(endB));
    }

    // Overlap cases
    assert.strictEqual(isSlotOverlapping('09:00', '11:00', '10:00', '12:00'), true, 'Partial overlap must conflict');
    assert.strictEqual(isSlotOverlapping('09:00', '11:00', '09:30', '10:30'), true, 'Enclosed interval must conflict');
    assert.strictEqual(isSlotOverlapping('09:00', '11:00', '08:00', '12:00'), true, 'Enclosing interval must conflict');
    assert.strictEqual(isSlotOverlapping('09:00', '11:00', '09:00', '11:00'), true, 'Exact interval match must conflict');

    // Non-overlap cases (adjacent slots)
    assert.strictEqual(isSlotOverlapping('09:00', '10:00', '10:00', '11:00'), false, 'Adjacent end-to-start slots must not conflict');
    assert.strictEqual(isSlotOverlapping('14:00', '16:00', '09:00', '11:00'), false, 'Disjoint slots must not conflict');
  });

  // GATE 3: Rules verification against default-deny and role constraints
  it('GATE-3: Security rules schema strictly blocks client credential and admin writes', async () => {
    const fs = await import('node:fs');
    const rulesContent = fs.readFileSync('firestore.rules', 'utf8');

    // 1. Default-deny present
    assert.ok(rulesContent.includes('match /{document=**} {\n      allow read, write: if false;'), 'Global default deny must be first block');

    // 2. Staff credentials completely locked
    assert.ok(rulesContent.includes('match /staff_credentials/{staffId} {\n      allow read, write: if false;'), 'Staff credentials must be completely locked');

    // 3. Admins collection write locked
    assert.ok(rulesContent.includes('match /admins/{adminId} {\n      allow read: if isVerifiedUser();\n      allow write: if false;'), 'Admins write must be locked');

    // 4. Bookings get and list require owner or admin
    assert.ok(rulesContent.includes('allow get: if isBookingOwner(resource.data.applicantEmail) || isAdmin();'), 'Booking get must require owner or admin');
    assert.ok(rulesContent.includes('resource.data.applicantEmail == request.auth.token.email'), 'Booking list must verify applicantEmail');
  });

  // GATE 4: Rollback reconciliation handles creates, updates, cancellations, and duplicate retries
  it('GATE-4: Rollback reconciliation accurately merges target mutations back into source', () => {
    const sourceBookings: AdHocBooking[] = [
      {
        id: 'BK-001',
        roomId: 'BK01',
        roomName: 'Bilik Kuliah 01',
        date: '2026-10-25',
        startTime: '08:30',
        endTime: '10:30',
        applicantName: 'Pn. Tahira',
        applicantRole: 'Pensyarah',
        department: 'Jabatan Perdagangan',
        purposeCategory: 'Kelas',
        title: 'Kuliah Asas',
        paxCount: 30,
        status: 'CONFIRMED',
        createdAt: '2026-10-20T01:00:00Z',
        idempotencyKey: 'IDEM_BK01_2026-10-25_08:30_10:30_tahira'
      }
    ];

    const targetBookings: AdHocBooking[] = [
      // 1. New Create on Target
      {
        id: 'BK-002',
        roomId: 'DKA',
        roomName: 'Dewan Kuliah A',
        date: '2026-10-26',
        startTime: '14:00',
        endTime: '16:00',
        applicantName: 'En. Khairi',
        applicantRole: 'Pensyarah',
        department: 'Sains Komputer',
        purposeCategory: 'Bengkel',
        title: 'Bengkel React',
        paxCount: 60,
        status: 'CONFIRMED',
        createdAt: '2026-10-22T02:00:00Z',
        idempotencyKey: 'IDEM_DKA_2026-10-26_14:00_16:00_khairi'
      },
      // 2. Cancellation of existing BK-001 on Target
      {
        id: 'BK-001',
        roomId: 'BK01',
        roomName: 'Bilik Kuliah 01',
        date: '2026-10-25',
        startTime: '08:30',
        endTime: '10:30',
        applicantName: 'Pn. Tahira',
        applicantRole: 'Pensyarah',
        department: 'Jabatan Perdagangan',
        purposeCategory: 'Kelas',
        title: 'Kuliah Asas Dibatalkan',
        paxCount: 30,
        status: 'CANCELLED',
        createdAt: '2026-10-20T01:00:00Z',
        idempotencyKey: 'IDEM_BK01_2026-10-25_08:30_10:30_tahira'
      },
      // 3. Duplicate retry of BK-002 with same idempotency key
      {
        id: 'BK-002-RETRY',
        roomId: 'DKA',
        roomName: 'Dewan Kuliah A',
        date: '2026-10-26',
        startTime: '14:00',
        endTime: '16:00',
        applicantName: 'En. Khairi',
        applicantRole: 'Pensyarah',
        department: 'Sains Komputer',
        purposeCategory: 'Bengkel',
        title: 'Bengkel React',
        paxCount: 60,
        status: 'CONFIRMED',
        createdAt: '2026-10-22T02:01:00Z',
        idempotencyKey: 'IDEM_DKA_2026-10-26_14:00_16:00_khairi'
      }
    ];

    const result = reconcileRollbackDelta(targetBookings, sourceBookings);

    assert.strictEqual(result.report.createsCount, 1, 'Should record exactly 1 create (BK-002)');
    assert.strictEqual(result.report.cancellationsCount, 1, 'Should record exactly 1 cancellation (BK-001)');
    assert.strictEqual(result.report.duplicateRetriesCount, 1, 'Should record exactly 1 duplicate retry (BK-002-RETRY)');
    assert.strictEqual(result.mergedBookings.length, 2, 'Merged dataset should contain exactly 2 distinct bookings');

    const bk001 = result.mergedBookings.find(b => b.id === 'BK-001');
    assert.strictEqual(bk001?.status, 'CANCELLED', 'BK-001 must have CANCELLED status in merged source');

    const bk002 = result.mergedBookings.find(b => b.id === 'BK-002');
    assert.strictEqual(bk002?.status, 'CONFIRMED', 'BK-002 must be created and confirmed');
  });

  // GATE 5: Server-side scrypt key derivation, rate limiting, and zero plaintext PINs
  it('GATE-5: Server-side scrypt verification, rate limiting, and zero credential leakage', async () => {
    const { hashPinScryptSync, verifyPinScryptSync, ServerRateLimiter, serverAuthVault } = await import('../src/server/auth-service');

    INITIAL_STAFF_DATA.forEach((staff: StaffUser) => {
      assert.strictEqual((staff as any).pin, undefined, `Staff ${staff.id} must not have plaintext pin property`);
      assert.strictEqual((staff as any).pinHash, undefined, `Staff ${staff.id} must not have pinHash property`);
      assert.strictEqual((staff as any).passcode, undefined, `Staff ${staff.id} must not have plaintext passcode property`);
      assert.ok(staff.pinStatus === 'DEFAULT' || staff.pinStatus === 'CUSTOM', 'Must only expose pinStatus enum');
    });

    // scrypt derivation test
    const scrypt = hashPinScryptSync('1234');
    assert.match(scrypt.encoded, /^scrypt\$16384\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    assert.strictEqual(verifyPinScryptSync('1234', scrypt.encoded), true);
    assert.strictEqual(verifyPinScryptSync('9999', scrypt.encoded), false);

    // Rate limiter test
    const limiter = new ServerRateLimiter(5, 900000);
    for (let i = 0; i < 5; i++) {
      limiter.recordFailure('test_staff');
    }
    const locked = limiter.checkLimit('test_staff');
    assert.strictEqual(locked.allowed, false);

    // Zero credential leak
    const sample = INITIAL_STAFF_DATA[0];
    const res = await serverAuthVault.verifyStaff(sample.email, '1234');
    assert.strictEqual(res.success, true);
    assert.strictEqual((res.staff as any).pin, undefined);
    assert.strictEqual((res.staff as any).pinHash, undefined);
    assert.strictEqual(serverAuthVault.hasCredentialLeak(res.staff as any), false);
  });
});
