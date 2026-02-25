'use client'

import React from 'react'

export default function CalculatorsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl h-screen flex flex-col">
      <h1 className="text-3xl font-bold text-primary-900 mb-6 flex items-center gap-3">
        🧮 Medical Calculators
      </h1>
      
      <div className="flex-1 bg-white rounded-2xl shadow-xl overflow-hidden border border-primary-100">
        <iframe 
          src="/calculators/index.html" 
          className="w-full h-full border-none"
          title="Medical Calculators"
        />
      </div>
      
      <div className="mt-4 p-4 bg-primary-50 rounded-lg text-xs text-primary-700 flex items-center gap-2 border border-primary-100">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          Calculators run locally within the application. No data is sent to external services.
        </span>
      </div>
    </div>
  )
}
