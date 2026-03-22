/**
 * Сервис отправки email.
 * Провайдер выбирается через EMAIL_PROVIDER env (resend | smtp).
 * По умолчанию — Resend. Для Timeweb SMTP установите EMAIL_PROVIDER=smtp.
 */

import { getEmailProvider } from './email-provider';

/**
 * Отправка приветственного письма врачу
 */
export async function sendWelcomeEmail(email: string, name: string = 'коллега') {
  try {
    const provider = getEmailProvider();

    if (!provider) {
      console.warn('⚠️ [EMAIL] Провайдер не настроен. Письмо не отправлено.');
      return { success: false, error: 'Email provider not configured' };
    }

    const result = await provider.send({
      to: email,
      subject: 'Добро пожаловать в Doctor Opus, коллега! 🩺',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a202c;">
          <h1 style="color: #0d9488;">Добро пожаловать в Doctor Opus!</h1>
          <p>Здравствуйте, ${name}!</p>
          <p>Мы рады, что вы присоединились к нашему сообществу врачей, использующих искусственный интеллект для повышения точности анализа данных.</p>
          
          <div style="background-color: #f0fdfa; border: 1px solid #ccfbf1; padding: 20px; border-radius: 12px; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #0f766e;">🎁 Ваш бонус активирован</h3>
            <p style="margin-bottom: 0;">Для нового аккаунта доступно <strong>10 стартовых единиц</strong> для первых анализов. Далее вы сможете продолжить работу через подписку или пополнение.</p>
          </div>

          <h3 style="color: #0d9488;">Что можно сделать прямо сейчас:</h3>
          <ul style="line-height: 1.6;">
            <li><strong>Анализ изображений:</strong> Загрузите ЭКГ, рентгеновский снимок или DICOM-файл.</li>
            <li><strong>ИИ-Ассистент:</strong> Задайте сложный клинический вопрос экспертному ассистенту Opus.</li>
            <li><strong>Библиотека:</strong> Загрузите свои медицинские PDF для быстрого поиска по ним.</li>
          </ul>

          <p style="margin-top: 30px;">Если у вас возникнут вопросы, просто ответьте на это письмо.</p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
          <p style="font-size: 12px; color: #718096; text-align: center;">
            © ${new Date().getFullYear()} Doctor Opus — ИИ-ассистент с компетенциями профессора медицины.
          </p>
        </div>
      `,
    });

    if (!result.success) {
      console.error('❌ [EMAIL] Ошибка:', result.error);
      return result;
    }

    console.log(`✅ [EMAIL] Приветственное письмо отправлено (${provider.name}):`, email);
    return result;
  } catch (err) {
    console.error('❌ [EMAIL] Критическая ошибка отправки:', err);
    return { success: false, error: err };
  }
}

/**
 * Уведомление о подтвержденном пополнении баланса.
 */
export async function sendPaymentCreditedEmail(args: {
  email: string;
  amountRub: number;
  units: number;
  balanceAfter?: number | null;
  paymentId?: number;
  transactionId?: string;
}) {
  try {
    const provider = getEmailProvider();
    if (!provider) {
      console.warn('⚠️ [EMAIL] Провайдер не настроен. Уведомление о платеже не отправлено.');
      return { success: false, error: 'Email provider not configured' };
    }

    const amount = Number(args.amountRub || 0).toFixed(2);
    const units = Number(args.units || 0).toFixed(2);
    const balanceAfter =
      typeof args.balanceAfter === 'number' && Number.isFinite(args.balanceAfter)
        ? Number(args.balanceAfter).toFixed(2)
        : null;

    const txPart = args.transactionId
      ? `<p style="margin: 6px 0; color:#475569;"><strong>ID операции:</strong> ${args.transactionId}</p>`
      : '';
    const paymentPart = args.paymentId
      ? `<p style="margin: 6px 0; color:#475569;"><strong>ID платежа:</strong> #${args.paymentId}</p>`
      : '';
    const balancePart = balanceAfter
      ? `<p style="margin: 6px 0; color:#475569;"><strong>Текущий баланс:</strong> ${balanceAfter} ед.</p>`
      : '';

    return await provider.send({
      to: args.email,
      subject: 'Пополнение Doctor Opus подтверждено',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
          <h2 style="color: #0f766e;">Платеж подтвержден</h2>
          <p>Мы получили подтверждение оплаты и зачислили единицы на ваш баланс Doctor Opus.</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin:14px 0;">
            <p style="margin: 6px 0; color:#475569;"><strong>Сумма:</strong> ${amount} ₽</p>
            <p style="margin: 6px 0; color:#475569;"><strong>Зачислено:</strong> ${units} ед.</p>
            ${balancePart}
            ${paymentPart}
            ${txPart}
          </div>
          <p style="color:#64748b;">Если баланс в интерфейсе не обновился сразу, нажмите «Проверить оплату» на странице пакетов.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
          <p style="font-size:12px;color:#94a3b8;">Doctor Opus</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('❌ [EMAIL] Ошибка отправки уведомления о платеже:', err);
    return { success: false, error: err };
  }
}

/**
 * Письмо-приглашение в клинику (первичное или повторное).
 */
export async function sendClinicInviteEmail(args: {
  to: string;
  clinicName: string;
  role: 'owner' | 'admin' | 'doctor';
  isReminder?: boolean;
}) {
  try {
    const provider = getEmailProvider();
    if (!provider) {
      console.warn('⚠️ [EMAIL] Провайдер не настроен. Приглашение не отправлено.');
      return { success: false, error: 'Email provider not configured' };
    }

    const appUrl = process.env.NEXTAUTH_URL || 'https://doctor-opus.ru';
    const signInUrl = `${appUrl}/auth/signin`;
    const roleLabel =
      args.role === 'owner'
        ? 'Владелец'
        : args.role === 'admin'
          ? 'Администратор клиники'
          : 'Врач';

    const title = args.isReminder ? 'Напоминание о приглашении в Doctor Opus' : 'Приглашение в Doctor Opus';
    const header = args.isReminder ? 'Напоминаем о приглашении' : 'Вас пригласили в Doctor Opus';

    return await provider.send({
      to: args.to,
      subject: title,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
          <h2 style="color: #0f766e;">${header}</h2>
          <p>Для вас подготовлен доступ в клинику <strong>${args.clinicName}</strong>.</p>
          <p><strong>Роль:</strong> ${roleLabel}</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin:14px 0;">
            <p style="margin: 0 0 10px 0;">Чтобы воспользоваться приглашением, войдите или зарегистрируйтесь по ссылке:</p>
            <p style="margin:0;"><a href="${signInUrl}" style="color:#2563eb;">${signInUrl}</a></p>
          </div>
          <p style="color:#64748b;">После входа администратор клиники сможет активировать ваш доступ автоматически.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
          <p style="font-size:12px;color:#94a3b8;">Doctor Opus</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('❌ [EMAIL] Ошибка отправки приглашения:', err);
    return { success: false, error: err };
  }
}
