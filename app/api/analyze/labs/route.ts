import { NextResponse } from 'next/server';
import { MODELS } from '@/lib/openrouter';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { checkAndDeductBalance, checkAndDeductGuestBalance } from '@/lib/server-billing';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const LABS_ANALYSIS_COST = 1.5;

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email || null;
    const guestKey = userEmail
      ? null
      : (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'guest:labs');

    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'Файл не предоставлен' }, { status: 400 });
    }

    const billing = userEmail
      ? await checkAndDeductBalance(userEmail, LABS_ANALYSIS_COST, 'Legacy labs analysis', {
          source: 'analyze_labs_legacy',
          fileName: file.name,
          fileType: file.type || 'unknown',
          fileSize: file.size,
        })
      : await checkAndDeductGuestBalance(guestKey, LABS_ANALYSIS_COST, 'Guest trial: legacy labs analysis', {
          source: 'analyze_labs_legacy',
          fileName: file.name,
          fileType: file.type || 'unknown',
          fileSize: file.size,
        });
    if (!billing.allowed) {
      return NextResponse.json(
        { success: false, error: billing.error || 'Недостаточно единиц для анализа лабораторных данных' },
        { status: 402 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || 'image/png';

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const payload = {
      model: MODELS.GEMINI_3_FLASH,
      messages: [
        {
          role: 'system',
          content: 'Ты — медицинский ассистент, специализирующийся на оцифровке лабораторных анализов. Твоя задача — извлечь все показатели, их значения и референсные интервалы. Верни результат в виде структурированного текста.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Извлеки все данные из этого лабораторного анализа. Укажи название теста, результат, единицы измерения и референсные значения. Если есть отклонения, пометь их.'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`
              }
            }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.1
    };

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://doctor-opus.ru',
        'X-Title': 'Doctor Opus',
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    const labsText = data.choices?.[0]?.message?.content || 'Не удалось извлечь данные';

    return NextResponse.json({ success: true, labsText });

  } catch (error: any) {
    console.error('Labs analysis error:', error);
    return NextResponse.json({ error: 'Ошибка анализа лабораторных данных' }, { status: 500 });
  }
}

