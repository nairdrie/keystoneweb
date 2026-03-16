import { Suspense } from 'react';
import Header from '@/app/components/Header';
import ForgotPasswordContent from './forgot-password-content';

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-black">
      <Header />
      <Suspense fallback={<div className="flex items-center justify-center min-h-[calc(100vh-80px)]"><div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
        <ForgotPasswordContent />
      </Suspense>
    </div>
  );
}
