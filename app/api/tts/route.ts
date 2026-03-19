import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { text } = await req.json()

  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'Текст не передан' }, { status: 400 })
  }

  const apiKey = process.env.DEWIAR_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'DEWIAR_API_KEY не задан' }, { status: 500 })
  }

  // Dewiar принимает до 1000 символов — обрезаем
  const truncated = text.substring(0, 1000)

  const form = new FormData()
  form.append('api_key', apiKey)
  form.append('text', truncated)
  form.append('mode', 'clone')
  form.append('voice', 'builtin:Ryan')
  form.append('language', 'Russian')

  let response: Response
  try {
    response = await fetch('https://dewiar.com/tts-sys/tts-api', {
      method: 'POST',
      body: form,
    })
  } catch (err) {
    console.error('[TTS] Dewiar fetch error:', err)
    return NextResponse.json({ error: 'Dewiar недоступен' }, { status: 502 })
  }

  if (!response.ok) {
    const errText = await response.text()
    console.error('[TTS] Dewiar error:', response.status, errText)
    return NextResponse.json({ error: `Dewiar: ${response.status}` }, { status: 502 })
  }

  const contentType = response.headers.get('content-type') || 'audio/mpeg'
  const audioBuffer = await response.arrayBuffer()

  return new NextResponse(audioBuffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    },
  })
}
