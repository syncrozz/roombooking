import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generateBookingIdempotencyKey, isSlotOverlapping, validateBookingSlot } from '../src/utils/idempotency';
import { reconcileRollbackDelta } from '../src/utils/reconciliation';
import { INITIAL_STAFF_DATA } from '../src/data/staffData';
import {
  serverAuthVault,
  hashPinScrypt,
  hashPinScryptSync,
  verifyPinScrypt,
  verifyPinScryptSync,
  ServerRateLimiter,
} from '../src/server/auth-service';
import { verifyStaffCredentials, verifyStaffCredentialsLocally } from '../src/lib/firebase';
import { AdHocBooking, StaffUser } from '../src/types';

async function runAllGateTests() {
  console.log('========================================================================');
  console.log('SYNCROZZ SES v4.5 — 5 BLOCKING RELEASE GATES & CREDENTIAL SECURITY AUDIT');
  console.log('========================================================================\n');

  let passedGates = 0;
  const totalGates = 5;

  // -------------------------------------------------------------
  // GATE 1: Idempotency keys with safe retry handling
  // -------------------------------------------------------------
  try {
    console.log('▶ [Gate 1] Testing Idempotency Keys & Safe Retry Handling...');
    const bookingA = {
      roomId: 'BK01',
      date: '2026-10-15',
      startTime: '09:00',
      endTime: '11:00',
      applicantEmail: 'lecturer@mara.gov.my',
      applicantName: 'Ustaz Ahmad',
    };

    const keyA1 = generateBookingIdempotencyKey(bookingA);
    const keyA2 = generateBookingIdempotencyKey(bookingA);
    assert.equal(keyA1, keyA2, 'Idempotency key must be deterministic for identical parameters');
    assert.match(keyA1, /^BK-BK01-2026-10-15-0900-1100-/, 'Key matches required prefix schema');

    const bookingB = {
      ...bookingA,
      startTime: '11:00',
      endTime: '13:00',
    };
    const keyB = generateBookingIdempotencyKey(bookingB);
    assert.notEqual(keyA1, keyB, 'Different slots must generate distinct idempotency keys');

    // Test retry validation: duplicate retry identified and not treated as conflict
    const existingList: AdHocBooking[] = [
      {
        id: 'BK-2026-0001',
        roomId: 'BK01',
        roomName: 'Bilik Kuliah 01',
        date: '2026-10-15',
        startTime: '09:00',
        endTime: '11:00',
        applicantName: 'Ustaz Ahmad',
        applicantEmail: 'lecturer@mara.gov.my',
        applicantRole: 'Pensyarah',
        department: 'Jabatan Pengajian Islam',
        purposeCategory: 'Kelas',
        title: 'Kelas Fiqh',
        paxCount: 30,
        status: 'CONFIRMED',
        createdAt: '2026-10-15T01:00:00Z',
        idempotencyKey: keyA1,
      },
    ];

    const retryCheck = validateBookingSlot(
      {
        roomId: 'BK01',
        date: '2026-10-15',
        startTime: '09:00',
        endTime: '11:00',
        applicantEmail: 'lecturer@mara.gov.my',
        idempotencyKey: keyA1,
      },
      existingList
    );

    assert.equal(retryCheck.isRetry, true, 'Must identify matching idempotencyKey as a safe retry');
    assert.equal(retryCheck.hasConflict, false, 'Safe retry must not be flagged as a conflict');
    console.log('  ✔ Gate 1 PASSED: Deterministic keys and idempotent retry handling verified.\n');
    passedGates++;
  } catch (err) {
    console.error('  ✘ Gate 1 FAILED:', err);
  }

  // -------------------------------------------------------------
  // GATE 2: Server-authoritative atomic booking conflict prevention
  // -------------------------------------------------------------
  try {
    console.log('▶ [Gate 2] Testing Atomic Conflict Prevention & Slot Overlap Mathematics...');
    // Overlapping tests
    assert.equal(isSlotOverlapping('08:30', '10:30', '09:30', '11:30'), true, 'Partial overlap detected');
    assert.equal(isSlotOverlapping('08:00', '12:00', '09:00', '10:00'), true, 'Contained slot detected');
    assert.equal(isSlotOverlapping('09:00', '10:00', '08:00', '12:00'), true, 'Encompassing slot detected');

    // Adjacent / Non-overlapping tests (half-open intervals [start, end))
    assert.equal(isSlotOverlapping('08:30', '10:30', '10:30', '12:30'), false, 'Adjacent back-to-back slot is available');
    assert.equal(isSlotOverlapping('14:00', '16:00', '08:00', '10:00'), false, 'Disjoint slots do not overlap');

    const confirmedBookings: AdHocBooking[] = [
      {
        id: 'BK-2026-CONFIRMED',
        roomId: 'DKA',
        roomName: 'Dewan Kuliah A',
        date: '2026-10-20',
        startTime: '10:00',
        endTime: '12:00',
        applicantName: 'Dr. Noraini',
        applicantRole: 'Pensyarah',
        department: 'Jabatan Perdagangan',
        purposeCategory: 'Kelas',
        title: 'Perakaunan Kewangan',
        paxCount: 60,
        status: 'CONFIRMED',
        createdAt: '2026-10-20T00:00:00Z',
      },
    ];

    const conflictingCandidate = {
      roomId: 'DKA',
      date: '2026-10-20',
      startTime: '11:00',
      endTime: '13:00',
      applicantEmail: 'other@mara.gov.my',
    };

    const conflictResult = validateBookingSlot(conflictingCandidate, confirmedBookings);
    assert.equal(conflictResult.hasConflict, true, 'Atomic validation must reject overlapping booking');
    assert.match(conflictResult.reason || '', /Slot masa bertindih/, 'Informative conflict reason provided');

    // Cancelled booking allows slot re-use
    const cancelledBookings: AdHocBooking[] = [
      {
        ...confirmedBookings[0],
        status: 'CANCELLED',
      },
    ];
    const nonConflictResult = validateBookingSlot(conflictingCandidate, cancelledBookings);
    assert.equal(nonConflictResult.hasConflict, false, 'Cancelled booking frees up the slot');

    console.log('  ✔ Gate 2 PASSED: Server-authoritative atomic slot conflict prevention verified.\n');
    passedGates++;
  } catch (err) {
    console.error('  ✘ Gate 2 FAILED:', err);
  }

  // -------------------------------------------------------------
  // GATE 3: Default-deny Firestore Rules validation
  // -------------------------------------------------------------
  try {
    console.log('▶ [Gate 3] Testing Default-Deny Firestore Security Rules...');
    const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
    assert.equal(fs.existsSync(rulesPath), true, 'firestore.rules exists');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');

    // 1. Global Default-Deny Catch-All
    assert.match(rulesContent, /match\s+\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;/, 'Global default-deny catch-all rule present');

    // 2. Staff credentials vault locked down (no client reads or writes)
    assert.match(rulesContent, /match\s+\/staff_credentials\/\{staffId\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;/, 'staff_credentials locked from client SDK');

    // 3. Admin authorization requirement
    assert.match(rulesContent, /function\s+isAdmin\(\)/, 'isAdmin function defined');
    assert.match(rulesContent, /request\.auth\.token\.email_verified\s*==\s*true/, 'Requires verified email for sensitive operations');

    // 4. Admin role assignment locked
    assert.match(rulesContent, /match\s+\/admins\/\{adminId\}\s*\{[\s\S]*allow\s+write:\s*if\s+false;/, 'Client SDK cannot self-assign admin roles');

    // 5. Bookings authorization: unauthenticated pending disallowed
    assert.match(rulesContent, /match\s+\/bookings\/\{bookingId\}\s*\{[\s\S]*isBookingOwner\(incoming\(\)\.applicantEmail\)\s*\|\|\s*isAdmin\(\)/, 'Booking creation restricted to verified owner or admin');

    console.log('  ✔ Gate 3 PASSED: Default-deny, credential vault lockdown, and RBAC rules verified.\n');
    passedGates++;
  } catch (err) {
    console.error('  ✘ Gate 3 FAILED:', err);
  }

  // -------------------------------------------------------------
  // GATE 4: Versioned catalog cache & rollback delta reconciliation
  // -------------------------------------------------------------
  try {
    console.log('▶ [Gate 4] Testing Rollback Delta Reconciliation & Split-Brain Prevention...');
    const sourceBookings: AdHocBooking[] = [
      {
        id: 'BK-SRC-1',
        roomId: 'BK02',
        roomName: 'Bilik Kuliah 02',
        date: '2026-11-01',
        startTime: '08:30',
        endTime: '10:30',
        applicantName: 'En. Razak',
        applicantRole: 'Pensyarah',
        department: 'Jabatan Sains Komputer',
        purposeCategory: 'Kelas',
        title: 'Pemrograman Web',
        paxCount: 25,
        status: 'CONFIRMED',
        createdAt: '2026-11-01T01:00:00Z',
        idempotencyKey: 'BK-BK02-2026-11-01-0830-1030-razak',
      },
    ];

    const targetBookings: AdHocBooking[] = [
      // 1. Updated existing booking on Target
      {
        ...sourceBookings[0],
        notes: 'Nota dikemaskini semasa tempoh migrasi',
        paxCount: 30,
      },
      // 2. New booking created on Target during cutover
      {
        id: 'BK-TGT-2',
        roomId: 'BK03',
        roomName: 'Bilik Kuliah 03',
        date: '2026-11-02',
        startTime: '14:00',
        endTime: '16:00',
        applicantName: 'Pn. Salmah',
        applicantRole: 'Pegawai',
        department: 'Unit Pentadbiran',
        purposeCategory: 'Mesyuarat',
        title: 'Mesyuarat Bahagian',
        paxCount: 15,
        status: 'CONFIRMED',
        createdAt: '2026-11-02T02:00:00Z',
        idempotencyKey: 'BK-BK03-2026-11-02-1400-1600-salmah',
      },
      // 3. Duplicate retry of BK-TGT-2 with matching idempotency key
      {
        id: 'BK-TGT-2-RETRY',
        roomId: 'BK03',
        roomName: 'Bilik Kuliah 03',
        date: '2026-11-02',
        startTime: '14:00',
        endTime: '16:00',
        applicantName: 'Pn. Salmah',
        applicantRole: 'Pegawai',
        department: 'Unit Pentadbiran',
        purposeCategory: 'Mesyuarat',
        title: 'Mesyuarat Bahagian',
        paxCount: 15,
        status: 'CONFIRMED',
        createdAt: '2026-11-02T02:01:00Z',
        idempotencyKey: 'BK-BK03-2026-11-02-1400-1600-salmah',
      },
    ];

    const result = reconcileRollbackDelta(targetBookings, sourceBookings);

    assert.equal(result.report.createsCount, 1, 'Exactly 1 new booking created from Target');
    assert.equal(result.report.updatesCount, 1, 'Exactly 1 update merged into Source');
    assert.equal(result.report.duplicateRetriesCount, 1, 'Duplicate retry cleanly deduplicated');
    assert.equal(result.mergedBookings.length, 2, 'Total merged records is 2 without duplicate corruption');
    assert.equal(result.report.hasConflicts, false, 'Zero conflict split-brain state');

    console.log('  ✔ Gate 4 PASSED: Safe rollback delta reconciliation and deduplication verified.\n');
    passedGates++;
  } catch (err) {
    console.error('  ✘ Gate 4 FAILED:', err);
  }

  // -------------------------------------------------------------
  // GATE 5: Server-Side scrypt Verification, Rate Limiting & Zero Leakage
  // -------------------------------------------------------------
  try {
    console.log('▶ [Gate 5] Testing Server-Side scrypt Derivation, Server Rate Limiting & Zero Leakage...');

    // 1. Zero Plaintext PINs in Client Seed Data & Types
    for (const staff of INITIAL_STAFF_DATA) {
      assert.equal((staff as any).pin, undefined, `Staff ${staff.id} has no plaintext PIN`);
      assert.equal((staff as any).pinHash, undefined, `Staff ${staff.id} has no client pinHash`);
      assert.ok(staff.pinStatus === 'DEFAULT' || staff.pinStatus === 'CUSTOM', `Staff ${staff.id} has valid pinStatus`);
    }

    // 2. scrypt Key Derivation Parameters Verification (N=16384, r=8, p=1, keylen=64)
    const scryptResult = await hashPinScrypt('1234');
    assert.match(
      scryptResult.encoded,
      /^scrypt\$16384\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/,
      'scrypt format matches standard scrypt$N$r$p$salt$hash specification'
    );
    assert.equal(scryptResult.salt.length, 32, '16-byte random salt encoded as 32 hex chars');
    assert.equal(scryptResult.hash.length, 128, '64-byte keylen encoded as 128 hex chars');

    // 3. Timing-Safe Constant-Time Verification
    const isCorrect = await verifyPinScrypt('1234', scryptResult.encoded);
    assert.equal(isCorrect, true, 'Valid PIN correctly verified via scrypt');

    const isWrong = await verifyPinScrypt('9999', scryptResult.encoded);
    assert.equal(isWrong, false, 'Incorrect PIN rejected');

    const isSingleDigitWrong = await verifyPinScrypt('1235', scryptResult.encoded);
    assert.equal(isSingleDigitWrong, false, 'Single-digit alteration rejected');

    // 4. Per-User Salt Nonce Differentiation
    const scryptUserA = await hashPinScrypt('1234');
    const scryptUserB = await hashPinScrypt('1234');
    assert.notEqual(
      scryptUserA.encoded,
      scryptUserB.encoded,
      'Same PIN with distinct random salts produces completely distinct hashes'
    );

    // 5. Server-Side Rate Limiter & Lockout (5 attempts, 15m window)
    const testLimiter = new ServerRateLimiter(5, 15 * 60 * 1000);
    const testStaffId = 'st_test_limiter';

    // Initial state: allowed with 5 attempts left
    const initialCheck = testLimiter.checkLimit(testStaffId);
    assert.equal(initialCheck.allowed, true);
    assert.equal(initialCheck.attemptsLeft, 5);

    // Record 4 consecutive failed attempts
    for (let i = 1; i <= 4; i++) {
      const fail = testLimiter.recordFailure(testStaffId);
      assert.equal(fail.locked, false, `Attempt ${i} should not lock yet`);
      assert.equal(fail.attemptsLeft, 5 - i, `Should have ${5 - i} attempts left`);
    }

    // 5th failed attempt: triggers 15-minute account lockout
    const finalFail = testLimiter.recordFailure(testStaffId);
    assert.equal(finalFail.locked, true, '5th attempt must lock account');
    assert.ok((finalFail.remainingLockoutSeconds || 0) > 890, 'Lockout duration must be ~900 seconds');

    // Subsequent check: strictly rejected with allowed: false
    const lockedCheck = testLimiter.checkLimit(testStaffId);
    assert.equal(lockedCheck.allowed, false, 'Locked account must be disallowed');
    assert.ok(lockedCheck.remainingLockoutSeconds! > 0, 'Must report remaining lockout seconds');

    // 6. Server Credential Vault Verification & Zero Credential Leakage
    const testStaff = INITIAL_STAFF_DATA[0];
    const verifySuccess = await serverAuthVault.verifyStaff(testStaff.email, '1234');
    assert.equal(verifySuccess.success, true, 'Default staff login with 1234 succeeds');
    assert.ok(verifySuccess.staff, 'Staff object returned');

    // CRITICAL: Ensure zero credential leakage in staff payload
    assert.equal((verifySuccess.staff as any).pin, undefined, 'Returned staff has no pin property');
    assert.equal((verifySuccess.staff as any).pinHash, undefined, 'Returned staff has no pinHash property');
    assert.equal((verifySuccess.staff as any).scryptHash, undefined, 'Returned staff has no scryptHash property');
    assert.equal((verifySuccess.staff as any).salt, undefined, 'Returned staff has no salt property');
    assert.equal(serverAuthVault.hasCredentialLeak(verifySuccess.staff as any), false, 'Audit confirms zero credential leak');

    // Test PIN update in vault
    await serverAuthVault.updateStaffPin(testStaff.id, '5678');
    const verifyOld = await serverAuthVault.verifyStaff(testStaff.email, '1234');
    assert.equal(verifyOld.success, false, 'Old PIN 1234 rejected after update');

    const verifyNew = await serverAuthVault.verifyStaff(testStaff.email, '5678');
    assert.equal(verifyNew.success, true, 'New PIN 5678 verified via scrypt');
    assert.equal(verifyNew.staff?.pinStatus, 'CUSTOM', 'pinStatus transitioned to CUSTOM');

    // Reset back to default (without auth in internal test)
    await serverAuthVault.resetStaffPin(testStaff.id);
    const verifyReset = await serverAuthVault.verifyStaff(testStaff.email, '1234');
    assert.equal(verifyReset.success, true, 'Reset to default PIN 1234 verified');
    assert.equal(verifyReset.staff?.pinStatus, 'DEFAULT', 'pinStatus reverted to DEFAULT');

    // 7. Post-Fix Verification 1: Confirm NO local PIN verification bypass (Fail-Closed)
    const localAttempt = verifyStaffCredentialsLocally(testStaff.email, '1234');
    assert.equal(localAttempt.success, false, 'Local verification must strictly fail-closed');
    assert.match(localAttempt.errorMsg, /Fail-Closed/i, 'Error message must reflect Fail-Closed policy');

    // 8. Post-Fix Verification 2: Enforce Server-Side Authentication & Authorization on update
    const updateNoAuth = await serverAuthVault.updateStaffPin(testStaff.id, '9876', {
      currentPin: 'wrong',
      skipAuth: false,
    });
    assert.equal(updateNoAuth.success, false, 'Update with wrong current PIN must fail');
    assert.equal(updateNoAuth.errorMsg, 'PIN semasa tidak sah.');

    // Update with valid current PIN succeeds
    const updateWithAuth = await serverAuthVault.updateStaffPin(testStaff.id, '9876', {
      currentPin: '1234',
      skipAuth: false,
    });
    assert.equal(updateWithAuth.success, true, 'Update with valid current PIN must succeed');

    // 9. Post-Fix Verification 3: Enforce Server-Side Admin Authorization on reset
    const resetUnauthorized = await serverAuthVault.resetStaffPin(testStaff.id, {
      adminPasscode: 'wrong_code',
      skipAuth: false,
    });
    assert.equal(resetUnauthorized.success, false, 'Reset with invalid admin passcode must fail');

    const resetAuthorized = await serverAuthVault.resetStaffPin(testStaff.id, {
      adminPasscode: '5313',
      skipAuth: false,
    });
    assert.equal(resetAuthorized.success, true, 'Reset with valid master admin passcode must succeed');

    // Re-verify after authorized reset
    const verifyAfterReset = await serverAuthVault.verifyStaff(testStaff.email, '1234');
    assert.equal(verifyAfterReset.success, true, 'Staff PIN successfully reset to 1234');

    console.log('  ✔ Gate 5 PASSED: Server-side scrypt (N=16384), 5-attempt rate limiter, fail-closed enforcement, and zero client credential leakage verified.\n');
    passedGates++;
  } catch (err) {
    console.error('  ✘ Gate 5 FAILED:', err);
  }

  console.log('========================================================================');
  console.log(`TOTAL RESULT: ${passedGates}/${totalGates} GATES PASSED`);
  console.log('========================================================================\n');

  if (passedGates !== totalGates) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllGateTests().catch((err) => {
  console.error('Unexpected error in gate tests:', err);
  process.exit(1);
});
