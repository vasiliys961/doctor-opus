import LegalPageLayout from '@/components/LegalPageLayout'

export default function OfferPage() {
  return (
    <LegalPageLayout title="Договор оферты" lastUpdated="08.01.2026">
      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">1. Общие положения</h2>
        <p>
          Настоящий документ является публичной офертой сервиса "Doctor Opus". 
          Исполнителем является самозанятый гражданин <strong>Селиванов Василий Федорович</strong> (ИНН 920455053236). 
          Использование сервиса подразумевает полное и безоговорочное принятие условий данного договора.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">2. Предмет договора</h2>
        <p>
          Исполнитель предоставляет доступ к программному обеспечению Doctor Opus для анализа медицинских данных с помощью технологий искусственного интеллекта. Сервис предназначен для информационной поддержки специалистов и не является медицинским заключением.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">3. Стоимость и порядок оплаты</h2>
        <p>
          Оплата производится путем приобретения пакетов "единиц" через систему интернет-эквайринга (CloudPayments). 
          Единицы списываются за каждую операцию анализа в соответствии с установленными тарифами в личном кабинете пользователя.
        </p>
      </section>

      <section className="bg-gray-50 p-6 rounded-xl border border-gray-100">
        <h2 className="text-lg font-semibold mb-2">Реквизиты Исполнителя</h2>
        <ul className="space-y-1 text-sm">
          <li><strong>ФИО:</strong> Селиванов Василий Федорович</li>
          <li><strong>ИНН:</strong> 920455053236</li>
          <li><strong>Статус:</strong> Самозанятый (Плательщик налога на профессиональный доход)</li>
          <li><strong>Email:</strong> vasily61@gmail.com, vasiliys@mail.ru</li>
        </ul>
      </section>
    </LegalPageLayout>
  )
}

