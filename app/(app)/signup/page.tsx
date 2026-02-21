import { Suspense } from 'react';
import Header from '@/app/components/Header';
import SignUpContent from './signup-content';

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-black">
      <Header />
      <Suspense fallback={<div className="flex items-center justify-center min-h-[calc(100vh-80px)]"><div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div></div>}>
        <SignUpContent />
      </Suspense>
    </div>
  );
}
