'use client'

interface MedicalDisclaimerProps {
  compact?: boolean;
}

export default function MedicalDisclaimer({ compact = false }: MedicalDisclaimerProps) {
  if (compact) {
    return (
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 leading-snug">
        <span className="font-bold">⚠️ Beta clinical support software.</span>{' '}
        For licensed healthcare professionals only. AI outputs may be inaccurate and depend on third-party LLM capabilities.
        Mandatory physician verification is required before any clinical decision.
      </div>
    );
  }

  return (
    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
      <p className="font-bold mb-2 flex items-center gap-2">
        ⚠️ Important Medical Disclaimer
      </p>
      <ul className="space-y-1 leading-relaxed">
        <li>• This service is in <strong>beta</strong>; some functions may work with limited accuracy.</li>
        <li>• This tool is for use by <strong>licensed healthcare professionals only</strong>.</li>
        <li>• AI outputs depend on third-party LLM/model availability and may be incomplete or inaccurate.</li>
        <li>• It is not a medical device and does not constitute a final diagnosis or treatment order.</li>
        <li>• All AI-generated outputs are analytical drafts and must be independently verified by a physician.</li>
        <li>• The <strong>physician bears full and sole responsibility</strong> for any clinical decisions made using this tool.</li>
        <li>• This tool must not be used as the sole basis for any patient-care decision or direct patient self-diagnosis.</li>
        <li>• Intended-use restriction: not intended for regulated clinical deployment in EU/US/UK jurisdictions.</li>
      </ul>
    </div>
  );
}
