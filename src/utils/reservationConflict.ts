/**
 * Check if two time ranges overlap (start inclusive, end exclusive logic for slots).
 */
export function overlaps(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  const s1 = start1.getTime();
  const e1 = end1.getTime();
  const s2 = start2.getTime();
  const e2 = end2.getTime();
  return s1 < e2 && e1 > s2;
}

export interface TimeSlot {
  startsAt: Date;
  endsAt: Date;
}

/**
 * Returns true if the given slot conflicts with any of the existing slots.
 */
export function hasConflict(
  slot: TimeSlot,
  existingSlots: TimeSlot[]
): boolean {
  return existingSlots.some((existing) =>
    overlaps(slot.startsAt, slot.endsAt, existing.startsAt, existing.endsAt)
  );
}
