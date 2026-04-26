import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { getEnv } from '../config/env';
import { logger } from '../config/logger';

const env = getEnv();
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
const smtpTransporter =
  env.EMAIL_HOST && env.EMAIL_PORT && env.EMAIL_USER && env.EMAIL_PASS
    ? nodemailer.createTransport({
        host: env.EMAIL_HOST,
        port: Number(env.EMAIL_PORT),
        secure: Number(env.EMAIL_PORT) === 465,
        auth: {
          user: env.EMAIL_USER,
          // Gmail app passwords are often copied with spaces.
          pass: env.EMAIL_PASS.replace(/\s+/g, ''),
        },
      })
    : null;

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

type EmailHealth = {
  emailFromConfigured: boolean;
  smtpConfigured: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpUserMasked?: string;
  resendConfigured: boolean;
  smtpVerified?: boolean;
  smtpError?: string;
};

function maskEmail(email?: string): string | undefined {
  if (!email || !email.includes('@')) return undefined;
  const [name, domain] = email.split('@');
  if (!name || !domain) return undefined;
  const visible = name.length <= 2 ? name[0] : name.slice(0, 2);
  return `${visible}***@${domain}`;
}

export async function getEmailHealth(): Promise<EmailHealth> {
  const health: EmailHealth = {
    emailFromConfigured: Boolean(env.EMAIL_FROM),
    smtpConfigured: Boolean(smtpTransporter),
    smtpHost: env.EMAIL_HOST,
    smtpPort: env.EMAIL_PORT ? Number(env.EMAIL_PORT) : undefined,
    smtpUserMasked: maskEmail(env.EMAIL_USER),
    resendConfigured: Boolean(resend),
  };

  if (smtpTransporter) {
    try {
      await smtpTransporter.verify();
      health.smtpVerified = true;
    } catch (error) {
      health.smtpVerified = false;
      health.smtpError = error instanceof Error ? error.message : String(error);
    }
  }

  return health;
}

