'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [agreedCrossBorder, setAgreedCrossBorder] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed || !agreedCrossBorder) return;
    setStatus('loading');
    setErrorMessage('');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setStatus('error');
        setErrorMessage('Неверный email или пароль');
      } else {
        setStatus('success');
        router.push('/chat');
        router.refresh();
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage('Ошибка авторизации. Попробуйте еще раз.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed || !agreedCrossBorder) return;
    setStatus('loading');
    setErrorMessage('');

    if (password.length < 8) {
      setStatus('error');
      setErrorMessage('Пароль должен быть не менее 8 символов');
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: name || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setErrorMessage(data.error || 'Ошибка регистрации');
        return;
      }

      // Успешная регистрация — автоматический вход
      const loginResult = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (loginResult?.error) {
        setStatus('success');
        setErrorMessage('');
        setIsRegister(false);
        // Показываем сообщение об успешной регистрации
        alert('Регистрация успешна! Теперь войдите с вашим email и паролем.');
      } else {
        setStatus('success');
        router.push('/chat');
        router.refresh();
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage('Ошибка соединения с сервером');
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

        {/* Переключатель Вход / Регистрация */}
        <div className="flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => { setIsRegister(false); setErrorMessage(''); setStatus('idle'); }}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              !isRegister ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Вход
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setErrorMessage(''); setStatus('idle'); }}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              isRegister ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Регистрация
          </button>
        </div>
        
        <form className="mt-4 space-y-5" onSubmit={isRegister ? handleRegister : handleLogin}>
          <div className="space-y-4 rounded-md">
            {isRegister && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                  Имя (необязательно)
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  className="block w-full rounded-xl border-slate-200 py-3 px-4 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm transition-all"
                  placeholder="Иванов Иван Иванович"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
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
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                Пароль
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
                minLength={8}
                className="block w-full rounded-xl border-slate-200 py-3 px-4 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm transition-all"
                placeholder={isRegister ? 'Минимум 8 символов' : 'Введите пароль'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3 px-1">
            <div className="flex items-start gap-3">
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

            <div className="flex items-start gap-3">
              <div className="flex h-5 items-center">
                <input
                  id="consent-crossborder"
                  name="consent-crossborder"
                  type="checkbox"
                  required
                  checked={agreedCrossBorder}
                  onChange={(e) => setAgreedCrossBorder(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600 transition-all cursor-pointer"
                />
              </div>
              <div className="text-xs leading-tight text-slate-500">
                <label htmlFor="consent-crossborder" className="cursor-pointer">
                  Я даю <a href="/docs/consent" className="text-teal-600 hover:underline">согласие на трансграничную передачу</a> обезличенных медицинских данных сторонним AI-сервисам для их обработки (ст. 12 152-ФЗ)
                </label>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={status === 'loading' || !agreed || !agreedCrossBorder}
              className="group relative flex w-full justify-center rounded-xl bg-teal-600 px-3 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-200 hover:bg-teal-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-50 disabled:bg-slate-400 disabled:shadow-none transition-all active:scale-[0.98]"
            >
              {status === 'loading' ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isRegister ? 'Регистрация...' : 'Вход...'}
                </span>
              ) : isRegister ? 'Зарегистрироваться' : 'Войти'}
            </button>
          </div>

          {status === 'error' && errorMessage && (
            <div className="rounded-xl bg-red-50 p-4 border border-red-100">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">{errorMessage}</p>
                </div>
              </div>
            </div>
          )}

          {status === 'success' && isRegister && (
            <div className="rounded-xl bg-green-50 p-4 border border-green-100">
              <p className="text-sm font-medium text-green-800">
                Регистрация успешна! Перенаправление...
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
