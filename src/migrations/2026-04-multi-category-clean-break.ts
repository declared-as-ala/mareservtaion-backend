import { User } from '../models/User';
import { Venue } from '../models/Venue';
import { Reservation } from '../models/Reservation';

export async function runMultiCategoryCleanBreakMigration() {
  await User.updateMany(
    { role: 'VENUE_OWNER' },
    { $set: { role: 'ESTABLISHMENT_OWNER' } }
  );

  await Reservation.updateMany(
    { status: { $in: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] } },
    [
      {
        $set: {
          status: {
            $switch: {
              branches: [
                { case: { $eq: ['$status', 'PENDING'] }, then: 'pending' },
                { case: { $eq: ['$status', 'CONFIRMED'] }, then: 'confirmed' },
                { case: { $eq: ['$status', 'COMPLETED'] }, then: 'completed' },
                { case: { $eq: ['$status', 'CANCELLED'] }, then: 'cancelled' },
                { case: { $eq: ['$status', 'NO_SHOW'] }, then: 'no_show' },
              ],
              default: '$status',
            },
          },
        },
      },
    ]
  );

  const venuesWithoutOwner = await Venue.find({ ownerId: { $exists: false }, createdBy: { $exists: true } }).select('_id createdBy');
  for (const venue of venuesWithoutOwner) {
    await Venue.updateOne({ _id: venue._id }, { $set: { ownerId: venue.createdBy } });
  }
}
