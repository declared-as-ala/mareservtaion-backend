import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { Reservation } from '../models/Reservation';
import {
  createReservationReminderTemplate,
  createReservationReviewRequestTemplate,
  sendEmail,
} from '../services/email.service';

async function sendReservationEmails() {
  await connectDatabase();
  const now = new Date();
  const reminderCutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const reviewCutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const [reminders, reviews] = await Promise.all([
    Reservation.find({
      status: 'CONFIRMED',
      customerEmail: { $exists: true, $ne: null },
      startAt: { $gte: now, $lte: reminderCutoff },
      reminderEmailSentAt: { $exists: false },
    }).populate('venueId', 'name'),
    Reservation.find({
      status: { $in: ['CONFIRMED', 'COMPLETED'] },
      customerEmail: { $exists: true, $ne: null },
      endAt: { $lte: reviewCutoff },
      reviewRequestSentAt: { $exists: false },
    }).populate('venueId', 'name'),
  ]);

  let sentReminders = 0;
  for (const reservation of reminders) {
    const venueName = ((reservation.venueId as any)?.name as string) || 'Votre lieu';
    const start = new Date(reservation.startAt);
    const template = createReservationReminderTemplate(
      `${reservation.guestFirstName || ''} ${reservation.guestLastName || ''}`.trim() || 'Client',
      venueName,
      start.toLocaleDateString('fr-FR'),
      start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      reservation.reservationCode || reservation.confirmationCode || reservation._id.toString()
    );
    const sent = await sendEmail({
      to: String(reservation.customerEmail),
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
    if (sent) {
      reservation.reminderEmailSentAt = new Date();
      await reservation.save();
      sentReminders += 1;
    }
  }

  let sentReviews = 0;
  for (const reservation of reviews) {
    const venueName = ((reservation.venueId as any)?.name as string) || 'Votre lieu';
    const template = createReservationReviewRequestTemplate(
      `${reservation.guestFirstName || ''} ${reservation.guestLastName || ''}`.trim() || 'Client',
      venueName,
      reservation.reservationCode || reservation.confirmationCode || reservation._id.toString()
    );
    const sent = await sendEmail({
      to: String(reservation.customerEmail),
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
    if (sent) {
      reservation.reviewRequestSentAt = new Date();
      await reservation.save();
      sentReviews += 1;
    }
  }

  console.log(`Sent ${sentReminders} reminder email(s) and ${sentReviews} review request email(s).`);
  await mongoose.disconnect();
}

sendReservationEmails().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
