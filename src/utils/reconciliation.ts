import { AdHocBooking } from '../types';

export interface ReconciliationReport {
  createsCount: number;
  updatesCount: number;
  cancellationsCount: number;
  duplicateRetriesCount: number;
  totalProcessed: number;
  mergedRecordsCount: number;
  hasConflicts: boolean;
  conflicts: string[];
}

/**
 * Reconciles delta mutations from Target database back into Source database
 * to prevent split-brain data loss during emergency rollback.
 * 
 * Handles:
 * 1. Creates: Documents created on Target during cutover window.
 * 2. Updates: Field modifications (notes, paxCount, applicant details).
 * 3. Cancellations: Status changes to 'CANCELLED'.
 * 4. Duplicate Retries: Deduplication via idempotencyKey or document ID.
 */
export function reconcileRollbackDelta(
  targetBookings: AdHocBooking[],
  sourceBookings: AdHocBooking[]
): {
  mergedBookings: AdHocBooking[];
  report: ReconciliationReport;
} {
  const sourceMapById = new Map<string, AdHocBooking>();
  const sourceMapByKey = new Map<string, AdHocBooking>();

  sourceBookings.forEach((b) => {
    sourceMapById.set(b.id, { ...b });
    if (b.idempotencyKey) {
      sourceMapByKey.set(b.idempotencyKey, { ...b });
    }
  });

  let createsCount = 0;
  let updatesCount = 0;
  let cancellationsCount = 0;
  let duplicateRetriesCount = 0;
  const conflicts: string[] = [];

  const processedIds = new Set<string>();

  targetBookings.forEach((targetItem) => {
    const existingById = sourceMapById.get(targetItem.id);
    const existingByKey = targetItem.idempotencyKey ? sourceMapByKey.get(targetItem.idempotencyKey) : undefined;
    const existing = existingById || existingByKey;

    if (!existing) {
      // 1. Create: completely new booking created on Target DB
      sourceMapById.set(targetItem.id, { ...targetItem });
      if (targetItem.idempotencyKey) {
        sourceMapByKey.set(targetItem.idempotencyKey, { ...targetItem });
      }
      processedIds.add(targetItem.id);
      createsCount++;
    } else {
      // Check if this is an identical duplicate retry
      if (
        existing.id !== targetItem.id &&
        existing.idempotencyKey &&
        targetItem.idempotencyKey &&
        existing.idempotencyKey === targetItem.idempotencyKey
      ) {
        duplicateRetriesCount++;
        // Idempotent: preserve the existing document ID, do not duplicate
        return;
      }

      // 2. Cancellation
      if (targetItem.status === 'CANCELLED' && existing.status !== 'CANCELLED') {
        cancellationsCount++;
        const updated = {
          ...existing,
          ...targetItem,
          status: 'CANCELLED' as const,
        };
        sourceMapById.set(existing.id, updated);
        if (existing.idempotencyKey) {
          sourceMapByKey.set(existing.idempotencyKey, updated);
        }
        processedIds.add(existing.id);
        return;
      }

      // 3. Update
      const isModified =
        existing.status !== targetItem.status ||
        existing.paxCount !== targetItem.paxCount ||
        existing.notes !== targetItem.notes ||
        existing.title !== targetItem.title;

      if (isModified) {
        updatesCount++;
        const merged = {
          ...existing,
          ...targetItem,
          id: existing.id, // maintain source ID
        };
        sourceMapById.set(existing.id, merged);
        if (existing.idempotencyKey) {
          sourceMapByKey.set(existing.idempotencyKey, merged);
        }
        processedIds.add(existing.id);
      } else {
        // Unmodified duplicate
        duplicateRetriesCount++;
      }
    }
  });

  const mergedList = Array.from(sourceMapById.values());

  const report: ReconciliationReport = {
    createsCount,
    updatesCount,
    cancellationsCount,
    duplicateRetriesCount,
    totalProcessed: targetBookings.length,
    mergedRecordsCount: mergedList.length,
    hasConflicts: conflicts.length > 0,
    conflicts,
  };

  return {
    mergedBookings: mergedList,
    report,
  };
}
