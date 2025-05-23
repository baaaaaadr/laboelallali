'use client';

import { Download } from 'lucide-react';
import PWAInstallButton from '@/components/features/pwa/PWAInstallButton';

export default function TestStylesPage() {
  return (
    <main className="min-h-screen bg-white p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Style Testing Page</h1>
        
        <div className="space-y-8">
          {/* Test Case 1 */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-800">1 - PWAInstallButton (Default - attempting internal arbitrary styles from last test)</h3>
            <div className="p-4 border rounded-lg bg-gray-50">
              <PWAInstallButton variant="button" />
            </div>
          </div>

          {/* Test Case 2 */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-800">2 - Div with Arbitrary Value Background</h3>
            <div className="p-4 border rounded-lg bg-gray-50">
              <div className="w-40 h-20 p-4 bg-[#FF4081] text-[#FFFFFF] flex items-center justify-center rounded-lg">
                Fuchsia Div Arbitrary
              </div>
            </div>
          </div>

          {/* Test Case 3 */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-800">3 - Button with Arbitrary Value Background</h3>
            <div className="p-4 border rounded-lg bg-gray-50">
              <button className="p-4 bg-[#FF4081] text-[#FFFFFF] rounded-lg">
                Button Fuchsia Arbitrary
              </button>
            </div>
          </div>

          {/* Test Case 4 */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-800">4 - Button with Global Class: .bg-bordeaux-custom</h3>
            <div className="p-4 border rounded-lg bg-gray-50">
              <button className="p-4 bg-bordeaux-custom rounded-lg">
                Button Bordeaux Global
              </button>
            </div>
          </div>

          {/* Test Case 5 */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-800">5 - Button with Global Class: .btn-primary (Plain CSS version)</h3>
            <div className="p-4 border rounded-lg bg-gray-50">
              <button className="p-4 btn-primary">
                Button .btn-primary (Plain CSS)
              </button>
            </div>
          </div>

          {/* Test Case 6 */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-800">6 - Button with Global Class: .btn-primary-apply (@apply version)</h3>
            <div className="p-4 border rounded-lg bg-gray-50">
              <button className="p-4 btn-primary-apply">
                Button .btn-primary-apply (@apply)
              </button>
            </div>
          </div>

          {/* Test Case 7 */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-800">7 - PWAInstallButton (Styled externally with .btn-primary class)</h3>
            <div className="p-4 border rounded-lg bg-gray-50">
              <PWAInstallButton variant="button" className="btn-primary" />
            </div>
          </div>

          {/* Test Case 8 */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-800">8 - DEFAULT TAILWIND TEST (Div with bg-red-500)</h3>
            <div className="p-4 border rounded-lg bg-gray-50">
              <div className="p-4 bg-red-500 text-yellow-300 rounded-lg">
                DEFAULT TAILWIND TEST
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
