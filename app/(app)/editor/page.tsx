import { Suspense } from 'react';
import EditorContent from './editor-content';

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full h-screen flex items-center justify-center bg-white">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mb-4"></div>
            <p className="text-slate-600">Loading editor...</p>
          </div>
        </div>
      }
    >
      <EditorContent />
    </Suspense>
  );
}
