import LegalPageLayout from '@/components/LegalPageLayout'

export default function RefundPage() {
  return (
    <LegalPageLayout title="Payment and Refund Policy" lastUpdated="February 25, 2026">
      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">1. Payment Methods</h2>
        <p className="mb-3">
          Doctor Opus accepts payments via <strong>NOWPayments</strong>, a global crypto/fiat payment
          gateway. Supported payment methods include major cryptocurrencies (BTC, ETH, USDT, and others)
          as well as select fiat options available through NOWPayments.
        </p>
        <p>
          All prices are displayed and charged in <strong>US Dollars (USD)</strong>.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">2. Credit Packages</h2>
        <p className="mb-2">
          Credits are purchased in advance and are available in the following packages:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border p-2">Package</th>
                <th className="border p-2">Credits</th>
                <th className="border p-2">Price (USD)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-2">Starter</td>
                <td className="border p-2">50</td>
                <td className="border p-2">$9.99</td>
              </tr>
              <tr>
                <td className="border p-2">Standard</td>
                <td className="border p-2">150</td>
                <td className="border p-2">$24.99</td>
              </tr>
              <tr>
                <td className="border p-2 font-semibold">Pro</td>
                <td className="border p-2 font-semibold">500</td>
                <td className="border p-2 font-semibold">$69.99</td>
              </tr>
              <tr>
                <td className="border p-2">Department</td>
                <td className="border p-2">2,000</td>
                <td className="border p-2">$199.99</td>
              </tr>
              <tr>
                <td className="border p-2">Clinic</td>
                <td className="border p-2">5,000</td>
                <td className="border p-2">$449.99</td>
              </tr>
              <tr>
                <td className="border p-2">Medical Center</td>
                <td className="border p-2">12,000</td>
                <td className="border p-2">$999.99</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">3. Credit Crediting</h2>
        <p>
          Credits are automatically credited to your account upon confirmed payment. For cryptocurrency
          payments, confirmation typically occurs after the required number of blockchain confirmations
          (varies by coin and network). If credits are not credited within 30 minutes of a confirmed
          payment, contact support with your transaction ID.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">4. Refund Policy</h2>
        <p className="mb-3">
          <strong>4.1. General rule:</strong> Purchased credits are generally non-refundable once
          the payment has been confirmed and credits have been credited to your account.
        </p>
        <p className="mb-3">
          <strong>4.2. Technical failure:</strong> If a confirmed payment was made but credits were
          not credited to your account due to a technical error on our part, you are entitled to either
          a full credit correction or a full refund. Please contact us within 14 days of payment
          with proof of the transaction.
        </p>
        <p className="mb-3">
          <strong>4.3. Partial refunds:</strong> If you have unused credits and believe you are entitled
          to a refund due to a material service failure, contact support. We review requests on a
          case-by-case basis.
        </p>
        <p>
          <strong>4.4. Cryptocurrency refunds:</strong> Refunds for cryptocurrency payments will be
          issued in the same or equivalent cryptocurrency to the sending wallet address. Exchange
          rate fluctuations between payment date and refund date are the user's responsibility.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">5. Free Features</h2>
        <p>
          The following features are available without credit consumption and are processed locally
          in your browser:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-gray-700 mt-2">
          <li>Medical calculators</li>
          <li>Document scanning (local browser processing)</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">6. Contact for Payment Issues</h2>
        <p>
          For payment disputes, missing credits, or refund requests, contact:<br />
          <strong>Email:</strong> support@doctor-opus.online<br />
          Please include your account email, payment date, transaction ID (if available), and
          a description of the issue.
        </p>
      </section>
    </LegalPageLayout>
  )
}
