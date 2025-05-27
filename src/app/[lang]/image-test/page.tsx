import React from 'react';
import ImageTest from '@/components/features/home/ImageTest';

export default function ImageTestPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-[var(--color-bordeaux-primary)] dark:text-[var(--text-primary)]">
        Image Loading Test Page
      </h1>
      <p className="mb-6 text-[var(--text-secondary)]">
        This page tests different ways of loading the hero banner image.
      </p>
      <ImageTest />
    </div>
  );
}
