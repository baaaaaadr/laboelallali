'use client';

import { Download } from 'lucide-react';
import PWAInstallButton from '@/components/features/pwa/PWAInstallButton';

export default function TestStylesPage() {
  return (
    <main className="min-h-screen bg-[var(--background-secondary)] p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-8">Style Testing Page</h1>
        
        <div className="space-y-8">
          {/* Test Case 1 */}
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Test Case 1: Primary Button</h2>
            <div className="p-4 border border-[var(--border-default)] rounded-lg bg-[var(--background-tertiary)]">
              <PWAInstallButton variant="button" />
            </div>
          </div>

          {/* Test Case 2 */}
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Test Case 2: Typography</h2>
            <div className="p-4 border border-[var(--border-default)] rounded-lg bg-[var(--background-tertiary)]">
              <div className="w-40 h-20 p-4 bg-[var(--accent-fuchsia)] text-white flex items-center justify-center rounded-lg">
                Fuchsia Div Arbitrary
              </div>
            </div>
          </div>

          {/* Test Case 3 */}
          <div className="space-y-2">
            <p className="text-[var(--text-secondary)] mb-4">This is a primary button with hover and focus states.</p>
            <div className="p-4 border border-[var(--border-default)] rounded-lg bg-[var(--background-tertiary)]">
              <button className="p-4 bg-[var(--accent-fuchsia)] text-white rounded-lg hover:bg-[var(--color-bordeaux-primary)] transition-colors">
                Button Fuchsia Arbitrary
              </button>
            </div>
          </div>

          {/* Test Case 4 */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">4 - Button with Global Class: .bg-bordeaux-custom</h3>
            <div className="p-4 border border-[var(--border-default)] rounded-lg bg-[var(--background-tertiary)]">
              <button className="p-4 bg-[var(--color-bordeaux-primary)] text-white rounded-lg hover:bg-[var(--color-bordeaux-dark)] transition-colors">
                Button Bordeaux Global
              </button>
            </div>
          </div>

          {/* Test Case 5 */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">5 - Button with Global Class: .btn-primary (Plain CSS version)</h3>
            <div className="p-4 border border-[var(--border-default)] rounded-lg bg-[var(--background-tertiary)]">
              <label className="flex items-center mt-4 text-[var(--text-secondary)]">
                <button className="p-4 bg-[var(--color-bordeaux-primary)] text-white rounded-lg hover:bg-[var(--color-bordeaux-dark)] transition-colors">
                  Button .btn-primary (Plain CSS)
                </button>
              </label>
            </div>
          </div>

          {/* Test Case 6 */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">6 - Button with Global Class: .btn-primary-apply (@apply version)</h3>
            <div className="p-4 border border-[var(--border-default)] rounded-lg bg-[var(--background-tertiary)]">
              <button className="p-4 bg-[var(--color-bordeaux-primary)] text-white rounded-lg hover:bg-[var(--color-bordeaux-dark)] transition-colors">
                Button .btn-primary-apply (@apply)
              </button>
            </div>
          </div>

          {/* Test Case 7 */}
          <div className="space-y-2">
            <p className="text-sm text-[var(--text-tertiary)] mt-2">This is a small text example, often used for captions or secondary information.</p>
            <div className="p-4 border border-[var(--border-default)] rounded-lg bg-[var(--background-tertiary)]">
              <PWAInstallButton variant="button" className="btn-primary" />
            </div>
          </div>

          {/* Test Case 8 */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">8 - DEFAULT TAILWIND TEST (Div with bg-red-500)</h3>
            <div className="p-4 border border-[var(--border-default)] rounded-lg bg-[var(--background-tertiary)]">
              <div className="p-4 bg-[var(--accent-fuchsia)] text-white rounded-lg">
                DEFAULT TAILWIND TEST
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
