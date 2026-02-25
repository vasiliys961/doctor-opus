import LegalPageLayout from '@/components/LegalPageLayout'

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated="February 25, 2026">
      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">1. Acceptance of Terms</h2>
        <p>
          By registering for or using <strong>Doctor Opus</strong> ("the Service"), accessible at
          <strong> doctor-opus.online</strong>, you agree to be bound by these Terms of Service.
          If you do not agree to these terms, you must not use the Service. The Service is intended
          exclusively for <strong>licensed healthcare professionals</strong>.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">2. Nature of the Service</h2>
        <p className="mb-3">
          Doctor Opus is a <strong>Clinical Decision Support System (CDSS)</strong> — an AI-powered
          analytical software tool that assists licensed physicians in interpreting medical imaging,
          laboratory data, ECG recordings, and clinical notes.
        </p>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="font-bold text-red-900 mb-2">⚠️ Important Legal Notice</p>
          <ul className="text-red-800 space-y-1 text-sm">
            <li>• Doctor Opus is NOT a medical device and is NOT FDA-cleared or CE-marked.</li>
            <li>• The Service does NOT provide medical diagnoses, treatment recommendations, or clinical opinions.</li>
            <li>• Outputs from the Service are analytical drafts and clinical hypotheses — NOT final medical reports.</li>
            <li>• The licensed physician bears full and sole responsibility for all clinical decisions made.</li>
            <li>• The Service must not be used as the sole basis for any clinical decision affecting patient care.</li>
          </ul>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">3. Eligibility</h2>
        <p>
          You must be a licensed healthcare professional (physician, nurse practitioner, or equivalent)
          in your jurisdiction to use this Service. By creating an account, you represent and warrant that
          you hold a valid and current healthcare license. Use of the Service by patients, students without
          clinical supervision, or unlicensed individuals is strictly prohibited.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">4. Credit System and Payments</h2>
        <p className="mb-3">
          4.1. The Service operates on a prepaid credit system. Credits are purchased in advance and
          consumed per analytical operation.
        </p>
        <p className="mb-3">
          4.2. Payments are processed through NOWPayments, a third-party crypto/fiat payment gateway.
          We accept cryptocurrency and select fiat payment methods as listed on the pricing page.
        </p>
        <p>
          4.3. All prices are stated in US Dollars (USD). Credits are non-refundable except as
          expressly provided in our Refund Policy.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">5. Prohibited Use</h2>
        <p className="mb-2">You agree not to:</p>
        <ul className="list-disc pl-5 space-y-1 text-gray-700">
          <li>Use the Service to make autonomous clinical decisions without physician review</li>
          <li>Submit real patient data without proper de-identification</li>
          <li>Reverse-engineer, decompile, or attempt to extract the underlying AI models</li>
          <li>Resell, white-label, or redistribute the Service without written authorization</li>
          <li>Violate any applicable law or medical regulation in your jurisdiction</li>
          <li>Use the Service if your professional license has been suspended or revoked</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">6. Limitation of Liability</h2>
        <p className="mb-3">
          To the maximum extent permitted by applicable law, Doctor Opus and its operators shall not
          be liable for any direct, indirect, incidental, special, or consequential damages arising from
          your use of or reliance on the Service, including but not limited to any adverse patient
          outcomes, misdiagnosis, or treatment errors.
        </p>
        <p>
          The Service is provided "AS IS" and "AS AVAILABLE" without warranties of any kind, express
          or implied, including without limitation any warranties of merchantability, fitness for a
          particular purpose, or non-infringement.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">7. Intellectual Property</h2>
        <p>
          All content, design, algorithms, prompts, and code comprising the Service are the exclusive
          intellectual property of Doctor Opus. Unauthorized reproduction, white-labeling, resale, or
          commercial use of any part of the Service without prior written consent is strictly prohibited.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">8. Governing Law</h2>
        <p>
          These Terms shall be governed by and construed in accordance with generally accepted principles
          of international commercial law. Any disputes shall be resolved through binding arbitration
          or in a court of competent jurisdiction.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">9. Changes to Terms</h2>
        <p>
          We reserve the right to modify these Terms at any time. Material changes will be communicated
          to registered users by email. Continued use of the Service after such notification constitutes
          acceptance of the revised Terms.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">10. Contact</h2>
        <p>
          For questions regarding these Terms, contact us at:<br />
          <strong>Email:</strong> support@doctor-opus.online
        </p>
      </section>
    </LegalPageLayout>
  )
}
