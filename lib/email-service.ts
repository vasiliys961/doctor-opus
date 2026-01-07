import { Resend } from 'resend';

// Не инициализируем сразу, чтобы не ломать сборку на Vercel
let resendInstance: Resend | null = null;

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resendInstance) {
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

/**
 * Отправка приветственного письма врачу
 */
export async function sendWelcomeEmail(email: string, name: string = 'коллега') {
  try {
    const resend = getResend();
    
    if (!resend) {
      console.warn('⚠️ [EMAIL] RESEND_API_KEY не настроен или пуст. Письмо не отправлено.');
      return { success: false, error: 'API Key missing' };
    }

    const { data, error } = await resend.emails.send({
      from: 'Doctor Opus <onboarding@resend.dev>', // Позже замените на свой домен
      to: [email],
      subject: 'Добро пожаловать в Doctor Opus, коллега! 🩺',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a202c;">
          <h1 style="color: #0d9488;">Добро пожаловать в Doctor Opus!</h1>
          <p>Здравствуйте, ${name}!</p>
          <p>Мы рады, что вы присоединились к нашему сообществу врачей, использующих искусственный интеллект для повышения точности диагностики.</p>
          
          <div style="background-color: #f0fdfa; border: 1px solid #ccfbf1; padding: 20px; border-radius: 12px; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #0f766e;">🎁 Ваш бонус активирован</h3>
            <p style="margin-bottom: 0;">За регистрацию на ваш баланс зачислено <strong>дополнительно 20 единиц</strong>. Теперь вам доступно 30 единиц для проведения анализов любой сложности (ЭКГ, МРТ, КТ и др.).</p>
          </div>

          <h3 style="color: #0d9488;">Что можно сделать прямо сейчас:</h3>
          <ul style="line-height: 1.6;">
            <li><strong>Анализ изображений:</strong> Загрузите ЭКГ, рентгеновский снимок или DICOM-файл.</li>
            <li><strong>ИИ-Консультант:</strong> Задайте сложный клинический вопрос профессору Opus.</li>
            <li><strong>Библиотека:</strong> Загрузите свои медицинские PDF для быстрого поиска по ним.</li>
          </ul>

          <p style="margin-top: 30px;">Если у вас возникнут вопросы, просто ответьте на это письмо.</p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
          <p style="font-size: 12px; color: #718096; text-align: center;">
            © ${new Date().getFullYear()} Doctor Opus — ИИ-ассистент профессора медицины.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('❌ [EMAIL] Ошибка Resend:', error);
      return { success: false, error };
    }

    console.log('✅ [EMAIL] Приветственное письмо отправлено:', email);
    return { success: true, data };
  } catch (err) {
    console.error('❌ [EMAIL] Критическая ошибка отправки:', err);
    return { success: false, error: err };
  }
}

