/**
 * Resend провайдер email (США).
 * Текущий провайдер по умолчанию.
 */

import { Resend } from 'resend';
import type { EmailProvider, EmailResult } from './email-provider';

let resendInstance: Resend | null = null;

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resendInstance) {
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

export class ResendEmailProvider implements EmailProvider {
  readonly name = 'Resend';

  async send(options: { to: string; subject: string; html: string; from?: string }): Promise<EmailResult> {
    const resend = getResend();
    if (!resend) {
      return { success: false, error: 'RESEND_API_KEY не настроен' };
    }

    const { data, error } = await resend.emails.send({
      from: options.from || process.env.RESEND_FROM || 'Doctor Opus <onboarding@resend.dev>',
      to: [options.to],
      subject: options.subject,
      html: options.html,
    });

    if (error) {
      return { success: false, error };
    }

    return { success: true, data };
  }
}
