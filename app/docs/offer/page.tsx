import LegalPageLayout from '@/components/LegalPageLayout'

export default function OfferPage() {
  return (
    <LegalPageLayout title="SaaS Subscription Agreement" lastUpdated="February 25, 2026">
      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">1. Parties</h2>
        <p>
          This SaaS Subscription Agreement ("Agreement") governs access to and use of the Doctor Opus
          Clinical Decision Support System ("Service"), operated at <strong>doctor-opus.online</strong>
          ("Provider"), by the registered user ("Subscriber") who is a licensed healthcare professional.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">2. Service Description</h2>
        <p>
          The Provider grants the Subscriber a non-exclusive, non-transferable, revocable license to
          access and use the Service on a prepaid credit basis for the purpose of clinical decision
          support in the Subscriber's licensed medical practice.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">3. License Scope and Restrictions</h2>
        <p className="mb-2">The license granted herein is limited to the following:</p>
        <ul className="list-disc pl-5 space-y-1 text-gray-700">
          <li>Personal professional use by the registered Subscriber only</li>
          <li>Clinical decision support purposes within a licensed medical practice</li>
          <li>Access via web interface at doctor-opus.online</li>
        </ul>
        <p className="mt-3 mb-2">The Subscriber shall NOT:</p>
        <ul className="list-disc pl-5 space-y-1 text-gray-700">
          <li>Resell, sublicense, or white-label the Service</li>
          <li>Share access credentials with third parties</li>
          <li>Reverse-engineer or attempt to extract underlying AI models or code</li>
          <li>Use the Service to develop competing products</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">4. Payment and Credits</h2>
        <p className="mb-3">
          4.1. The Subscriber purchases prepaid credits to access the Service. Credits are consumed
          per analytical operation as described on the pricing page.
        </p>
        <p className="mb-3">
          4.2. Payment is processed through NOWPayments (crypto/fiat gateway). All prices are in USD.
        </p>
        <p>
          4.3. Unused credits do not expire but are non-transferable and non-refundable except as
          provided in the Refund Policy.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">5. Medical Disclaimer</h2>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-900 text-sm">
            The Service provides analytical support only and does NOT constitute a medical diagnosis,
            clinical opinion, or treatment recommendation. It is NOT FDA-approved. The Subscriber bears
            full clinical and legal responsibility for all patient-care decisions made using the Service.
            The Provider shall not be liable for any adverse patient outcomes.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">6. Termination</h2>
        <p>
          The Provider may suspend or terminate access to the Service for violation of this Agreement,
          fraudulent activity, or misuse. The Subscriber may terminate this Agreement at any time by
          deleting their account. Upon termination, unused credits are forfeited unless refund eligibility
          applies under the Refund Policy.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">7. Intellectual Property</h2>
        <p>
          All intellectual property rights in and to the Service, including AI models, prompts, design,
          architecture, and content, are and shall remain the exclusive property of the Provider.
          This Agreement does not transfer any ownership rights to the Subscriber.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">8. Contact</h2>
        <p>
          <strong>Email:</strong> support@doctor-opus.online<br />
          <strong>Website:</strong> https://doctor-opus.online
        </p>
      </section>
    </LegalPageLayout>
  )
}
