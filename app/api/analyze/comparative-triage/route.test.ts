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

vi.mock('@/lib/openrouter', () => ({
  MODELS: {
    GEMINI_3_FLASH: 'google/gemini-3-flash',
  },
  sendTextRequest: vi.fn(),
}));

import { getServerSession } from 'next-auth/next';
import { checkAndDeductBalance } from '@/lib/server-billing';
import { sendTextRequest } from '@/lib/openrouter';
import { POST } from './route';

describe('POST /api/analyze/comparative-triage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as any);

    const request = new Request('http://localhost/api/analyze/comparative-triage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ comparisonText: 'Any text' }),
    });

    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it('returns 402 and does not call model when billing blocks request', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: 'doctor@example.com' },
    } as any);
    vi.mocked(checkAndDeductBalance).mockResolvedValue({
      allowed: false,
      error: 'Insufficient balance',
    });

    const request = new Request('http://localhost/api/analyze/comparative-triage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        comparisonText: 'Progression of bilateral infiltrates compared to previous study.',
        comparisonMode: 'xray',
      }),
    });

    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(402);
    expect(body.success).toBe(false);
    expect(sendTextRequest).not.toHaveBeenCalled();
  });
});
