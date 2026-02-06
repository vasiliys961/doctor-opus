/**
 * Универсальный интерфейс провайдера email-рассылки.
 * Позволяет переключаться между Resend и Timeweb SMTP
 * через env: EMAIL_PROVIDER=resend | smtp
 * 
 * По умолчанию — Resend. Для Timeweb SMTP установите:
 *   EMAIL_PROVIDER=smtp
 *   SMTP_HOST=smtp.timeweb.ru
 *   SMTP_PORT=465
 *   SMTP_USER=support@doctor-opus.ru
 *   SMTP_PASS=пароль
 *   SMTP_FROM=Doctor Opus <support@doctor-opus.ru>
 */

export interface EmailResult {
  success: boolean;
  data?: any;
  error?: any;
}

export interface EmailProvider {
  readonly name: string;
  send(options: {
    to: string;
    subject: string;
    html: string;
    from?: string;
  }): Promise<EmailResult>;
}

/**
 * Возвращает актуальный провайдер email.
 * По умолчанию — Resend. Для SMTP установите EMAIL_PROVIDER=smtp.
 */
export function getEmailProvider(): EmailProvider | null {
  const provider = process.env.EMAIL_PROVIDER || 'resend';

  switch (provider.toLowerCase()) {
    case 'smtp':
    case 'timeweb': {
      const host = process.env.SMTP_HOST;
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      if (!host || !user || !pass) {
        console.warn('⚠️ [EMAIL] SMTP не настроен (SMTP_HOST, SMTP_USER, SMTP_PASS). Письма не отправляются.');
        return null;
      }
      const { SmtpEmailProvider } = require('./smtp-email');
      return new SmtpEmailProvider();
    }
    case 'resend':
    default: {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        console.warn('⚠️ [EMAIL] RESEND_API_KEY не настроен. Письма не отправляются.');
        return null;
      }
      const { ResendEmailProvider } = require('./resend-email');
      return new ResendEmailProvider();
    }
  }
}
