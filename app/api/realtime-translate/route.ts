import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { findTranslatorLanguage } from '@/lib/realtime-translate'

export const runtime = 'nodejs'

const CLIENT_SECRET_URL = 'https://api.openai.com/v1/realtime/translations/client_secrets'
const CALLS_URL = 'https://api.openai.com/v1/realtime/translations/calls'

function readSecretValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && typeof (value as { value?: unknown }).value === 'string') {
    return (value as { value: string }).value
  }
  return ''
}

function readClientSecret(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const body = payload as {
    value?: unknown
    client_secret?: unknown
    session?: { client_secret?: unknown; value?: unknown }
  }
  return (
    readSecretValue(body.value) ||
    readSecretValue(body.client_secret) ||
    readSecretValue(body.session?.client_secret) ||
    readSecretValue(body.session?.value)
  )
}

function publicError(text: string): string {
  return text
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .slice(0, 300)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Authorization required', code: 'unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'API key is not configured', code: 'missing_api_key' },
      { status: 500 }
    )
  }

  let sourceLanguage = ''
  let targetLanguage = ''
  let offerSdp = ''
  try {
    const body = await request.json()
    sourceLanguage = String(body?.sourceLanguage || '')
    targetLanguage = String(body?.targetLanguage || '')
    offerSdp = typeof body?.sdp === 'string' ? body.sdp : ''
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'invalid_json' }, { status: 400 })
  }

  const source = findTranslatorLanguage(sourceLanguage)
  const target = findTranslatorLanguage(targetLanguage)
  if (!source || !target) {
    return NextResponse.json({ error: 'Unknown language', code: 'unknown_language' }, { status: 400 })
  }
  if (!target.outputCode) {
    return NextResponse.json(
      { error: 'This language cannot be spoken by the translation model.', code: 'unspeakable_target' },
      { status: 400 }
    )
  }
  if (source.code === target.code) {
    return NextResponse.json({ error: 'Choose two different languages.', code: 'same_language' }, { status: 400 })
  }

  try {
    const upstream = await fetch(CLIENT_SECRET_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: {
          model: 'gpt-realtime-translate',
          audio: {
            input: {
              transcription: { model: 'gpt-realtime-whisper' },
              noise_reduction: { type: 'near_field' },
            },
            output: { language: target.outputCode },
          },
        },
      }),
    })

    const payload = await upstream.json().catch(() => null)
    if (!upstream.ok) {
      const message = typeof payload?.error?.message === 'string'
        ? payload.error.message
        : typeof payload?.error === 'string'
          ? payload.error
          : 'OpenAI rejected the translation session'
      return NextResponse.json(
        { error: publicError(message), code: 'client_secret' },
        { status: upstream.status }
      )
    }

    const clientSecret = readClientSecret(payload)
    if (!clientSecret || clientSecret.startsWith('sk-')) {
      return NextResponse.json(
        { error: 'OpenAI did not return a client secret', code: 'client_secret' },
        { status: 502 }
      )
    }

    if (!offerSdp.startsWith('v=')) {
      return NextResponse.json({ clientSecret })
    }

    const sdpResponse = await fetch(CALLS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${clientSecret}`,
        'Content-Type': 'application/sdp',
      },
      body: offerSdp,
    })
    const answerSdp = await sdpResponse.text()
    if (!sdpResponse.ok || !answerSdp.startsWith('v=')) {
      return NextResponse.json(
        { error: publicError(answerSdp || 'OpenAI rejected the WebRTC offer'), code: 'webrtc' },
        { status: sdpResponse.ok ? 502 : sdpResponse.status }
      )
    }

    return NextResponse.json({ answerSdp })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Translation session failed'
    return NextResponse.json({ error: publicError(message), code: 'client_secret' }, { status: 502 })
  }
}
