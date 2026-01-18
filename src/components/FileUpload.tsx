'use client';

import { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface FileUploadProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUploadComplete: (results: any[]) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

interface UploadedFile {
  name: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export default function FileUpload({ onUploadComplete, isLoading, setIsLoading }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const processFiles = useCallback(async (fileList: FileList) => {
    const validFiles = Array.from(fileList).filter(
      file => file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    );

    if (validFiles.length === 0) {
      alert('Veuillez sélectionner des fichiers Excel (.xlsx ou .xls)');
      return;
    }

    // Ajouter les fichiers à la liste avec statut pending
    const newFiles: UploadedFile[] = validFiles.map(f => ({
      name: f.name,
      status: 'uploading' as const,
    }));
    setFiles(prev => [...prev, ...newFiles]);
    setIsLoading(true);

    // Upload les fichiers
    const formData = new FormData();
    validFiles.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        // Mettre à jour le statut des fichiers
        setFiles(prev =>
          prev.map(f => {
            const fileResult = result.results.find(
              (r: { fileName: string; success: boolean }) => r.fileName === f.name
            );
            if (fileResult) {
              return {
                ...f,
                status: fileResult.success ? 'success' : 'error',
                error: fileResult.error,
              };
            }
            return f;
          })
        );

        // Envoyer les données au parent
        onUploadComplete(result.results);
      } else {
        setFiles(prev =>
          prev.map(f =>
            f.status === 'uploading' ? { ...f, status: 'error', error: result.error } : f
          )
        );
      }
    } catch (error) {
      console.error('Erreur upload:', error);
      setFiles(prev =>
        prev.map(f =>
          f.status === 'uploading'
            ? { ...f, status: 'error', error: 'Erreur de connexion' }
            : f
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [onUploadComplete, setIsLoading]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  }, [processFiles]);

  const removeFile = (fileName: string) => {
    setFiles(prev => prev.filter(f => f.name !== fileName));
  };

  const clearAll = () => {
    setFiles([]);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Zone de drop */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-8 transition-all duration-300 ${
          dragActive
            ? 'border-blue-500 bg-blue-50 scale-[1.02]'
            : 'border-gray-300 hover:border-gray-400 bg-white'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          accept=".xlsx,.xls"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isLoading}
        />

        <div className="flex flex-col items-center justify-center space-y-4 pointer-events-none">
          <div className={`p-4 rounded-full transition-colors duration-300 ${
            dragActive ? 'bg-blue-100' : 'bg-gray-100'
          }`}>
            {isLoading ? (
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            ) : (
              <Upload className={`w-12 h-12 transition-colors duration-300 ${
                dragActive ? 'text-blue-500' : 'text-gray-400'
              }`} />
            )}
          </div>

          <div className="text-center">
            <p className="text-lg font-semibold text-gray-700">
              {isLoading ? 'Analyse en cours...' : 'Glissez vos fichiers Excel ici'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              ou cliquez pour sélectionner des fichiers
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Formats supportés: .xlsx, .xls
            </p>
          </div>
        </div>
      </div>

      {/* Liste des fichiers */}
      {files.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">
              Fichiers ({files.length})
            </h3>
            <button
              onClick={clearAll}
              className="text-xs text-red-500 hover:text-red-700 transition-colors"
            >
              Tout effacer
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-300 ${
                  file.status === 'success'
                    ? 'bg-green-50 border-green-200'
                    : file.status === 'error'
                    ? 'bg-red-50 border-red-200'
                    : file.status === 'uploading'
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <FileSpreadsheet className={`w-5 h-5 ${
                    file.status === 'success'
                      ? 'text-green-500'
                      : file.status === 'error'
                      ? 'text-red-500'
                      : 'text-gray-500'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-gray-700 truncate max-w-xs">
                      {file.name}
                    </p>
                    {file.error && (
                      <p className="text-xs text-red-500 mt-0.5">{file.error}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {file.status === 'uploading' && (
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  )}
                  {file.status === 'success' && (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  )}
                  {file.status === 'error' && (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                  <button
                    onClick={() => removeFile(file.name)}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
