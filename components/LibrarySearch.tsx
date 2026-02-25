'use client'

import { useState, useEffect } from 'react'
import { searchLibraryLocal } from '@/lib/library-db'

interface LibrarySearchProps {
  query: string
  isActive?: boolean
}

export default function LibrarySearch({ query, isActive = false }: LibrarySearchProps) {
  const [results, setResults] = useState<string[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isActive && query) {
      handleSearch()
    }
  }, [isActive, query])

  const handleSearch = async () => {
    setSearching(true)
    setError(null)
    try {
      // Извлекаем ключевые слова для поиска (первые 2 предложения или 200 символов)
      const searchTerms = query.split(/[.!?]/).slice(0, 2).join(' ').substring(0, 200)
      const found = await searchLibraryLocal(searchTerms, 5)
      setResults(found)
    } catch (err) {
      console.error('Library search error:', err)
      setError('Failed to search the library')
    } finally {
      setSearching(false)
    }
  }

  if (!isActive) return null

  return (
    <div className="mt-8 border-t border-gray-100 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">📚</span>
        <h3 className="text-lg font-bold text-primary-900">Search for Similar Cases in Library</h3>
      </div>

      {searching ? (
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl animate-pulse">
          <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-gray-600 italic">Searching your PDF files for relevant matches...</p>
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-4">
          <p className="text-xs text-green-600 font-semibold uppercase tracking-wider">Relevant excerpts found in your library:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((content, idx) => (
              <div key={idx} className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-900 relative group overflow-hidden max-h-60 overflow-y-auto">
                <div className="absolute top-0 right-0 p-1 bg-indigo-200 text-indigo-700 text-[10px] font-bold uppercase rounded-bl-lg opacity-50">
                  Excerpt #{idx + 1}
                </div>
                <div className="whitespace-pre-wrap italic leading-relaxed">
                  {content.length > 500 ? content.substring(0, 500) + '...' : content}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-4">
            <a 
              href="/library" 
              className="text-xs text-primary-600 hover:text-primary-800 font-bold underline decoration-dotted"
            >
              Go to library for detailed study
            </a>
          </div>
        </div>
      ) : error ? (
        <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>
      ) : (
        <div className="p-6 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <p className="text-sm text-gray-500 italic">
            No matches found in your library. 
            <br />
            <span className="text-xs">Try uploading more relevant literature in PDF format.</span>
          </p>
          <a 
            href="/library" 
            className="mt-3 inline-block px-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 transition-all"
          >
            ➕ Загрузить PDF
          </a>
        </div>
      )}
    </div>
  )
}
