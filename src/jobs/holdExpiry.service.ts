import { ReservationHold } from '../models/ReservationHold';
import { publishAvailabilityEvent } from '../services/availabilityEvents';

let started = false;

export function startHoldExpiryLoop() {
  if (started) return;
  started = true;

  const tick = async () => {
    const expired = await ReservationHold.find({
      status: 'active',
      expiresAt: { $lt: new Date() },
    }).select('_id venueId');

    if (!expired.length) return;

    await ReservationHold.updateMany(
      { _id: { $in: expired.map((hold) => hold._id) } },
      { $set: { status: 'expired' } }
    );

    expired.forEach((hold) => {
      publishAvailabilityEvent({
        venueId: hold.venueId.toString(),
        type: 'hold_expired',
        at: new Date().toISOString(),
        holdId: hold._id.toString(),
      });
    });
  };

  void tick();
  setInterval(() => {
    void tick();
  }, 30000);
}
