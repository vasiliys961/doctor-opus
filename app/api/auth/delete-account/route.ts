import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { deleteUserAccount } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Необходима авторизация' },
        { status: 401 }
      );
    }

    const result = await deleteUserAccount(session.user.email);

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Аккаунт успешно удален' });
    } else {
      throw new Error('Ошибка при удалении данных из БД');
    }
  } catch (error: any) {
    console.error('❌ [DELETE ACCOUNT API] Ошибка:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка удаления аккаунта' },
      { status: 500 }
    );
  }
}
