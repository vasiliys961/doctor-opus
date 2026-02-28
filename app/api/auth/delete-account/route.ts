import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { deleteUserAccount } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Authorization required' },
        { status: 401 }
      );
    }

    const result = await deleteUserAccount(session.user.email);

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Account deleted successfully' });
    } else {
      throw new Error('Failed to delete account data from database');
    }
  } catch (error: any) {
    console.error('❌ [DELETE ACCOUNT API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Account deletion error' },
      { status: 500 }
    );
  }
}
