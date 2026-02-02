import React, { useState } from 'react';
import { anonymizeText } from '@/lib/patient-db';

interface FeedbackFormProps {
  analysisType: string;
  analysisId?: string;
  analysisResult: string;
  inputCase?: string;
  onSuccess?: () => void;
}

const specialties = [
  "Кардиология", "Онкология", "Пульмонология", "Неврология", 
  "ОВП", "Инфекционные болезни", "Гастроэнтерология", 
  "Радиология", "Дерматология", "Лабораторный анализ",
  "Генетика", "Другое"
];

const correctnessOptions = [
  { value: "✅ Полностью верно", label: "✅ Полностью верно" },
  { value: "⚠️ Частично верно", label: "⚠️ Частично верно" },
  { value: "❌ Ошибка", label: "❌ Ошибка" }
];

const FeedbackForm: React.FC<FeedbackFormProps> = ({ 
  analysisType, 
  analysisId, 
  analysisResult, 
  inputCase,
  onSuccess 
}) => {
  const [correctness, setCorrectness] = useState("✅ Полностью верно");
  const [specialty, setSpecialty] = useState("Кардиология");
  const [consent, setConsent] = useState(true);
  const [correctDiagnosis, setCorrectDiagnosis] = useState("");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) {
      setError("Пожалуйста, дайте согласие на использование данных.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_type: analysisType,
          analysis_id: analysisId || `${analysisType}_${Date.now()}`,
          ai_response: analysisResult,
          feedback_type: correctness === "❌ Ошибка" ? "incorrect_diagnosis" : 
                         correctness === "⚠️ Частично верно" ? "needs_improvement" : "correct",
          doctor_comment: anonymizeText(comment),
          correct_diagnosis: anonymizeText(correctness !== "✅ Полностью верно" ? correctDiagnosis : ''),
          specialty,
          correctness,
          consent,
          input_case: anonymizeText(inputCase || '')
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSubmitted(true);
        if (onSuccess) onSuccess();
      } else {
        throw new Error(result.error || 'Ошибка при отправке отзыва');
      }
    } catch (err: any) {
      setError(err.message || "Произошла ошибка при отправке");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center shadow-sm">
        <h3 className="text-green-800 font-bold text-lg mb-2">✅ Спасибо за ваш отзыв!</h3>
        <p className="text-green-700 text-sm">
          Ваш вклад помогает нам улучшить качество анализа и сделать систему точнее.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-primary-100 rounded-xl shadow-sm overflow-hidden mt-8">
      <div className="bg-primary-50 px-6 py-4 border-b border-primary-100">
        <h3 className="font-bold text-primary-900 flex items-center gap-2 text-lg">
          📝 Оставить отзыв
        </h3>
        <p className="text-primary-700 text-xs mt-1">
          Ваш отзыв поможет улучшить систему. Все данные будут анонимизированы.
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="block text-sm font-bold text-gray-700">
              📊 Оценка корректности:
            </label>
            <div className="space-y-2">
              {correctnessOptions.map((option) => (
                <label key={option.value} className="flex items-center gap-3 p-2 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors border-gray-200">
                  <input
                    type="radio"
                    name="correctness"
                    value={option.value}
                    checked={correctness === option.value}
                    onChange={(e) => setCorrectness(e.target.value)}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-800">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-bold text-gray-700">
              🏥 Ваша специальность:
            </label>
            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm appearance-none bg-white"
            >
              {specialties.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {correctness !== "✅ Полностью верно" && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <label className="block text-sm font-bold text-gray-700">
              ✅ Укажите правильный диагноз/уточнение:
            </label>
            <textarea
              value={correctDiagnosis}
              onChange={(e) => setCorrectDiagnosis(e.target.value)}
              placeholder="Введите правильный диагноз, уточнение или исправление..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              rows={3}
              maxLength={2000}
            />
          </div>
        )}

        <div className="space-y-3">
          <label className="block text-sm font-bold text-gray-700">
            💬 Ваш комментарий (опционально):
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Укажите, что можно улучшить, что не хватает, или дополнительные замечания..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            rows={3}
            maxLength={3000}
          />
        </div>

        <div className="flex items-start gap-3">
          <input
            id="consent"
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
          />
          <label htmlFor="consent" className="text-xs text-gray-600 leading-relaxed cursor-pointer select-none">
            ✓ Согласен использовать этот случай для улучшения модели (анонимно). 
            Данные будут использованы исключительно для повышения точности анализа.
          </label>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !analysisResult}
          className="w-full md:w-auto px-6 py-2 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
        >
          {isSubmitting ? 'Отправка...' : '📤 Отправить отзыв'}
        </button>
        
        {!analysisResult && (
          <p className="text-xs text-amber-600 font-medium">
            💡 Форма станет активной после завершения анализа.
          </p>
        )}
      </form>
    </div>
  );
};

export default FeedbackForm;

