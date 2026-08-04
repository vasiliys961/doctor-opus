import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { checkRateLimit, RATE_LIMIT_CHAT, getRateLimitKey } from '@/lib/rate-limiter';
import { classifyDeviceIntake } from '@/lib/device-intake/classifier';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const MAX_FILES = 20;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;

function isFileLike(value: FormDataEntryValue): value is File {
  if (typeof value === 'string') return false;
  return !!value &&
    typeof (value as any).name === 'string' &&
    typeof (value as any).size === 'number' &&
    typeof (value as any).type === 'string';
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Authorization required' }, { status: 401 });
    }

    const rlKey = getRateLimitKey(request, session.user.email);
    const rl = checkRateLimit(rlKey, RATE_LIMIT_CHAT);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Please wait.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }

    const formData = await request.formData();
    const fileEntries = formData.getAll('files').filter(isFileLike);
    if (fileEntries.length === 0) {
      return NextResponse.json({ success: false, error: 'No files provided' }, { status: 400 });
    }

    const totalBytes = fileEntries.reduce((sum, file) => sum + file.size, 0);
    if (fileEntries.length > MAX_FILES || totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many files. Max ${MAX_FILES} files and ${(MAX_TOTAL_BYTES / (1024 * 1024)).toFixed(0)} MB total.`,
        },
        { status: 413 }
      );
    }

    const files = fileEntries.map((file) => ({
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
    }));

    const result = classifyDeviceIntake(files);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Device intake failed' },
      { status: 500 }
    );
  }
}
