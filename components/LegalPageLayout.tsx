import React from 'react';

interface LegalPageLayoutProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export default function LegalPageLayout({ title, lastUpdated, children }: LegalPageLayoutProps) {
  return (
    <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-2">{title}</h1>
      <p className="text-sm text-gray-500 mb-8 font-medium">Дата последнего обновления: {lastUpdated}</p>
      
      <div className="prose prose-blue max-w-none text-gray-700 leading-relaxed space-y-6">
        {children}
      </div>
      
      <div className="mt-12 pt-8 border-t border-gray-100">
        <p className="text-sm text-gray-400 italic">
          В случае возникновения вопросов по данному документу, пожалуйста, свяжитесь с поддержкой Doctor Opus.
        </p>
      </div>
    </div>
  );
}

