import { NextRequest, NextResponse } from 'next/server';
import { anonymizeText } from '@/lib/anonymization';
import {
  buildDrugInteractions,
  resolveDrugInteractionDetectorModel,
  resolveDrugInteractionExplainerModel,
  type DrugInteractionResult,
} from '@/lib/drug-interactions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const protocol = anonymizeText(String(body?.protocol ?? '')).trim();

    if (!protocol) {
      return NextResponse.json(
        { success: false, error: 'Текст протокола не передан.' },
        { status: 400 }
      );
    }

    const interactions: DrugInteractionResult[] = await buildDrugInteractions(protocol);
    return NextResponse.json({
      success: true,
      interactions,
      detectorModel: resolveDrugInteractionDetectorModel(),
      explainerModel: resolveDrugInteractionExplainerModel(),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Не удалось проверить взаимодействия.' },
      { status: 500 }
    );
  }
}
