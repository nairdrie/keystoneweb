import { Suspense } from 'react';
import AdminShell from './admin-shell';
import EditorLoadingScreen from '../../components/EditorLoadingScreen';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Keystone Admin Dashboard',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<EditorLoadingScreen />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
