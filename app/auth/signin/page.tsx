'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const SPECIALTIES = [
  { id: 'universal', name: 'Терапевт / Врач общей практики' },
  { id: 'cardiology', name: 'Кардиолог' },
  { id: 'neurology', name: 'Невролог' },
  { id: 'endocrinology', name: 'Эндокринолог' },
  { id: 'radiology', name: 'Рентгенолог / Радиолог' },
  { id: 'oncology', name: 'Онколог' },
  { id: 'traumatology', name: 'Травматолог-ортопед' },
  { id: 'rheumatology', name: 'Ревматолог' },
  { id: 'dermatology', name: 'Дерматовенеролог' },
  { id: 'gastroenterology', name: 'Гастроэнтеролог' },
  { id: 'pediatrics', name: 'Педиатр' },
  { id: 'gynecology', name: 'Гинеколог' },
  { id: 'hematology', name: 'Гематолог' },
  { id: 'universal', name: 'Прочий специалист / Не врач' },
];

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) return;
    setStatus('loading');

    try {
      const result = await signIn('credentials', {
        email,
        password: 'any_password',
        redirect: false,
      });

      if (result?.error) {
        setStatus('error');
      } else {
        setStatus('success');
        router.push('/chat');
        router.refresh();
      }
    } catch (error) {
      setStatus('error');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-teal-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-teal-100/50">
        <div>
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-xl bg-teal-600 flex items-center justify-center shadow-lg shadow-teal-200">
              <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-slate-900">
            Doctor Opus
          </h2>
          <p className="mt-2 text-center text-sm text-slate-500">
            Интеллектуальный помощник врача
          </p>
        </div>
        
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md">
            <div>
              <label htmlFor="email-address" className="block text-sm font-medium text-slate-700 mb-1">
                Рабочий Email
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="block w-full rounded-xl border-slate-200 py-3 px-4 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm transition-all"
                placeholder="doctor@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-start gap-3 px-1">
            <div className="flex h-5 items-center">
              <input
                id="consent"
                name="consent"
                type="checkbox"
                required
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600 transition-all cursor-pointer"
              />
            </div>
            <div className="text-xs leading-tight text-slate-500">
              <label htmlFor="consent" className="cursor-pointer">
                Я даю <a href="/docs/consent" className="text-teal-600 hover:underline">согласие на обработку персональных данных</a> и принимаю условия <a href="/docs/offer" className="text-teal-600 hover:underline">Публичной оферты</a>
              </label>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={status === 'loading' || !agreed}
              className="group relative flex w-full justify-center rounded-xl bg-teal-600 px-3 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-200 hover:bg-teal-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-50 disabled:bg-slate-400 disabled:shadow-none transition-all active:scale-[0.98]"
            >
              {status === 'loading' ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Загрузка...
                </span>
              ) : 'Начать работу'}
            </button>
          </div>

          <div className="text-center pt-2">
            <p className="text-[10px] text-slate-400">
              Вход осуществляется по рабочему Email.
            </p>
          </div>

          {status === 'error' && (
            <div className="rounded-xl bg-red-50 p-4 border border-red-100">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">
                    Ошибка авторизации. Попробуйте еще раз.
                  </p>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}


