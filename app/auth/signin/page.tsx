'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedDisclaimer, setAgreedDisclaimer] = useState(false);
  const [agreedDataTransfer, setAgreedDataTransfer] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const router = useRouter();

  const allAgreed = agreedTerms && agreedDisclaimer && agreedDataTransfer;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allAgreed) return;
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
        setErrorMessage('Invalid email or password');
      } else {
        setStatus('success');
        router.push('/chat');
        router.refresh();
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage('Authentication error. Please try again.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allAgreed) return;
    setStatus('loading');
    setErrorMessage('');

    if (password.length < 8) {
      setStatus('error');
      setErrorMessage('Password must be at least 8 characters');
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
        setErrorMessage(data.error || 'Registration error');
        return;
      }

      const loginResult = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (loginResult?.error) {
        setStatus('success');
        setErrorMessage('');
        setIsRegister(false);
        alert('Registration successful! Please sign in with your email and password.');
      } else {
        setStatus('success');
        router.push('/chat');
        router.refresh();
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage('Connection error. Please try again.');
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
            AI-powered Clinical Decision Support
          </p>
        </div>

        {/* Disclaimer banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
          <p className="font-bold mb-1">⚠️ For licensed healthcare professionals only</p>
          <p>This tool is NOT FDA-approved and does not constitute a medical diagnosis. The physician bears full responsibility for all clinical decisions.</p>
        </div>

        {/* Sign In / Register toggle */}
        <div className="flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => { setIsRegister(false); setErrorMessage(''); setStatus('idle'); }}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              !isRegister ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setErrorMessage(''); setStatus('idle'); }}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              isRegister ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Register
          </button>
        </div>
        
        <form className="mt-4 space-y-5" onSubmit={isRegister ? handleRegister : handleLogin}>
          <div className="space-y-4 rounded-md">
            {isRegister && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                  Full Name (optional)
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  className="block w-full rounded-xl border-slate-200 py-3 px-4 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm transition-all"
                  placeholder="Dr. John Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div>
              <label htmlFor="email-address" className="block text-sm font-medium text-slate-700 mb-1">
                Professional Email
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="block w-full rounded-xl border-slate-200 py-3 px-4 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm transition-all"
                placeholder="doctor@hospital.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
                minLength={8}
                className="block w-full rounded-xl border-slate-200 py-3 px-4 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-teal-600 sm:text-sm transition-all"
                placeholder={isRegister ? 'Minimum 8 characters' : 'Enter your password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3 px-1">
            {/* Checkbox 1: Terms + Privacy */}
            <div className="flex items-start gap-3">
              <div className="flex h-5 items-center">
                <input
                  id="consent-terms"
                  name="consent-terms"
                  type="checkbox"
                  required
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600 transition-all cursor-pointer"
                />
              </div>
              <div className="text-xs leading-tight text-slate-500">
                <label htmlFor="consent-terms" className="cursor-pointer">
                  I agree to the{' '}
                  <a href="/docs/terms" className="text-teal-600 hover:underline">Terms of Service</a>
                  {' '}and{' '}
                  <a href="/docs/privacy" className="text-teal-600 hover:underline">Privacy Policy</a>
                </label>
              </div>
            </div>

            {/* Checkbox 2: Medical Disclaimer */}
            <div className="flex items-start gap-3">
              <div className="flex h-5 items-center">
                <input
                  id="consent-disclaimer"
                  name="consent-disclaimer"
                  type="checkbox"
                  required
                  checked={agreedDisclaimer}
                  onChange={(e) => setAgreedDisclaimer(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600 transition-all cursor-pointer"
                />
              </div>
              <div className="text-xs leading-tight text-slate-500">
                <label htmlFor="consent-disclaimer" className="cursor-pointer">
                  I acknowledge that I am a <strong>licensed healthcare professional</strong>,
                  that this tool is <strong>NOT FDA-approved</strong>, and that I bear full clinical
                  responsibility for all decisions made using this system.{' '}
                  <a href="/docs/consent" className="text-teal-600 hover:underline">Read full acknowledgment</a>
                </label>
              </div>
            </div>

            {/* Checkbox 3: Data transfer */}
            <div className="flex items-start gap-3">
              <div className="flex h-5 items-center">
                <input
                  id="consent-data"
                  name="consent-data"
                  type="checkbox"
                  required
                  checked={agreedDataTransfer}
                  onChange={(e) => setAgreedDataTransfer(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600 transition-all cursor-pointer"
                />
              </div>
              <div className="text-xs leading-tight text-slate-500">
                <label htmlFor="consent-data" className="cursor-pointer">
                  I consent to the transmission of <strong>anonymized</strong> analytical data to
                  third-party AI inference services for processing, as described in the{' '}
                  <a href="/docs/privacy" className="text-teal-600 hover:underline">Privacy Policy</a>
                </label>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={status === 'loading' || !allAgreed}
              className="group relative flex w-full justify-center rounded-xl bg-teal-600 px-3 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-200 hover:bg-teal-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-50 disabled:bg-slate-400 disabled:shadow-none transition-all active:scale-[0.98]"
            >
              {status === 'loading' ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isRegister ? 'Creating account...' : 'Signing in...'}
                </span>
              ) : isRegister ? 'Create Account' : 'Sign In'}
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
                Registration successful! Redirecting...
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
