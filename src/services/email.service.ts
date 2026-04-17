import { Resend } from 'resend';
import { getEnv } from '../config/env';
import { logger } from '../config/logger';

const env = getEnv();
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: EmailOptions): Promise<boolean> {
  if (!resend) {
    logger.warn('Email service not configured (RESEND_API_KEY missing). Skipping email send.');
    return false;
  }

  if (!env.EMAIL_FROM) {
    logger.warn('EMAIL_FROM not configured. Skipping email send.');
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
