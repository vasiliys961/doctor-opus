import LegalPageLayout from '@/components/LegalPageLayout'

export default function OfferPage() {
  return (
    <LegalPageLayout title="Договор оферты" lastUpdated="07.01.2026">
      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">1. Общие положения</h2>
        <p>
          Настоящий документ является публичной офертой сервиса "Doctor Opus" (далее — Исполнитель). 
          Использование сервиса подразумевает полное и безоговорочное принятие условий данного договора.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">2. Предмет договора</h2>
        <p>
          Исполнитель предоставляет доступ к программному обеспечению для анализа медицинских данных с помощью технологий искусственного интеллекта.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">3. Стоимость и порядок оплаты</h2>
        <p>
          Оплата производится путем приобретения пакетов "единиц" через систему интернет-эквайринга. 
          Единицы списываются за каждую операцию анализа в соответствии с установленными тарифами.
        </p>
      </section>

      <section className="bg-gray-50 p-6 rounded-xl border border-gray-100 italic">
        <p>
          Полный текст договора оферты будет доступен здесь. Для банковских проверок (CloudPayments) 
          данный раздел должен содержать полные реквизиты Исполнителя (ФИО, ИНН самозанятого).
        </p>
      </section>
    </LegalPageLayout>
  )
}

