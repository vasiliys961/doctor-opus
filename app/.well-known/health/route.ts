import { NextRequest, NextResponse } from 'next/server';
import { resolvePublicBaseUrl } from '@/lib/hackathon/base-url';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const baseUrl = resolvePublicBaseUrl(request);
  const now = new Date().toISOString();

  const checks = {
    base_url_resolved: Boolean(baseUrl),
    env_next_public_app_url: Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim()),
    env_nextauth_url: Boolean(process.env.NEXTAUTH_URL?.trim())
  };

  const healthy = checks.base_url_resolved;

  return NextResponse.json(
    {
      service: 'doctor-opus-hackathon-well-known',
      status: healthy ? 'ok' : 'degraded',
      timestamp: now,
      version: '1.0.0',
      baseUrl,
      endpoints: {
        agentCard: `${baseUrl}/.well-known/agent.json`,
        marketplaceConfig: `${baseUrl}/.well-known/marketplace-config.json`,
        health: `${baseUrl}/.well-known/health`
      },
      checks
    },
    {
      headers: {
        'Cache-Control': 'no-store'
      }
    }
  );
}
