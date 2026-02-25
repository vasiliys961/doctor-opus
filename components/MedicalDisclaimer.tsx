'use client'

interface MedicalDisclaimerProps {
  compact?: boolean;
}

export default function MedicalDisclaimer({ compact = false }: MedicalDisclaimerProps) {
  if (compact) {
    return (
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 leading-snug">
        <span className="font-bold">⚠️ For licensed healthcare professionals only.</span>{' '}
        This tool is NOT FDA-approved and does not constitute a medical diagnosis.
        The physician bears full responsibility for all clinical decisions.
      </div>
    );
  }

  return (
    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
      <p className="font-bold mb-2 flex items-center gap-2">
        ⚠️ Important Medical Disclaimer
      </p>
      <ul className="space-y-1 leading-relaxed">
        <li>• This tool is for use by <strong>licensed healthcare professionals only</strong>.</li>
        <li>• It is <strong>NOT FDA-approved</strong> and does not constitute a medical diagnosis or clinical opinion.</li>
        <li>• All AI-generated outputs are analytical drafts — not final medical reports.</li>
        <li>• The <strong>physician bears full and sole responsibility</strong> for any clinical decisions made using this tool.</li>
        <li>• This tool must not be used as the sole basis for any patient-care decision.</li>
      </ul>
    </div>
  );
}
