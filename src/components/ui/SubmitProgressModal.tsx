import React from 'react';
import { Image as ImageIcon, Database, Mail, CheckCircle2 } from 'lucide-react';

export type SubmitState = 'idle' | 'uploading_image' | 'saving_database' | 'sending_email' | 'success';

interface SubmitProgressModalProps {
  submitState: SubmitState;
  hasFiles: boolean;
}

export default function SubmitProgressModal({ submitState, hasFiles }: SubmitProgressModalProps) {
  if (submitState === 'idle') return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="w-full max-w-sm px-6">
        <h3 className="text-xl font-bold text-center mb-8 text-[var(--brand-primary)] dark:text-white">
          Traitement de votre demande...
        </h3>
        <div className="space-y-6">
          {[
            { id: 'uploading_image', icon: <ImageIcon size={20} />, label: "Vérification et upload de l'ordonnance..." },
            { id: 'saving_database', icon: <Database size={20} />, label: "Enregistrement dans le dossier patient..." },
            { id: 'sending_email', icon: <Mail size={20} />, label: "Transmission au laboratoire en cours..." },
            { id: 'success', icon: <CheckCircle2 size={24} />, label: "Demande confirmée !" }
          ].map((step, index) => {
            const stepOrder = ['uploading_image', 'saving_database', 'sending_email', 'success'];
            const currentStepIndex = stepOrder.indexOf(submitState);
            const isCompleted = currentStepIndex > index || submitState === 'success';
            const isCurrent = currentStepIndex === index && submitState !== 'success';
            const isPending = currentStepIndex < index && submitState !== 'success';

            // Si l'utilisateur n'a pas d'ordonnance, on peut sauter visuellement cette étape
            if (step.id === 'uploading_image' && !hasFiles && submitState !== 'uploading_image') {
              return null; 
            }

            return (
              <div key={step.id} className={`flex items-center gap-4 transition-all duration-500 ${isPending ? 'opacity-40 translate-y-2' : 'opacity-100 translate-y-0'} ${isCurrent ? 'scale-105' : 'scale-100'}`}>
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg shadow-sm transition-colors duration-500 ${
                  isCompleted ? 'bg-[var(--status-success)]/10 text-[var(--status-success)]' :
                  isCurrent ? 'bg-[var(--color-fuchsia-pale)] text-[var(--brand-primary)] animate-pulse' :
                  'bg-gray-100 text-gray-400 dark:bg-gray-800'
                }`}>
                  {isCompleted ? <CheckCircle2 size={20} /> : step.icon}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium transition-colors duration-500 ${
                    isCompleted ? 'text-[var(--status-success)]' :
                    isCurrent ? 'text-blue-600 dark:text-blue-400 font-bold' :
                    'text-gray-500 dark:text-gray-400'
                  }`}>
                    {step.label}
                  </p>
                  {isCurrent && (
                    <div className="w-full h-1.5 mt-2 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                      <div className="h-full bg-[var(--color-fuchsia-accent)] rounded-lg animate-[progress_1.5s_ease-in-out_infinite]" style={{ width: '100%', transformOrigin: 'left' }}></div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes progress {
          0% { transform: scaleX(0); opacity: 0.1; }
          50% { transform: scaleX(0.5); opacity: 1; }
          100% { transform: scaleX(1); opacity: 0.1; }
        }
      `}} />
    </div>
  );
}
