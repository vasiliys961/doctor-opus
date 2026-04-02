import { NextRequest, NextResponse } from 'next/server';
import { resolvePublicBaseUrl } from '@/lib/hackathon/base-url';
import { buildMarketplaceConfig } from '@/lib/hackathon/marketplace-config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const baseUrl = resolvePublicBaseUrl(request);
  const config = buildMarketplaceConfig(baseUrl);

  return NextResponse.json(config, {
    headers: {
      'Cache-Control': 'public, max-age=300'
    }
  });
}
