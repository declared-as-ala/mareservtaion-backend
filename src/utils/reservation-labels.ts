import type { VenueType } from '../models/Venue';

export function getReservableLabel(category?: VenueType | string): string {
  switch (String(category || '').toUpperCase()) {
    case 'HOTEL':
      return 'chambre';
    case 'CINEMA':
    case 'EVENT_SPACE':
      return 'place';
    default:
      return 'table';
  }
}

export function getReservationCTA(category?: VenueType | string): string {
  return `Reserver une ${getReservableLabel(category)}`;
}

export function getDashboardResourceName(category?: VenueType | string): string {
  const label = getReservableLabel(category);
  return `${label[0].toUpperCase()}${label.slice(1)}s`;
}