export async function sendEmail({ to, subject, html, text }: EmailOptions): Promise<boolean> {
  logger.info('Email send attempt', {
    to,
    subject,
    transport: smtpTransporter ? 'smtp' : resend ? 'resend' : 'none',
  });

  if (!env.EMAIL_FROM) {
    logger.warn('EMAIL_FROM not configured. Skipping email send.');
    return false;
  }

  if (smtpTransporter) {
    try {
      await smtpTransporter.sendMail({
        from: `Ma Reservation <${env.EMAIL_FROM}>`,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''),
      });
      logger.info(`Email sent via SMTP to ${to}: ${subject}`);
      return true;
    } catch (error) {
      logger.error(`SMTP send failed for ${to}`, error, {
        smtpHost: env.EMAIL_HOST,
        smtpPort: env.EMAIL_PORT ? Number(env.EMAIL_PORT) : undefined,
        smtpUserMasked: maskEmail(env.EMAIL_USER),
      });
    }
  }

  if (!resend) {
    logger.warn('Email send failed: SMTP unavailable/invalid and RESEND_API_KEY missing.');
    return false;
  }

  try {
    await resend.emails.send({
      from: `Ma Reservation <${env.EMAIL_FROM}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });
    logger.info(`Email sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send email to ${to}: ${error}`);
    return false;
  }
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Password reset email template
export function createPasswordResetTemplate(
  userName: string,
  resetUrl: string,
  expiresIn: string = '1 heure'
): { subject: string; html: string; text: string } {
  const subject = 'Réinitialisation de votre mot de passe - Ma Reservation';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Réinitialisation du mot de passe</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <tr>
          <td style="text-align: center; padding-bottom: 30px;">
            <h1 style="color: #fbbf24; font-size: 28px; font-weight: 600; margin: 0;">Ma Reservation</h1>
          </td>
        </tr>
        <tr>
          <td style="background-color: #171717; border-radius: 16px; padding: 40px; border: 1px solid rgba(255,255,255,0.08);">
            <h2 style="color: #ffffff; font-size: 22px; font-weight: 600; margin: 0 0 16px 0;">Réinitialisation du mot de passe</h2>
            <p style="color: #a3a3a3; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
              Bonjour ${userName},
            </p>
            <p style="color: #a3a3a3; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
              Nous avons reçu une demande de réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="text-align: center; padding: 24px 0;">
                  <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #fbbf24, #f59e0b, #fbbf24); color: #000000; text-decoration: none; padding: 14px 40px; border-radius: 12px; font-weight: 600; font-size: 15px;">
                    Réinitialiser mon mot de passe
                  </a>
                </td>
              </tr>
            </table>
            <p style="color: #737373; font-size: 13px; line-height: 1.6; margin: 24px 0 0 0;">
              Ce lien expirera dans ${expiresIn}. Si vous n'avez pas demandé de réinitialisation, vous pouvez ignorer cet email en toute sécurité.
            </p>
          </td>
        </tr>
        <tr>
          <td style="text-align: center; padding-top: 30px;">
            <p style="color: #525252; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} Ma Reservation. Tous droits réservés.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `
Bonjour ${userName},

Nous avons reçu une demande de réinitialisation de votre mot de passe.

Pour réinitialiser votre mot de passe, cliquez sur le lien suivant :
${resetUrl}

Ce lien expirera dans ${expiresIn}. Si vous n'avez pas demandé de réinitialisation, vous pouvez ignorer cet email en toute sécurité.

© ${new Date().getFullYear()} Ma Reservation. Tous droits réservés.
  `;

  return { subject, html, text };
}

// Email verification template
export function createEmailVerificationTemplate(
  userName: string,
  verificationUrl: string,
  expiresIn: string = '24 heures'
): { subject: string; html: string; text: string } {
  const subject = 'Vérifiez votre adresse email - Ma Reservation';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Vérification de l'email</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <tr>
          <td style="text-align: center; padding-bottom: 30px;">
            <h1 style="color: #fbbf24; font-size: 28px; font-weight: 600; margin: 0;">Ma Reservation</h1>
          </td>
        </tr>
        <tr>
          <td style="background-color: #171717; border-radius: 16px; padding: 40px; border: 1px solid rgba(255,255,255,0.08);">
            <h2 style="color: #ffffff; font-size: 22px; font-weight: 600; margin: 0 0 16px 0;">Vérifiez votre email</h2>
            <p style="color: #a3a3a3; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
              Bonjour ${userName},
            </p>
            <p style="color: #a3a3a3; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
              Merci de vous être inscrit sur Ma Reservation ! Pour activer votre compte, veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous :
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="text-align: center; padding: 24px 0;">
                  <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #fbbf24, #f59e0b, #fbbf24); color: #000000; text-decoration: none; padding: 14px 40px; border-radius: 12px; font-weight: 600; font-size: 15px;">
                    Vérifier mon email
                  </a>
                </td>
              </tr>
            </table>
            <p style="color: #737373; font-size: 13px; line-height: 1.6; margin: 24px 0 0 0;">
              Ce lien expirera dans ${expiresIn}. Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="text-align: center; padding-top: 30px;">
            <p style="color: #525252; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} Ma Reservation. Tous droits réservés.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `
Bonjour ${userName},

Merci de vous être inscrit sur Ma Reservation !

Pour vérifier votre adresse email, cliquez sur le lien suivant :
${verificationUrl}

Ce lien expirera dans ${expiresIn}. Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.

© ${new Date().getFullYear()} Ma Reservation. Tous droits réservés.
  `;

  return { subject, html, text };
}

// SOS Conseil admin notification template
export function createSOSConseilAdminTemplate(data: {
  fullName: string;
  phone: string;
  email?: string;
  occasionType: string;
  participantsCount: number;
  averageAgeRanges: string[];
  preferredRegion: string;
  preferredCategory: string;
  budgetRange?: string;
  preferredDate?: string;
  preferredTime?: string;
  details?: string;
}): { subject: string; html: string; text: string } {
  const subject = `[SOS Conseil] ${data.fullName} • ${data.preferredRegion} • ${data.participantsCount} pers`;

  const formatBudget = (b: string) => {
    const map: Record<string, string> = {
      moins_100: 'Moins de 100 TND', '100_300': '100–300 TND',
      '300_600': '300–600 TND', '600_1000': '600–1 000 TND', plus_1000: 'Plus de 1 000 TND',
    };
    return map[b] || b;
  };

  const formatOccasion = (o: string) => {
    const map: Record<string, string> = {
      birthday: '🎂 Anniversaire', wedding_engagement: '💍 Mariage / Fiançailles',
      business_meeting: "💼 Réunion d'affaires", family_event: '👨‍👩‍👧 Événement familial',
      romantic_dinner: '🕯️ Dîner romantique', graduation: '🎓 Remise de diplôme',
      corporate: "🏢 Soirée d'entreprise", other: '✨ Autre',
    };
    return map[o] || o;
  };

  const formatCategory = (value: string) => {
    const map: Record<string, string> = {
      cafe: 'Café',
      restaurant: 'Restaurant',
      hotel: 'Hôtel',
      cinema: 'Cinéma',
      event_space: 'Espace événementiel',
    };
    return map[value] || value;
  };

  const row = (label: string, value: string | undefined, accent = false) =>
    value ? `<tr><td style="padding:8px 0;border-bottom:1px solid #262626;color:#a3a3a3;font-size:13px;white-space:nowrap;padding-right:16px;width:1%">${label}</td><td style="padding:8px 0;border-bottom:1px solid #262626;color:${accent ? '#fbbf24' : '#ffffff'};font-size:13px;font-weight:600">${value}</td></tr>` : '';

  const html = `
    <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Nouvelle demande SOS Conseil</title></head>
    <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:32px 20px;">
      <tr><td style="text-align:center;padding-bottom:24px;">
        <h1 style="color:#fbbf24;font-size:24px;font-weight:700;margin:0;letter-spacing:-0.5px">Ma Reservation</h1>
        <p style="color:#525252;font-size:12px;margin:4px 0 0">Service Conciergerie</p>
      </td></tr>
      <tr><td style="background:#171717;border-radius:16px;padding:32px;border:1px solid rgba(255,255,255,0.08);">
        <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:999px;padding:6px 14px;margin-bottom:20px;">
          <span style="color:#fbbf24;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">Nouvelle demande</span>
        </div>
        <h2 style="color:#ffffff;font-size:20px;font-weight:700;margin:0 0 20px">Demande de conseil — ${data.fullName}</h2>

        <p style="color:#a3a3a3;font-size:14px;margin:0 0 20px">Une nouvelle demande SOS Conseil vient d'être soumise. Voici les détails :</p>

        <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #262626;">
          ${row('👤 Nom', data.fullName)}
          ${row('📞 Téléphone', data.phone, true)}
          ${row('📧 Email', data.email)}
          ${row('🎉 Occasion', formatOccasion(data.occasionType))}
          ${row('👥 Participants', String(data.participantsCount) + ' personnes')}
          ${row('📅 Tranches d\'âge', data.averageAgeRanges.map((r) => `${r} ans`).join(', '))}
          ${row('📍 Région', data.preferredRegion)}
          ${row('🏛️ Catégorie', formatCategory(data.preferredCategory))}
          ${data.budgetRange ? row('💰 Budget', formatBudget(data.budgetRange), true) : ''}
          ${data.preferredDate ? row('📆 Date souhaitée', data.preferredDate) : ''}
          ${data.preferredTime ? row('⏰ Heure souhaitée', data.preferredTime) : ''}
        </table>

        ${data.details ? `
        <div style="margin-top:20px;background:#0a0a0a;border-radius:12px;padding:16px;border:1px solid #262626;">
          <p style="color:#737373;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 8px">Message</p>
          <p style="color:#d4d4d4;font-size:14px;line-height:1.6;margin:0">${data.details}</p>
        </div>` : ''}

        <div style="margin-top:24px;text-align:center;">
          <p style="color:#737373;font-size:13px;margin:0 0 16px">Contactez le client dans les plus brefs délais</p>
          ${data.phone ? `<a href="tel:${data.phone}" style="display:inline-block;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#000;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:14px;margin:0 8px 8px">Appeler maintenant</a>` : ''}
          ${data.email ? `<a href="mailto:${data.email}" style="display:inline-block;background:transparent;color:#fbbf24;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;border:1px solid rgba(251,191,36,0.4);margin:0 8px 8px">Envoyer un email</a>` : ''}
        </div>
      </td></tr>
      <tr><td style="text-align:center;padding-top:24px;">
        <p style="color:#404040;font-size:11px;margin:0">© ${new Date().getFullYear()} Ma Reservation · Panneau d'administration</p>
      </td></tr>
    </table></body></html>
  `;

  const text = `
Nouvelle demande SOS Conseil — Ma Reservation

Client : ${data.fullName}
Téléphone : ${data.phone}
${data.email ? `Email : ${data.email}` : ''}
Occasion : ${formatOccasion(data.occasionType)}
Participants : ${data.participantsCount}
Tranches d'âge : ${data.averageAgeRanges.map((r) => `${r} ans`).join(', ')}
Région : ${data.preferredRegion}
Catégorie : ${formatCategory(data.preferredCategory)}
${data.budgetRange ? `Budget : ${formatBudget(data.budgetRange)}` : ''}
${data.preferredDate ? `Date souhaitée : ${data.preferredDate}` : ''}
${data.preferredTime ? `Heure souhaitée : ${data.preferredTime}` : ''}
${data.details ? `Message : ${data.details}` : ''}
  `.trim();

  return { subject, html, text };
}

// Reservation confirmation template
export function createReservationConfirmationTemplate(
  userName: string,
  reservationCode: string,
  venueName: string,
  date: string,
  time: string,
  partySize: number
): { subject: string; html: string; text: string } {
  const subject = `Confirmation de réservation - ${reservationCode}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Confirmation de réservation</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <tr>
          <td style="text-align: center; padding-bottom: 30px;">
            <h1 style="color: #fbbf24; font-size: 28px; font-weight: 600; margin: 0;">Ma Reservation</h1>
          </td>
        </tr>
        <tr>
          <td style="background-color: #171717; border-radius: 16px; padding: 40px; border: 1px solid rgba(255,255,255,0.08);">
            <h2 style="color: #ffffff; font-size: 22px; font-weight: 600; margin: 0 0 24px 0;">Réservation confirmée ✓</h2>
            <p style="color: #a3a3a3; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
              Bonjour ${userName},
            </p>
            <p style="color: #a3a3a3; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
              Votre réservation a été confirmée avec succès. Voici les détails :
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; border-radius: 12px; padding: 20px;">
              <tr>
                <td style="padding: 8px 0;">
                  <strong style="color: #fbbf24;">Code de réservation :</strong>
                  <span style="color: #ffffff; margin-left: 8px;">${reservationCode}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0;">
                  <strong style="color: #fbbf24;">Lieu :</strong>
                  <span style="color: #ffffff; margin-left: 8px;">${venueName}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0;">
                  <strong style="color: #fbbf24;">Date :</strong>
                  <span style="color: #ffffff; margin-left: 8px;">${date}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0;">
                  <strong style="color: #fbbf24;">Heure :</strong>
                  <span style="color: #ffffff; margin-left: 8px;">${time}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0;">
                  <strong style="color: #fbbf24;">Nombre de personnes :</strong>
                  <span style="color: #ffffff; margin-left: 8px;">${partySize}</span>
                </td>
              </tr>
            </table>
            <p style="color: #a3a3a3; font-size: 15px; line-height: 1.6; margin: 24px 0 0 0;">
              Présentez ce code ou votre QR code à l'entrée pour accéder à votre réservation.
            </p>
          </td>
        </tr>
        <tr>
          <td style="text-align: center; padding-top: 30px;">
            <p style="color: #525252; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} Ma Reservation. Tous droits réservés.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `
Bonjour ${userName},

Votre réservation a été confirmée avec succès.

Code de réservation : ${reservationCode}
Lieu : ${venueName}
Date : ${date}
Heure : ${time}
Nombre de personnes : ${partySize}

Présentez ce code ou votre QR code à l'entrée pour accéder à votre réservation.

© ${new Date().getFullYear()} Ma Reservation. Tous droits réservés.
  `;

  return { subject, html, text };
}

export function createReservationCancellationTemplate(
  userName: string,
  reservationCode: string,
  venueName: string,
  date: string,
  time: string
): { subject: string; html: string; text: string } {
  const subject = `Annulation de reservation - ${reservationCode}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Annulation de reservation</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <tr>
          <td style="text-align: center; padding-bottom: 30px;">
            <h1 style="color: #fbbf24; font-size: 28px; font-weight: 600; margin: 0;">Ma Reservation</h1>
          </td>
        </tr>
        <tr>
          <td style="background-color: #171717; border-radius: 16px; padding: 40px; border: 1px solid rgba(255,255,255,0.08);">
            <h2 style="color: #ffffff; font-size: 22px; font-weight: 600; margin: 0 0 24px 0;">Reservation annulee</h2>
            <p style="color: #a3a3a3; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
              Bonjour ${userName},
            </p>
            <p style="color: #a3a3a3; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
              Votre reservation a bien ete annulee. Voici un rappel des informations concernees :
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; border-radius: 12px; padding: 20px;">
              <tr><td style="padding: 8px 0;"><strong style="color: #fbbf24;">Code :</strong><span style="color: #ffffff; margin-left: 8px;">${reservationCode}</span></td></tr>
              <tr><td style="padding: 8px 0;"><strong style="color: #fbbf24;">Lieu :</strong><span style="color: #ffffff; margin-left: 8px;">${venueName}</span></td></tr>
              <tr><td style="padding: 8px 0;"><strong style="color: #fbbf24;">Date :</strong><span style="color: #ffffff; margin-left: 8px;">${date}</span></td></tr>
              <tr><td style="padding: 8px 0;"><strong style="color: #fbbf24;">Heure :</strong><span style="color: #ffffff; margin-left: 8px;">${time}</span></td></tr>
            </table>
            <p style="color: #a3a3a3; font-size: 15px; line-height: 1.6; margin: 24px 0 0 0;">
              Vous pouvez explorer d'autres lieux et creer une nouvelle reservation a tout moment.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `
Bonjour ${userName},

Votre reservation a ete annulee.

Code : ${reservationCode}
Lieu : ${venueName}
Date : ${date}
Heure : ${time}
  `.trim();

  return { subject, html, text };
}

export function createReservationReminderTemplate(
  userName: string,
  venueName: string,
  date: string,
  time: string,
  reservationCode: string
): { subject: string; html: string; text: string } {
  const subject = `Rappel de reservation - ${venueName}`;
  const html = `
    <!DOCTYPE html>
    <html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0a0a0a;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 20px;">
        <tr><td style="background:#171717;border-radius:16px;padding:36px;border:1px solid rgba(255,255,255,0.08);">
          <h1 style="color:#fbbf24;margin:0 0 20px 0;font-size:28px;">Ma Reservation</h1>
          <h2 style="color:#fff;margin:0 0 16px 0;">Rappel de votre reservation</h2>
          <p style="color:#a3a3a3;line-height:1.6;">Bonjour ${userName}, votre reservation approche.</p>
          <p style="color:#fff;line-height:1.8;">
            Lieu: <strong>${venueName}</strong><br/>
            Date: <strong>${date}</strong><br/>
            Heure: <strong>${time}</strong><br/>
            Code: <strong>${reservationCode}</strong>
          </p>
        </td></tr>
      </table>
    </body></html>
  `;
  const text = `Bonjour ${userName}, rappel de reservation chez ${venueName} le ${date} a ${time}. Code: ${reservationCode}`;
  return { subject, html, text };
}

export function createReservationReviewRequestTemplate(
  userName: string,
  venueName: string,
  reservationCode: string
): { subject: string; html: string; text: string } {
  const subject = `Comment s'est passee votre reservation ?`;
  const html = `
    <!DOCTYPE html>
    <html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0a0a0a;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 20px;">
        <tr><td style="background:#171717;border-radius:16px;padding:36px;border:1px solid rgba(255,255,255,0.08);">
          <h1 style="color:#fbbf24;margin:0 0 20px 0;font-size:28px;">Ma Reservation</h1>
          <h2 style="color:#fff;margin:0 0 16px 0;">Votre avis nous interesse</h2>
          <p style="color:#a3a3a3;line-height:1.6;">Bonjour ${userName}, merci pour votre passage chez ${venueName}.</p>
          <p style="color:#a3a3a3;line-height:1.6;">Si vous avez quelques minutes, laissez un avis sur votre reservation ${reservationCode} pour aider les prochains clients.</p>
        </td></tr>
      </table>
    </body></html>
  `;
  const text = `Bonjour ${userName}, merci pour votre reservation chez ${venueName}. Votre avis sur la reservation ${reservationCode} nous aiderait beaucoup.`;
  return { subject, html, text };
}
