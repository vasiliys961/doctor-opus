import LegalPageLayout from '@/components/LegalPageLayout'

export default function ConsentPage() {
  return (
    <LegalPageLayout title="Clinical Decision Support Tool — Acknowledgment and Informed Consent" lastUpdated="February 25, 2026">
      <section className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
        <p className="font-bold text-amber-900 mb-2">
          ⚠️ This document must be read and acknowledged before using Doctor Opus.
        </p>
        <p className="text-amber-800 text-sm">
          By checking the "I agree" box during registration, you confirm that you have read,
          understood, and agree to all provisions set forth below.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">1. Professional Use Only</h2>
        <p>
          Doctor Opus is a Clinical Decision Support System (CDSS) designed exclusively for use by
          <strong> licensed healthcare professionals</strong> (physicians, nurse practitioners, and
          equivalent credentialed clinicians). By registering and using this Service, you represent
          and warrant that you hold a valid, current, and unrestricted professional license in your
          jurisdiction.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">2. Not a Medical Device — Not FDA Approved</h2>
        <p className="mb-3">
          Doctor Opus is a <strong>software information tool</strong> and is <strong>NOT a medical device</strong>.
          It has not been evaluated, cleared, or approved by the U.S. Food and Drug Administration (FDA),
          the European Medicines Agency (EMA), or any other regulatory authority for use as a diagnostic
          or therapeutic medical device.
        </p>
        <p>
          The outputs of this system — including all AI-generated reports, clinical hypotheses,
          differential diagnoses, and analytical summaries — are <strong>informational drafts only</strong>.
          They do not constitute, and must not be treated as, a final medical opinion, diagnosis,
          or treatment recommendation.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">3. Physician's Full Clinical Responsibility</h2>
        <p className="mb-3">
          You, as the licensed healthcare professional, bear <strong>full and sole clinical and legal
          responsibility</strong> for all decisions made in the diagnosis and treatment of your patients.
          The AI-generated content provided by Doctor Opus is a supplementary analytical tool and must
          always be critically evaluated and verified against the complete clinical picture by a qualified
          physician before any clinical action is taken.
        </p>
        <p>
          Doctor Opus does not replace clinical judgment, physical examination, patient history,
          or the physician-patient relationship.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">4. Anonymization of Patient Data</h2>
        <p>
          When submitting clinical data (images, lab values, clinical notes) for AI analysis, you agree
          to ensure that all data has been properly de-identified to the extent required by applicable
          law in your jurisdiction (e.g., HIPAA Safe Harbor in the US, GDPR in the EU). Doctor Opus
          applies its Three-Level Anonymization System as an additional safeguard, but the primary
          responsibility for data de-identification rests with the submitting physician.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">5. Cross-Border Data Transfer</h2>
        <p>
          By using this Service, you acknowledge and consent to the transmission of anonymized analytical
          data to third-party AI inference services (via OpenRouter and associated model providers),
          which may be located in countries outside your jurisdiction. Only anonymized data is
          transmitted, as described in our Privacy Policy.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">6. Limitation of AI Accuracy</h2>
        <p>
          You acknowledge that AI models may produce inaccurate, incomplete, or misleading outputs.
          Factors affecting AI accuracy include image quality, atypical clinical presentations,
          rare conditions, and limitations inherent to the underlying models. All AI-generated content
          must be reviewed and verified by a qualified physician.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">7. Summary of Acknowledgments</h2>
        <p className="mb-3">By registering, you confirm that you:</p>
        <ul className="list-disc pl-5 space-y-2 text-gray-700">
          <li>Are a licensed healthcare professional</li>
          <li>Understand that Doctor Opus is NOT a medical device and is NOT FDA-approved</li>
          <li>Understand that AI outputs do not constitute a medical diagnosis</li>
          <li>Accept full clinical responsibility for all decisions made using this tool</li>
          <li>Agree to de-identify patient data before submission</li>
          <li>Consent to anonymized data being transmitted to third-party AI services</li>
          <li>Have read and agree to the Terms of Service and Privacy Policy</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">8. Contact</h2>
        <p>
          For questions regarding this acknowledgment, contact us at:<br />
          <strong>Email:</strong> support@doctor-opus.online
        </p>
      </section>
    </LegalPageLayout>
  )
}
