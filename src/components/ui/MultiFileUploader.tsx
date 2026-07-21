import React, { useRef, useState, useEffect, lazy, Suspense } from 'react';
import { FileText, X, Eye, Image as ImageIcon, File as FileIcon, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import MedicalLoader from './MedicalLoader';

// Lazy-load react-pdf to avoid SSR issues (DOMMatrix not defined)
const LazyDocument = lazy(() => import('react-pdf').then(mod => {
  // Configure worker on first load
  mod.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${mod.pdfjs.version}/build/pdf.worker.min.mjs`;
  // Import CSS
  import('react-pdf/dist/Page/AnnotationLayer.css');
  import('react-pdf/dist/Page/TextLayer.css');
  return { default: mod.Document };
}));
const LazyPage = lazy(() => import('react-pdf').then(mod => ({ default: mod.Page })));

export type FileUploadState = 'uploading' | 'done' | 'error';

export interface MultiFileUploaderProps {
  files: File[];
  filePreviews: string[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  setFilePreviews: React.Dispatch<React.SetStateAction<string[]>>;
  error: string;
  setError: React.Dispatch<React.SetStateAction<string>>;
  fileUploadStates?: FileUploadState[];
  maxSizeMB?: number;
  acceptedTypes?: string[];
}

interface PreviewData {
  type: 'image' | 'pdf';
  url: string;
  name: string;
}

export default function MultiFileUploader({
  files,
  filePreviews,
  setFiles,
  setFilePreviews,
  error,
  setError,
  fileUploadStates = [],
  maxSizeMB = 5,
  acceptedTypes = ['image/jpeg', 'image/png', 'application/pdf']
}: MultiFileUploaderProps) {
  const { t } = useTranslation(['appointment']);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [pdfPages, setPdfPages] = useState<number>(0);
  const [pdfPage, setPdfPage] = useState<number>(1);
  const [pdfScale, setPdfScale] = useState<number>(1.2);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    setError('');
    
    if (selectedFiles.length > 0) {
      const newValidFiles: File[] = [];
      let hasError = false;

      selectedFiles.forEach(file => {
        if (!acceptedTypes.includes(file.type)) {
          setError(t('invalid_file_type', { defaultValue: 'Format de fichier non valide. Veuillez utiliser JPG, PNG ou PDF.' }));
          hasError = true;
          return;
        }
        
        if (file.size > maxSizeMB * 1024 * 1024) {
          setError(t('file_too_large', { defaultValue: `La taille du fichier dépasse la limite de ${maxSizeMB}MB.` }));
          hasError = true;
          return;
        }
        
        newValidFiles.push(file);
      });

      if (!hasError && newValidFiles.length > 0) {
        const startIndex = files.length;
        setFiles(prev => [...prev, ...newValidFiles]);
        setFilePreviews(prev => [...prev, ...newValidFiles.map(() => '')]);
        
        newValidFiles.forEach((file, index) => {
          if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
              const result = e.target?.result as string;
              setFilePreviews(prev => {
                const newList = [...prev];
                newList[startIndex + index] = result;
                return newList;
              });
            };
            reader.readAsDataURL(file);
          } else if (file.type === 'application/pdf') {
            // For PDFs, store the data URL for preview
            const reader = new FileReader();
            reader.onload = (e) => {
              const result = e.target?.result as string;
              setFilePreviews(prev => {
                const newList = [...prev];
                newList[startIndex + index] = result;
                return newList;
              });
            };
            reader.readAsDataURL(file);
          }
        });
      }
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeFile = (indexToRemove: number) => {
    setFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
    setFilePreviews(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const openPreview = (e: React.MouseEvent, file: File, previewUrl: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (previewUrl) {
      const type = file.type === 'application/pdf' ? 'pdf' : 'image';
      setPreviewData({ type, url: previewUrl, name: file.name });
      setPdfPage(1);
      setPdfScale(1.2);
    }
  };

  const closePreview = () => {
    setPreviewData(null);
    setPdfPages(0);
    setPdfPage(1);
  };

  // Prevent scroll when modal is open
  useEffect(() => {
    if (previewData) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [previewData]);

  // Keyboard navigation for PDF
  useEffect(() => {
    if (!previewData) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePreview();
      if (previewData.type === 'pdf') {
        if (e.key === 'ArrowRight' && pdfPage < pdfPages) setPdfPage(p => p + 1);
        if (e.key === 'ArrowLeft' && pdfPage > 1) setPdfPage(p => p - 1);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [previewData, pdfPage, pdfPages]);

  return (
    <div className="w-full">
      {/* Upload zone */}
      <div className="bg-[var(--background-secondary)] border border-dashed border-[var(--border-default)] rounded-lg p-6 text-center transition-colors hover:border-[var(--color-fuchsia-accent)]">
        <FileText className="mx-auto h-8 w-8 text-gray-400 mb-3" />
        <label htmlFor="prescriptionFile" className="block text-sm font-medium text-[var(--text-primary)] mb-2 cursor-pointer">
          {t('prescription_upload_label', { defaultValue: 'Téléchargez votre ordonnance (Plusieurs fichiers acceptés)' })}
        </label>
        <div className="flex justify-center" suppressHydrationWarning>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-2 bg-[var(--color-fuchsia-pale)] dark:bg-[var(--background-tertiary)] text-[var(--color-fuchsia-accent)] hover:bg-[var(--color-fuchsia-accent)] hover:text-white dark:hover:bg-[var(--color-fuchsia-accent)] dark:hover:text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
          >
            <FileText size={16} />
            {t('select_files')}
          </button>
          <input
            type="file"
            id="prescriptionFile"
            name="prescriptionFile"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept={acceptedTypes.join(',')}
            multiple
            className="hidden"
          />
        </div>
        {error && (
          <p className="mt-3 text-sm text-[var(--status-error)] font-medium">{error}</p>
        )}
      </div>

      {/* File cards */}
      {files.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {files.map((file, idx) => {
            const isPdf = file.type === 'application/pdf';
            const hasPreview = filePreviews[idx] && filePreviews[idx] !== '';
            
            const uploadState = fileUploadStates[idx];
            const isUploading = uploadState === 'uploading';
            const isUploadError = uploadState === 'error';

            return (
              <div key={`${file.name}-${idx}`} className="relative p-3 pr-8 bg-[var(--background-card)] rounded-lg text-left shadow-sm border border-[var(--border-default)] group">
                {/* Delete button */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                  className="absolute top-2 right-2 p-1 rounded-lg transition-colors z-10"
                  style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}
                >
                  <X size={14} />
                </button>

                <p className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[150px] flex items-center gap-2 mb-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isUploadError ? '#DC2626' : isUploading ? '#F59E0B' : '#22C55E' }}
                  />
                  <span className="truncate text-xs">{file.name}</span>
                </p>

                {/* Thumbnail */}
                <div className="relative h-24 w-24">
                  {hasPreview && !isPdf ? (
                    <div
                      className="relative cursor-pointer rounded-lg overflow-hidden group/img h-full w-full"
                      onClick={(e) => !isUploading && openPreview(e, file, filePreviews[idx])}
                    >
                      <img
                        src={filePreviews[idx]}
                        alt={`${t('preview', { defaultValue: 'Aperçu' })} ${idx + 1}`}
                        className="h-full w-full object-cover border border-gray-200 dark:border-gray-700 transition-transform duration-300 group-hover/img:scale-110"
                      />
                      {!isUploading && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity duration-300">
                          <Eye className="text-white" size={24} />
                        </div>
                      )}
                    </div>
                  ) : isPdf ? (
                    <div
                      className="h-full w-full rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center flex-col cursor-pointer group/pdf relative overflow-hidden"
                      style={{ backgroundColor: '#FEF2F2' }}
                      onClick={(e) => (!isUploading && hasPreview) ? openPreview(e, file, filePreviews[idx]) : undefined}
                    >
                      <FileIcon className="mb-1 transition-transform duration-300 group-hover/pdf:scale-110" size={28} style={{ color: '#DC2626' }} />
                      <span className="text-xs uppercase font-semibold" style={{ color: '#991B1B' }}>PDF</span>
                      {!isUploading && hasPreview && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/pdf:opacity-100 flex items-center justify-center transition-opacity duration-300">
                          <Eye className="text-white" size={24} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full w-full bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center flex-col">
                      <ImageIcon className="text-gray-400 mb-1" size={24} />
                      <span className="text-xs text-gray-500 uppercase">{file.type.split('/')[1] || t('file', { defaultValue: 'Fichier' })}</span>
                    </div>
                  )}

                  {/* Upload spinner overlay */}
                  {isUploading && (
                    <div className="absolute inset-0 rounded-lg flex flex-col items-center justify-center gap-1" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
                      <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="text-white text-[10px] font-medium">{t('uploading', { defaultValue: 'Envoi...' })}</span>
                    </div>
                  )}

                  {/* Error overlay */}
                  {isUploadError && (
                    <div className="absolute inset-0 rounded-lg flex flex-col items-center justify-center gap-1" style={{ backgroundColor: 'rgba(220,38,38,0.6)' }}>
                      <X className="text-white" size={20} />
                      <span className="text-white text-[10px] font-medium">{t('error', { defaultValue: 'Erreur' })}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      {previewData && (
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
          onClick={closePreview}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
        >
          {/* Close button */}
          <button 
            className="fixed top-[calc(1rem_+_var(--safe-area-top))] right-4 p-2.5 rounded-lg text-white transition-all hover:scale-110 z-[100000]"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
            onClick={(e) => { e.stopPropagation(); closePreview(); }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'; }}
          >
            <X size={24} />
          </button>

          {/* File name badge */}
          <div 
            className="fixed top-[calc(1rem_+_var(--safe-area-top))] left-4 px-4 py-2 rounded-lg text-white text-sm font-medium max-w-[60vw] truncate z-[100000]"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}
          >
            {previewData.name}
          </div>

          {/* Content container */}
          <div 
            className="relative max-w-4xl w-full max-h-[85vh] rounded-lg overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(40px)' }}
          >
            {previewData.type === 'image' ? (
              /* Image preview */
              <div className="flex items-center justify-center p-6 min-h-[300px]">
                <img 
                  src={previewData.url} 
                  alt={t('fullscreen_preview')}
                  className="max-w-full max-h-[80vh] object-contain rounded-lg"
                  style={{ 
                    filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.3))',
                    animation: 'modalIn 0.3s ease-out'
                  }}
                />
              </div>
            ) : (
              /* PDF preview */
              <div className="flex flex-col items-center">
                {/* PDF toolbar */}
                <div 
                  className="w-full flex items-center justify-between px-4 py-3 border-b"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.1)' }}
                >
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setPdfPage(p => Math.max(1, p - 1))}
                      disabled={pdfPage <= 1}
                      className="p-1.5 rounded-lg text-white transition-colors disabled:opacity-30"
                      style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span className="text-white text-sm font-medium min-w-[80px] text-center">
                      {pdfPage} / {pdfPages || '...'}
                    </span>
                    <button 
                      onClick={() => setPdfPage(p => Math.min(pdfPages, p + 1))}
                      disabled={pdfPage >= pdfPages}
                      className="p-1.5 rounded-lg text-white transition-colors disabled:opacity-30"
                      style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setPdfScale(s => Math.max(0.5, s - 0.2))}
                      className="p-1.5 rounded-lg text-white transition-colors"
                      style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                    >
                      <ZoomOut size={18} />
                    </button>
                    <span className="text-white text-xs min-w-[40px] text-center">{Math.round(pdfScale * 100)}%</span>
                    <button 
                      onClick={() => setPdfScale(s => Math.min(3, s + 0.2))}
                      className="p-1.5 rounded-lg text-white transition-colors"
                      style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                    >
                      <ZoomIn size={18} />
                    </button>
                  </div>
                </div>

                <div className="overflow-auto max-h-[75vh] w-full flex justify-center p-4">
                  <Suspense fallback={
                    <div className="flex items-center justify-center py-20">
                      <MedicalLoader size="sm" />
                    </div>
                  }>
                    <LazyDocument 
                      file={previewData.url}
                      onLoadSuccess={({ numPages }: { numPages: number }) => setPdfPages(numPages)}
                      loading={
                        <div className="flex items-center justify-center py-20">
                          <MedicalLoader size="sm" />
                        </div>
                      }
                      error={
                        <div className="flex flex-col items-center justify-center py-20 text-white/70">
                          <FileIcon size={48} className="mb-3" />
                          <p className="text-sm">{t('pdf_load_error')}</p>
                        </div>
                      }
                    >
                      <LazyPage 
                        pageNumber={pdfPage} 
                        scale={pdfScale}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        className="shadow-xl rounded-lg overflow-hidden"
                      />
                    </LazyDocument>
                  </Suspense>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal animation keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}} />
    </div>
  );
}
