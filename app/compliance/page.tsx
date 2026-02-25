import LegalPageLayout from '@/components/LegalPageLayout'

export default function CompliancePage() {
  return (
    <LegalPageLayout title="Information for Payment Systems & Compliance" lastUpdated="2026-01-31">
      <section className="bg-blue-50 p-6 rounded-2xl border border-blue-100 mb-8">
        <p className="text-blue-900 leading-relaxed">
          <strong>doctor-opus.online</strong> is a cloud-based Software-as-a-Service (SaaS) platform designed to automate the workflows of healthcare professionals. The service provides AI-powered data analysis tools and clinical report drafting capabilities.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            ✅ What we do
          </h2>
          <ul className="space-y-3 list-disc pl-5 text-sm text-gray-700">
            <li>Provide physicians with AI-powered tools for analyzing medical imaging (ECG, X-Ray, MRI, CT).</li>
            <li>Automate the process of generating structured report drafts to accelerate clinical workflows.</li>
            <li>Ensure a secure environment for temporary data processing without persistent storage of medical files on our servers.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            ❌ What we do NOT do
          </h2>
          <ul className="space-y-3 list-disc pl-5 text-sm text-gray-700">
            <li><strong>Do not provide medical services</strong> to the general public.</li>
            <li><strong>Do not diagnose</strong> or prescribe treatment (final decisions always rest with the physician).</li>
            <li><strong>Do not interact directly with patients</strong> (registration and access are restricted to licensed healthcare professionals).</li>
          </ul>
        </div>
      </section>

      <hr className="my-8 border-gray-100" />

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-4">⚖️ Legal Status & Licensing</h2>
        <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 space-y-3 text-sm">
          <p><strong>Service:</strong> Doctor Opus — AI Clinical Decision Support Platform</p>
          <p><strong>Contact:</strong> support@doctor-opus.online</p>
          <p className="pt-2 italic border-t border-gray-200">
            This service is a supplementary informational-analytical IT tool (SaaS), functionally similar to Clinical Decision Support Systems (CDSS). It is not a registered medical device and does not provide medical services. No medical license is required to use this software tool.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-4">🛡️ Data Processing & Privacy (GDPR/HIPAA)</h2>
        <div className="space-y-4 text-sm text-gray-700">
          <div className="flex gap-4 items-start">
            <div className="bg-green-100 text-green-700 p-2 rounded-lg font-bold">USER</div>
            <div>
              <p className="font-bold text-gray-900">User Data (Physicians):</p>
              <p>Email and account balance data are stored on secure cloud infrastructure. No PHI or patient identifiers are linked to user accounts.</p>
            </div>
          </div>
          
          <div className="flex gap-4 items-start">
            <div className="bg-blue-100 text-blue-700 p-2 rounded-lg font-bold">LOC</div>
            <div>
              <p className="font-bold text-gray-900">Patient Data:</p>
              <p>Identifying patient information (names, anamnesis) is stored locally on the physician&apos;s device (IndexedDB technology) and is never transmitted to our servers.</p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="bg-amber-100 text-amber-700 p-2 rounded-lg font-bold">AI</div>
            <div>
              <p className="font-bold text-gray-900">Three-Level Anonymization:</p>
              <p>Medical files are processed in browser memory. Only anonymized copies (stripped of metadata and identifiers) are transmitted for AI analysis via OpenRouter API. No PHI reaches external APIs.</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-4">💰 Monetization Model</h2>
        <p className="text-sm text-gray-700 mb-4">The subject of sale is access to software features:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border border-gray-200 rounded-lg">
            <p className="font-bold text-gray-900">Subscription (SaaS)</p>
            <p className="text-xs text-gray-500">Temporary access to the user dashboard and automation tools.</p>
          </div>
          <div className="p-4 border border-gray-200 rounded-lg">
            <p className="font-bold text-gray-900">Credit Packages</p>
            <p className="text-xs text-gray-500">Payment for AI compute resources used to analyze specific data sets (images, ECGs, lab results).</p>
          </div>
        </div>
        <p className="mt-4 text-xs font-bold text-primary-700">Payment is for an IT service, not a medical consultation.</p>
      </section>

      <section className="bg-gray-900 text-white p-6 rounded-2xl shadow-xl mt-10">
        <h2 className="text-lg font-bold mb-4">Compliance Contact</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm opacity-90">
          <div>
            <p className="text-gray-400">Email:</p>
            <p className="font-medium">support@doctor-opus.online</p>
          </div>
          <div>
            <p className="text-gray-400">Website:</p>
            <p className="font-medium">doctor-opus.online</p>
          </div>
        </div>
      </section>
    </LegalPageLayout>
  )
}
