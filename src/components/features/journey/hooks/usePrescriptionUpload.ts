"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getClientStorage } from '@/config/firebase';

/**
 * Téléversement des ordonnances EN ARRIÈRE-PLAN, dès la sélection des fichiers.
 *
 * Repris de `src/app/[lang]/rendez-vous/page.tsx` (la meilleure des deux
 * versions : /glabo, lui, téléverse au moment de l'envoi, ce qui fait patienter
 * le patient au pire moment). À l'envoi, on se contente d'attendre la promesse
 * déjà en vol.
 *
 * ⚠ `versionRef` est LOAD-BEARING : il invalide le lot en cours quand la liste
 * de fichiers change (le patient retire une photo pendant l'envoi). Un lot
 * périmé résout `[]`, et l'appelant doit tolérer ce cas. Ne pas « simplifier ».
 *
 * ⚠ `storage` est rempli par une promesse flottante dans `src/config/firebase.ts`
 * et vaut légitimement `null` au premier usage — d'où `getClientStorage()`.
 */
export type FileUploadState = 'uploading' | 'done' | 'error';

export interface UsePrescriptionUploadResult {
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  filePreviews: string[];
  setFilePreviews: React.Dispatch<React.SetStateAction<string[]>>;
  fileError: string;
  setFileError: React.Dispatch<React.SetStateAction<string>>;
  fileUploadStates: FileUploadState[];
  /** true tant qu'au moins un fichier est en cours de téléversement. */
  isUploading: boolean;
  /** Attend le lot en vol et renvoie les URL. Téléverse à la volée si rien n'était lancé. */
  resolveUrls: () => Promise<string[]>;
  /** Vide tout (passage « j'ai une ordonnance » → « je n'en ai pas »). */
  reset: () => void;
}

export function usePrescriptionUpload(): UsePrescriptionUploadResult {
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [fileError, setFileError] = useState('');
  const [fileUploadStates, setFileUploadStates] = useState<FileUploadState[]>([]);
  const uploadPromiseRef = useRef<Promise<string[]> | null>(null);
  const versionRef = useRef(0);

  useEffect(() => {
    if (files.length === 0) {
      uploadPromiseRef.current = null;
      setFileUploadStates([]);
      return;
    }

    versionRef.current += 1;
    const version = versionRef.current;
    const batch = files;

    setFileUploadStates(batch.map(() => 'uploading' as FileUploadState));

    const run = async (): Promise<string[]> => {
      const storage = await getClientStorage();
      if (!storage) {
        if (versionRef.current === version) {
          setFileUploadStates(batch.map(() => 'error' as FileUploadState));
        }
        return [];
      }
      const urls: string[] = [];
      for (let i = 0; i < batch.length; i += 1) {
        // Lot périmé : le patient a changé sa sélection, on abandonne.
        if (versionRef.current !== version) return [];
        try {
          const storageRef = ref(storage, `ordonnances/${Date.now()}-${batch[i].name}`);
          await uploadBytes(storageRef, batch[i]);
          urls.push(await getDownloadURL(storageRef));
          if (versionRef.current === version) {
            setFileUploadStates((prev) => {
              const next = [...prev];
              next[i] = 'done';
              return next;
            });
          }
        } catch (err) {
          console.error('Pré-téléversement ordonnance échoué', err);
          if (versionRef.current === version) {
            setFileUploadStates((prev) => {
              const next = [...prev];
              next[i] = 'error';
              return next;
            });
          }
        }
      }
      return versionRef.current === version ? urls : [];
    };

    const promise = run();
    uploadPromiseRef.current = promise;
    void promise.catch(() => undefined);
  }, [files]);

  const resolveUrls = useCallback(async (): Promise<string[]> => {
    if (files.length === 0) return [];
    if (uploadPromiseRef.current) {
      const urls = await uploadPromiseRef.current;
      // Un lot périmé résout `[]` alors que des fichiers sont bien présents :
      // dans ce cas seulement, on téléverse maintenant plutôt que d'envoyer
      // une demande sans son ordonnance.
      if (urls.length > 0) return urls;
    }
    const storage = await getClientStorage();
    if (!storage) return [];
    const urls: string[] = [];
    for (const file of files) {
      try {
        const storageRef = ref(storage, `ordonnances/${Date.now()}-${file.name}`);
        await uploadBytes(storageRef, file);
        urls.push(await getDownloadURL(storageRef));
      } catch (err) {
        console.error('Téléversement ordonnance échoué', err);
      }
    }
    return urls;
  }, [files]);

  const reset = useCallback(() => {
    versionRef.current += 1;
    uploadPromiseRef.current = null;
    setFiles([]);
    setFilePreviews([]);
    setFileError('');
    setFileUploadStates([]);
  }, []);

  return {
    files,
    setFiles,
    filePreviews,
    setFilePreviews,
    fileError,
    setFileError,
    fileUploadStates,
    isUploading: fileUploadStates.some((s) => s === 'uploading'),
    resolveUrls,
    reset,
  };
}
