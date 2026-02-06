/**
 * SMTP провайдер email (Timeweb / любой SMTP-сервер в РФ).
 * 
 * Для активации установите в .env:
 *   EMAIL_PROVIDER=smtp
 *   SMTP_HOST=smtp.timeweb.ru
 *   SMTP_PORT=465
 *   SMTP_USER=support@doctor-opus.ru
 *   SMTP_PASS=пароль
 *   SMTP_FROM=Doctor Opus <support@doctor-opus.ru>
 * 
 * Требует: npm install nodemailer
 * Типы: npm install -D @types/nodemailer
 */

import type { EmailProvider, EmailResult } from './email-provider';

export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'SMTP (Timeweb)';

  async send(options: { to: string; subject: string; html: string; from?: string }): Promise<EmailResult> {
    try {
      // Динамический импорт nodemailer (не ломает сборку если не установлен)
      let nodemailer: any;
      try {
        nodemailer = require('nodemailer');
      } catch {
        return {
          success: false,
          error: 'nodemailer не установлен. Выполните: npm install nodemailer @types/nodemailer',
        };
      }

      const host = process.env.SMTP_HOST || 'smtp.timeweb.ru';
      const port = parseInt(process.env.SMTP_PORT || '465');
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      const from = options.from || process.env.SMTP_FROM || `Doctor Opus <${user}>`;

      if (!user || !pass) {
        return { success: false, error: 'SMTP_USER и SMTP_PASS не настроены' };
      }

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true для 465 (SSL), false для 587 (STARTTLS)
        auth: { user, pass },
        tls: {
          // Timeweb может использовать самоподписанный сертификат
          rejectUnauthorized: false,
        },
      });

      const info = await transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      console.log(`✅ [SMTP] Письмо отправлено: ${options.to} (messageId: ${info.messageId})`);

      return { success: true, data: { messageId: info.messageId } };
    } catch (error: any) {
      console.error('❌ [SMTP] Ошибка отправки:', error.message);
      return { success: false, error: error.message };
    }
  }
}
