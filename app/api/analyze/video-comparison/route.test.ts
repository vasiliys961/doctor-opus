import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/server-billing', () => ({
  checkAndDeductBalance: vi.fn(),
}));

vi.mock('@/lib/video', () => ({
  analyzeTwoVideosTwoStage: vi.fn(),
}));

import { getServerSession } from 'next-auth/next';
import { checkAndDeductBalance } from '@/lib/server-billing';
import { analyzeTwoVideosTwoStage } from '@/lib/video';
import { POST } from './route';

describe('POST /api/analyze/video-comparison', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = 'test-key';
  });

  it('returns 401 without auth', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as any);

    const request = new Request('http://localhost/api/analyze/video-comparison', {
      method: 'POST',
      body: new FormData(),
    });

    const response = await POST(request as any);
    expect(response.status).toBe(401);
  });

  it('returns 402 when billing denies access', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: 'doctor@example.com' },
    } as any);
    vi.mocked(checkAndDeductBalance).mockResolvedValue({
      allowed: false,
      error: 'Insufficient balance',
    });

    const video1 = new File([new Uint8Array([1, 2, 3])], 'before.mp4', { type: 'video/mp4' });
    const video2 = new File([new Uint8Array([4, 5, 6])], 'after.mp4', { type: 'video/mp4' });
    const formData = new FormData();
    formData.append('video1', video1);
    formData.append('video2', video2);

    const request = new Request('http://localhost/api/analyze/video-comparison', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(402);
    expect(body.success).toBe(false);
    expect(analyzeTwoVideosTwoStage).not.toHaveBeenCalled();
  });
});
