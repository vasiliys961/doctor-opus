import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { anonymizeObject } from '@/lib/anonymization';
import { safeErrorMessage } from '@/lib/safe-error';
import { executeHackathonMcpTool, listHackathonMcpTools } from '@/lib/hackathon/mcp';
import { HackathonMcpToolCall } from '@/lib/hackathon/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: 'Authorization required' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    tools: listHackathonMcpTools()
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Authorization required' }, { status: 401 });
    }

    const body = anonymizeObject(await request.json()) as HackathonMcpToolCall;
    if (!body?.tool) {
      return NextResponse.json({ success: false, error: 'Invalid payload: tool is required' }, { status: 400 });
    }

    const output = executeHackathonMcpTool(body);
    return NextResponse.json({ success: true, ...output });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: safeErrorMessage(error, 'MCP execution failed') }, { status: 500 });
  }
}
