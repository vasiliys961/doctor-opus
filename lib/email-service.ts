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
