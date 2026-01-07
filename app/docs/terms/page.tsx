import LegalPageLayout from '@/components/LegalPageLayout'

export default function TermsPage() {
  return (
    <LegalPageLayout title="Пользовательское соглашение" lastUpdated="07.01.2026">
      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">1. Статус сервиса</h2>
        <p>
          "Doctor Opus" является инструментом поддержки принятия клинических решений (Decision Support System). 
          Сервис не заменяет врача и не является самостоятельным средством диагностики.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">2. Ответственность</h2>
        <p>
          Пользователь (врач) несет полную ответственность за постановку диагноза и назначение лечения. 
          Исполнитель не несет ответственности за любые последствия, возникшие в результате использования результатов анализа ИИ.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">3. Ограничения</h2>
        <p>
          Запрещается использование сервиса лицами, не имеющими соответствующего медицинского образования и квалификации.
        </p>
      </section>
    </LegalPageLayout>
  )
}

