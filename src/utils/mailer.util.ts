import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import env from '../config/env.config';
import logger from './logger.util';

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}

const isMailConfigured = (): boolean => {
  return Boolean(env.mail.host && env.mail.user && env.mail.pass);
};

let transporter: Transporter | null = null;

const getTransporter = (): Transporter => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.port === 465,
      auth: {
        user: env.mail.user,
        pass: env.mail.pass,
      },
    });
  }
  return transporter;
};

export const verifyMailer = async (): Promise<boolean> => {
  if (!isMailConfigured()) {
    logger.warn('SMTP mailer is not configured (missing SMTP_HOST, MAIL_USER, or MAIL_PASS)');
    return false;
  }

  try {
    await getTransporter().verify();
    logger.info(`SMTP mailer connected (${env.mail.host}:${env.mail.port})`);
    return true;
  } catch (error: unknown) {
    logger.warn('SMTP mailer verification failed', error);
    return false;
  }
};

export const sendMail = async (options: SendMailOptions): Promise<void> => {
  if (!isMailConfigured()) {
    throw new Error('SMTP mailer is not configured. Check SMTP_HOST, MAIL_USER, and MAIL_PASS.');
  }

  const info = await getTransporter().sendMail({
    from: env.mail.from || env.mail.user,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });

  logger.info('Email sent successfully', { messageId: info.messageId, to: options.to });
};

const escapeHtml = (input: string): string => {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const sendPasswordResetEmail = async (to: string, fullName: string, resetToken: string, expiresInMinutes = 15): Promise<void> => {
  const safeName = escapeHtml(fullName);
  const safeToken = escapeHtml(resetToken);

  await sendMail({
    to,
    subject: 'Password Reset Request - Retail POS',
    text: [
      `Hello ${fullName},`,
      '',
      'You requested a password reset for your Retail POS account.',
      `Your reset code/token is: ${resetToken}`,
      `This token expires in ${expiresInMinutes} minutes.`,
      '',
      'If you did not request this, you can safely ignore this email.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <h2>Password Reset Request</h2>
        <p>Hello <strong>${safeName}</strong>,</p>
        <p>You requested a password reset for your Retail POS account.</p>
        <p>Use the reset token below (valid for ${expiresInMinutes} minutes):</p>
        <p style="font-size: 18px; font-weight: bold; letter-spacing: 1px; padding: 12px 16px; background: #f3f4f6; display: inline-block; border-radius: 6px;">
          ${safeToken}
        </p>
        <p style="color: #6b7280; font-size: 13px;">If you did not request this, please ignore this email.</p>
      </div>
    `,
  });
};

export const mailer = {
  verifyMailer,
  sendMail,
  sendPasswordResetEmail,
};

export default mailer;
