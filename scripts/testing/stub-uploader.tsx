/**
 * Doublure de `@/components/ui/MultiFileUploader`.
 *
 * Le vrai composant importe `react-pdf/dist/Page/AnnotationLayer.css`, un
 * chemin qui ne se résout que dans la chaîne de compilation de Next. Ce qui
 * nous intéresse ici n'est pas le sélecteur de fichiers mais le fait qu'une
 * ordonnance JOINTE fasse basculer `intentDone` — d'où un bouton qui ajoute un
 * faux fichier.
 */
import React from 'react';

export interface StubUploaderProps {
  files: File[];
  setFiles: (f: File[]) => void;
  filePreviews?: unknown;
  setFilePreviews?: (v: unknown) => void;
  error?: string | null;
  setError?: (v: string | null) => void;
  fileUploadStates?: unknown;
}

export default function MultiFileUploader({ files, setFiles }: StubUploaderProps) {
  return (
    <div data-testid="uploader">
      <span data-testid="uploader-count">{files.length}</span>
      <button
        type="button"
        data-testid="uploader-add"
        onClick={() =>
          setFiles([...files, new File(['ordo'], `ordonnance-${files.length + 1}.jpg`, { type: 'image/jpeg' })])
        }
      >
        Joindre une ordonnance (banc d&apos;essai)
      </button>
    </div>
  );
}
