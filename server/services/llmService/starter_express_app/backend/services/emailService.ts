import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';
import Mailgun from 'mailgun.js';
import FormData from 'form-data';
import { Resend } from 'resend';
import { SES, SendEmailCommand } from '@aws-sdk/client-ses';

type EmailProvider = 'SMTP' | 'SENDGRID' | 'MAILGUN' | 'RESEND' | 'AWS_SES';

export interface SendMailInput {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

function getProvider(): EmailProvider {
  const p = (process.env.EMAIL_PROVIDER || 'SMTP').toUpperCase();
  if (p === 'SENDGRID' || p === 'MAILGUN' || p === 'RESEND' || p === 'AWS_SES')
    return p as EmailProvider;
  return 'SMTP';
}

function getFromAddress(explicitFrom?: string): string {
  return (
    explicitFrom ||
    process.env.EMAIL_FROM ||
    process.env.ADMIN_EMAIL ||
    'no-reply@example.com'
  );
}

// Lazily initialized clients
let smtpTransporter: nodemailer.Transporter | null = null;
let mailgunClient: any | null = null;
let resendClient: any | null = null;
let sesClient: SES | null = null;

async function initSmtp() {
  if (smtpTransporter) return smtpTransporter;
  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT || 0);
  const secure =
    String(process.env.EMAIL_SECURE || '').toLowerCase() === 'true';
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;

  if (!host || !port || !user || !pass) {
    throw new Error(
      'SMTP is selected but EMAIL_HOST/EMAIL_PORT/EMAIL_USER/EMAIL_PASSWORD missing'
    );
  }

  smtpTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return smtpTransporter;
}

function initSendgrid() {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) throw new Error('SENDGRID_API_KEY missing');
  sgMail.setApiKey(key);
}

function initMailgun() {
  if (mailgunClient) return mailgunClient;
  const key = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  if (!key || !domain)
    throw new Error('MAILGUN_API_KEY/MAILGUN_DOMAIN missing');
  const mg = new Mailgun(FormData);
  mailgunClient = mg.client({ username: 'api', key });
  return mailgunClient;
}

function initResend() {
  if (resendClient) return resendClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY missing');
  resendClient = new Resend(key);
  return resendClient;
}

function initSes() {
  if (sesClient) return sesClient;
  const region = process.env.AWS_REGION || 'us-east-1';
  sesClient = new SES({ region });
  return sesClient;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  from,
}: SendMailInput): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const provider = getProvider();
    const fromAddr = getFromAddress(from);

    switch (provider) {
      case 'SMTP': {
        const transporter = await initSmtp();
        const info = await transporter.sendMail({
          from: fromAddr,
          to,
          subject,
          html,
          text,
        });
        return { success: true, id: info.messageId };
      }
      case 'SENDGRID': {
        initSendgrid();
        const [resp] = await sgMail.send({
          to,
          from: fromAddr,
          subject,
          html,
          text,
        });
        return { success: true, id: resp.headers['x-message-id'] as string };
      }
      case 'MAILGUN': {
        const mg = initMailgun();
        const domain = process.env.MAILGUN_DOMAIN!;
        const result = await mg.messages.create(domain, {
          from: fromAddr,
          to,
          subject,
          text,
          html,
        });
        return { success: true, id: result.id };
      }
      case 'RESEND': {
        const resend = initResend();
        const result = await resend.emails.send({
          from: fromAddr,
          to: Array.isArray(to) ? to : [to],
          subject,
          html,
          text,
        });
        return { success: true, id: (result as any).id };
      }
      case 'AWS_SES': {
        const ses = initSes();
        const params = new SendEmailCommand({
          Destination: { ToAddresses: Array.isArray(to) ? to : [to] },
          Message: {
            Body: {
              Html: html ? { Charset: 'UTF-8', Data: html } : undefined,
              Text: text ? { Charset: 'UTF-8', Data: text } : undefined,
            },
            Subject: { Charset: 'UTF-8', Data: subject },
          },
          Source: fromAddr,
        });
        const out = await ses.send(params);
        return { success: true, id: out.MessageId };
      }
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  } catch (error: any) {
    console.error('sendMail failed:', error);
    return { success: false, error: error?.message || 'sendMail failed' };
  }
}
