import LegalPageLayout from '@/components/LegalPageLayout'

export default function ConsentPage() {
  return (
    <LegalPageLayout title="Согласие на обработку персональных данных" lastUpdated="07.01.2026">
      <section>
        <p>
          Регистрируясь в сервисе "Doctor Opus" или используя его функционал, вы свободно, своей волей и в своем интересе 
          даете согласие на обработку ваших персональных данных (e-mail, имя) Исполнителю.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">Права субъекта</h2>
        <p>
          Вы имеете право на отзыв согласия путем направления письменного уведомления на адрес электронной почты поддержки.
        </p>
      </section>
    </LegalPageLayout>
  )
}

