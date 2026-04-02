import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { anonymizeObject } from '@/lib/anonymization';
import { safeErrorMessage } from '@/lib/safe-error';
import { buildFhirBundle } from '@/lib/hackathon/fhir';
import { FhirBundleBuildInput } from '@/lib/hackathon/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Authorization required' }, { status: 401 });
    }

    const body = anonymizeObject(await request.json()) as FhirBundleBuildInput;
    if (!body?.patient) {
      return NextResponse.json({ success: false, error: 'Invalid payload: patient is required' }, { status: 400 });
    }

    const bundle = buildFhirBundle(body);
    return NextResponse.json({ success: true, bundle });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: safeErrorMessage(error, 'FHIR conversion failed') }, { status: 500 });
  }
}
