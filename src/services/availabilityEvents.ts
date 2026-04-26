import { EventEmitter } from 'events';

type AvailabilityEventType =
  | 'hold_created'
  | 'hold_released'
  | 'hold_converted'
  | 'hold_expired'
  | 'reservation_created'
  | 'reservation_cancelled';

export type AvailabilityEventPayload = {
  venueId: string;
  type: AvailabilityEventType;
  at: string;
  reservationId?: string;
  holdId?: string;
};

const emitter = new EventEmitter();
emitter.setMaxListeners(200);

export function publishAvailabilityEvent(payload: AvailabilityEventPayload) {
  emitter.emit(`venue:${payload.venueId}`, payload);
}

export function subscribeToVenueAvailability(
  venueId: string,
  listener: (payload: AvailabilityEventPayload) => void
) {
  const key = `venue:${venueId}`;
  emitter.on(key, listener);
  return () => emitter.off(key, listener);
}
