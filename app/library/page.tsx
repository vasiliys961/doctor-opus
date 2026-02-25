'use client';

import { useState, useEffect } from 'react';
import { 
  getAllDocuments, 
  saveDocument, 
  deleteDocument, 
  LibraryDocument 
} from '@/lib/library-db';

export default function LibraryPage() {
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      const docs = await getAllDocuments();
      setDocuments(docs || []);
    } catch (err) {
      setError('Failed to load document list');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Please select a file in PDF format');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setProgress('Uploading file to local server...');
      
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/library/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'PDF processing error');
      }

      setProgress('Saving to local database...');

      // Сохраняем результат в IndexedDB
      const newDoc: LibraryDocument = {
        id: crypto.randomUUID(),
        name: result.data.name,
        size: result.data.size,
        uploaded_at: result.data.uploaded_at,
        chunksCount: result.data.chunks.length
      };

      await saveDocument(newDoc, result.data.chunks);
      await fetchDocuments();
      
      event.target.value = '';
      setProgress('');
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'PDF processing error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await deleteDocument(id);
      setDocuments(prev => prev.filter(doc => doc.id !== id));
    } catch (err) {
      alert('Deletion error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-8">
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-8 border border-gray-100">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-primary-900">
          <span>📚</span> Personal Library
        </h2>
        <p className="text-gray-600 mb-6 text-sm sm:text-base">
          Upload PDF literature. Files are processed on **your local server** 
          (not sent to the internet) and stored in your browser. Large files up to 100 MB are supported.
        </p>

        <div className="flex items-center justify-center w-full">
          <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-primary-300 rounded-xl transition-all ${uploading ? 'bg-gray-50 cursor-wait opacity-70' : 'bg-primary-50 hover:bg-primary-100 cursor-pointer'}`}>
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <span className="text-3xl mb-2">{uploading ? '⚙️' : '📄'}</span>
              <p className="mb-2 text-sm text-primary-700 font-semibold text-center px-4">
                {uploading ? progress : 'Choose PDF to process'}
              </p>
              <p className="text-xs text-primary-500">Up to 100 MB • Processed on local server</p>
            </div>
            {!uploading && (
              <input 
                type="file" 
                className="hidden" 
                accept=".pdf" 
                onChange={handleFileUpload}
              />
            )}
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6 flex items-start shadow-sm border border-red-100">
          <span className="mr-2 text-xl">⚠️</span>
          <div className="flex-1">
            <p className="font-bold mb-1">Processing error</p>
            <p className="text-sm">{error}</p>
            {error.includes('Python') && (
              <p className="text-xs mt-2 bg-red-100 p-2 rounded">
                💡 Установите PyMuPDF: <code className="font-mono">pip install pymupdf</code>
              </p>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Document</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Chunks</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Size</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-gray-400 text-sm italic">Loading...</td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-gray-400 text-sm italic">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-4xl">📚</span>
                      <p>Library is empty. Upload your first document.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-gray-900 truncate max-w-[200px] sm:max-w-md" title={doc.name}>{doc.name}</div>
                      <div className="text-[10px] text-gray-400 uppercase font-mono">{new Date(doc.uploaded_at).toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full border border-indigo-100">{doc.chunksCount}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs text-gray-500">{(doc.size / 1024 / 1024).toFixed(1)} MB</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button 
                        onClick={() => handleDelete(doc.id)}
                        className="text-red-500 hover:text-red-700 font-bold px-3 py-1 rounded-lg hover:bg-red-50 transition-all"
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
