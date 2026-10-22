import { AdHocBooking } from '../types';

/**
 * Deterministic string hash helper
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generates a deterministic, collision-resistant idempotency key for bookings.
 * Format: BK-{roomId}-{date}-{startTime}-{endTime}-{identityHash}
 */
export function generateBookingIdempotencyKey(params: {
  roomId: string;
  date: string;
  startTime: string;
  endTime: string;
  applicantEmail?: string;
  applicantName?: string;
}): string {
  const cleanRoom = params.roomId.trim().toUpperCase();
  const cleanDate = params.date.trim();
  const cleanStart = params.startTime.trim().replace(':', '');
  const cleanEnd = params.endTime.trim().replace(':', '');
  const identity = (params.applicantEmail || params.applicantName || 'anonymous').trim().toLowerCase();
  const idHash = hashString(identity);

  return `BK-${cleanRoom}-${cleanDate}-${cleanStart}-${cleanEnd}-${idHash}`;
}

/**
 * Checks whether two time intervals [startA, endA) and [startB, endB) overlap.
 * Uses half-open interval comparison [start, end) where end time is non-inclusive.
 */
export function isSlotOverlapping(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  // Overlap occurs if and only if max(startA, startB) < min(endA, endB)
  return startA < endB && startB < endA;
}

/**
 * Validates whether a candidate booking conflicts with any existing confirmed or active bookings.
 * Supports idempotency: if the existing booking has the same idempotency key or ID, it is treated as a retry.
 */
export function validateBookingSlot(
  candidate: {
    id?: string;
    roomId: string;
    date: string;
    startTime: string;
    endTime: string;
    applicantEmail?: string;
    applicantName?: string;
    idempotencyKey?: string;
  },
  existingBookings: AdHocBooking[]
): {
  hasConflict: boolean;
  isRetry: boolean;
  conflictingBooking?: AdHocBooking;
  reason?: string;
} {
  const candidateKey = candidate.idempotencyKey || generateBookingIdempotencyKey(candidate);

  for (const existing of existingBookings) {
    // Ignore cancelled or rejected bookings
    if (existing.status === 'CANCELLED' || existing.status === 'REJECTED') {
      continue;
    }

    // Check for exact retry (same idempotencyKey or same ID)
    if (
      (candidate.id && existing.id === candidate.id) ||
      (existing.idempotencyKey && existing.idempotencyKey === candidateKey)
    ) {
      return {
        hasConflict: false,
        isRetry: true,
        conflictingBooking: existing,
      };
    }

    // Check same room and date
    if (
      existing.roomId.trim().toUpperCase() === candidate.roomId.trim().toUpperCase() &&
      existing.date === candidate.date
    ) {
      if (isSlotOverlapping(candidate.startTime, candidate.endTime, existing.startTime, existing.endTime)) {
        return {
          hasConflict: true,
          isRetry: false,
          conflictingBooking: existing,
          reason: `Slot masa bertindih dengan tempahan sedia ada (${existing.startTime} - ${existing.endTime}) oleh ${existing.applicantName}.`,
        };
      }
    }
  }

  return {
    hasConflict: false,
    isRetry: false,
  };
}
