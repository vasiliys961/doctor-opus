import LegalPageLayout from '@/components/LegalPageLayout'

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="February 25, 2026">
      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">1. Introduction</h2>
        <p>
          This Privacy Policy describes how <strong>Doctor Opus</strong> ("we", "us", "our"), operated at
          <strong> doctor-opus.online</strong>, collects, uses, and protects information in connection with
          the use of our Clinical Decision Support System (CDSS) by licensed healthcare professionals.
          We are committed to safeguarding the privacy of our users and the confidentiality of any data
          processed through our platform.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">2. Data We Collect and How We Store It</h2>
        <p className="mb-3">
          <strong>2.1. Patient data:</strong> Doctor Opus is designed so that any patient-identifying
          information (name, date of birth, diagnosis) entered into the Patient Database feature is stored
          exclusively in the <strong>local storage (IndexedDB) of your browser</strong> and is never
          transmitted to our servers. We do not receive, store, or process personally identifiable patient
          information (PII) or protected health information (PHI) on our infrastructure.
        </p>
        <p className="mb-3">
          <strong>2.2. User account data:</strong> Physician account information (email address, hashed
          password, credit balance, and transaction history) is stored in a secured database on our servers.
          This data is used solely to provide the service.
        </p>
        <p>
          <strong>2.3. Medical imaging and analytical data:</strong> When you submit images or clinical
          data for AI analysis, our <strong>Three-Level Anonymization System</strong> is applied before
          any data is transmitted to third-party AI inference APIs (e.g., OpenRouter). This system removes
          or replaces all potential patient identifiers at the pixel and metadata level. We do not link
          analyzed medical content to individual patient identities on our servers.
        </p>
      </section>

      <section className="bg-blue-50 p-6 rounded-xl border border-blue-100">
        <p className="text-blue-900 font-medium mb-2">
          <strong>Key data protection principle:</strong>
        </p>
        <p className="text-blue-800">
          We do not receive or store your patients' personal health information on our servers.
          The patient database is implemented exclusively in your browser. During AI analysis,
          only anonymized pixel data is processed — no personal identifiers are transmitted.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">3. Three-Level Anonymization System</h2>
        <p className="mb-2">Before any clinical data reaches our AI inference partners, it passes through:</p>
        <ol className="list-decimal pl-5 space-y-2 text-gray-700">
          <li><strong>Level 1 — DICOM Metadata Stripping:</strong> All DICOM header tags containing patient demographics (name, ID, DOB, institution) are removed.</li>
          <li><strong>Level 2 — In-image Text Removal:</strong> OCR-based detection and masking of any visible text overlaid on imaging files.</li>
          <li><strong>Level 3 — Context Sanitization:</strong> The physician's clinical prompt is parsed to remove or replace any direct patient identifiers before being forwarded to the AI model.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">4. GDPR Considerations</h2>
        <p className="mb-3">
          For users accessing the service from the European Economic Area (EEA), we process your
          personal data (account data) on the lawful basis of <strong>contract performance</strong>
          (Article 6(1)(b) GDPR) and <strong>legitimate interests</strong> (Article 6(1)(f) GDPR).
        </p>
        <p className="mb-3">Your rights under GDPR include:</p>
        <ul className="list-disc pl-5 space-y-1 text-gray-700">
          <li>Right of access to your personal data</li>
          <li>Right to rectification of inaccurate data</li>
          <li>Right to erasure ("right to be forgotten")</li>
          <li>Right to data portability</li>
          <li>Right to object to processing</li>
        </ul>
        <p className="mt-3">
          To exercise any of these rights, contact us at: <strong>support@doctor-opus.online</strong>
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">5. HIPAA Notice</h2>
        <p>
          Doctor Opus is a software tool for licensed healthcare professionals and is not a Covered Entity
          or Business Associate as defined under the U.S. Health Insurance Portability and Accountability
          Act (HIPAA). By design, our platform does not receive, store, or transmit Protected Health
          Information (PHI) as defined by HIPAA. The physician is solely responsible for ensuring that
          any data submitted for analysis is properly de-identified in accordance with applicable law.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">6. Third-Party AI Services</h2>
        <p>
          Doctor Opus uses OpenRouter as an API gateway to access large language model (LLM) inference
          services. Data submitted to these services is governed by OpenRouter's privacy policy and
          the policies of individual model providers. Only anonymized data passes through these channels,
          as described in Section 3.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">7. Cookies</h2>
        <p className="mb-4">
          We use only technically necessary cookies required for secure session management:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border p-2">Name</th>
                <th className="border p-2">Purpose</th>
                <th className="border p-2">Lifetime</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-2 font-mono">next-auth.session-token</td>
                <td className="border p-2">Active physician session identifier</td>
                <td className="border p-2">30 days</td>
              </tr>
              <tr>
                <td className="border p-2 font-mono">next-auth.callback-url</td>
                <td className="border p-2">Technical redirect parameter</td>
                <td className="border p-2">Session</td>
              </tr>
              <tr>
                <td className="border p-2 font-mono">cookie-consent</td>
                <td className="border p-2">Stores user cookie preference</td>
                <td className="border p-2">1 year</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-gray-500">
          We do not use tracking, advertising, or analytics cookies.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">8. Data Retention and Deletion</h2>
        <p>
          Account data is retained for the duration of your subscription and for a reasonable period
          thereafter for legal and accounting purposes. You may request deletion of your account and
          associated data at any time by contacting <strong>support@doctor-opus.online</strong>.
          Patient data stored in your browser can be deleted at any time through your browser's
          storage settings.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">9. Contact</h2>
        <p>
          For any privacy-related inquiries or data subject requests, contact us at:<br />
          <strong>Email:</strong> support@doctor-opus.online<br />
          <strong>Website:</strong> https://doctor-opus.online
        </p>
      </section>
    </LegalPageLayout>
  )
}
