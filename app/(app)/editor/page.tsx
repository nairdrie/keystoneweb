import { Suspense } from 'react';
import EditorContent from './editor-content-v2';
import EditorLoadingScreen from '../../components/EditorLoadingScreen';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Keystone Editor",
};

export default function EditorPage() {
  return (
    <Suspense
      fallback={<EditorLoadingScreen />}
    >
      <EditorContent />
    </Suspense>
  );
}
