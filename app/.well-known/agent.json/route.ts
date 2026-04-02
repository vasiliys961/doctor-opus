import { NextRequest, NextResponse } from 'next/server';
import { buildDoctorOpusAgentCard } from '@/lib/hackathon/agent-card';
import { resolvePublicBaseUrl } from '@/lib/hackathon/base-url';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const baseUrl = resolvePublicBaseUrl(request);
  const card = buildDoctorOpusAgentCard(baseUrl);

  return NextResponse.json(card, {
    headers: {
      'Cache-Control': 'public, max-age=300'
    }
  });
}
