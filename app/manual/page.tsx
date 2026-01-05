import fs from 'fs';
import path from 'path';
import ReactMarkdown from 'react-markdown';

export const dynamic = 'force-dynamic';

export default function ManualPage() {
  const filePath = path.join(process.cwd(), 'USER_MANUAL_FOR_DOCTORS.md');
  const content = fs.readFileSync(filePath, 'utf8');

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-100 prose prose-slate max-w-none prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tight prose-a:text-indigo-600 prose-img:rounded-2xl">
        <div className="mb-8 border-b pb-6">
          <h1 className="text-4xl font-black text-slate-900 mb-2 uppercase tracking-tight flex items-center gap-4">
            📘 Инструкция врача
          </h1>
          <div className="h-1.5 w-24 bg-indigo-600 rounded-full"></div>
        </div>
        
        <ReactMarkdown
          components={{
            table: ({ children }) => (
              <div className="overflow-x-auto my-6 rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200">
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => <thead className="bg-slate-50">{children}</thead>,
            th: ({ children }) => <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{children}</th>,
            td: ({ children }) => <td className="px-4 py-3 text-sm text-slate-600 border-t border-slate-100">{children}</td>,
            h2: ({ children }) => <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-6 pb-2 border-b border-slate-100 flex items-center gap-3">{children}</h2>,
            h3: ({ children }) => <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">{children}</h3>,
            ul: ({ children }) => <ul className="space-y-2 my-4 list-disc pl-5 text-slate-600">{children}</ul>,
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            strong: ({ children }) => <strong className="font-bold text-slate-900">{children}</strong>,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

