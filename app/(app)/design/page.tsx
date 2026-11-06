import { Suspense } from 'react';
import DesignRouter from './DesignRouter';
import EditorLoadingScreen from '../../components/EditorLoadingScreen';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Keystone Design Studio",
};

export default function DesignPage() {
  return (
    <Suspense fallback={<EditorLoadingScreen />}>
      <DesignRouter />
    </Suspense>
  );
}
