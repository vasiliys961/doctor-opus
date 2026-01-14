import LegalPageLayout from '@/components/LegalPageLayout'

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Политика обработки персональных данных" lastUpdated="08.01.2026">
      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">1. Общие положения</h2>
        <p>
          Оператор персональных данных: <strong>Селиванов Василий Федорович</strong> (ИНН 920455053236, г. Севастополь). 
          Мы ответственно относимся к конфиденциальности ваших данных и данных ваших пациентов. 
          Сервис "Doctor Opus" придерживается принципов анонимизации (обезличивания) медицинских изображений перед их обработкой.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">2. Цели обработки</h2>
        <p>
          Данные обрабатываются исключительно для предоставления результатов интеллектуального анализа, улучшения работы алгоритмов и связи с пользователем.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">3. Соответствие законодательству</h2>
        <p>
          Настоящая политика соответствует требованиям Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных».
        </p>
      </section>
      
      <section className="bg-blue-50 p-6 rounded-xl border border-blue-100">
        <p className="text-blue-900 font-medium">
          <strong>Важно:</strong> Мы не храним персональную информацию пациентов (ФИО, адреса, номера телефонов) в открытом виде. 
          Рекомендуется удалять любые идентифицирующие данные со снимков перед их загрузкой в систему.
        </p>
      </section>
    </LegalPageLayout>
  )
}

