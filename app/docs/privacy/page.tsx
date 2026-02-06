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
          Все серверные мощности и базы данных сервиса расположены на территории Российской Федерации (инфраструктура провайдера ООО «Таймвэб»).
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">2. Место хранения данных</h2>
        <p>
          2.1. <strong>Данные пациентов:</strong> Идентифицирующие данные пациентов (ФИО, возраст, диагноз в базе пациентов) хранятся исключительно в локальной памяти браузера Пользователя (технология IndexedDB) и не передаются на сервер Исполнителя.
        </p>
        <p>
          2.2. <strong>Данные Пользователей:</strong> Данные учетных записей Пользователей (врачей), баланс и история транзакций хранятся в защищенной базе данных на сервере Исполнителя на территории РФ.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">3. Цели обработки</h2>
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
        <p className="text-blue-900 font-medium mb-4">
          <strong>Важно:</strong> Мы не получаем и не храним персональную информацию ваших пациентов на наших серверах. 
          Технически база данных пациентов реализована на стороне вашего браузера, что гарантирует максимальную защиту в соответствии с 152-ФЗ.
          При анализе снимков ИИ обрабатывает только анонимизированные пиксели.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold text-gray-900 mb-3">4. Использование файлов Cookie</h2>
        <p className="mb-4">Для корректной работы сервиса и обеспечения безопасности сессий используются следующие технические файлы cookie:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border p-2">Название</th>
                <th className="border p-2">Назначение</th>
                <th className="border p-2">Срок жизни</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-2 font-mono">next-auth.session-token</td>
                <td className="border p-2">Идентификатор активной сессии врача</td>
                <td className="border p-2">30 дней</td>
              </tr>
              <tr>
                <td className="border p-2 font-mono">next-auth.callback-url</td>
                <td className="border p-2">Технический параметр перенаправления</td>
                <td className="border p-2">Сессия</td>
              </tr>
              <tr>
                <td className="border p-2 font-mono">cookie-consent</td>
                <td className="border p-2">Хранение выбора пользователя по куки</td>
                <td className="border p-2">1 год</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </LegalPageLayout>
  )
}

