import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { savePatientNote, getPatientNotes, initDatabase } from "@/lib/database";

/**
 * API endpoint для работы с медицинскими записями
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.patient_id) {
      return NextResponse.json(
        { success: false, error: 'patient_id is required' },
        { status: 400 }
      );
    }

    // Инициализация БД
    await initDatabase();

    const result = await savePatientNote({
      patient_id: parseInt(body.patient_id),
      raw_text: body.raw_text,
      structured_note: body.structured_note,
      gdoc_url: body.gdoc_url,
      diagnosis: body.diagnosis
    });

    if (!result.success) {
      throw new Error(result.error as any);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error saving note:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patient_id');

    // Инициализация БД
    await initDatabase();

    const result = await getPatientNotes(patientId || undefined);

    if (!result.success) {
      throw new Error(result.error as any);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching notes:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

