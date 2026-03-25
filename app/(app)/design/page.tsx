import { Suspense } from 'react';
import EditorContent from '../editor/editor-content-v2';
import EditorLoadingScreen from '../../components/EditorLoadingScreen';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Keystone Design Studio",
};

export default function DesignPage() {
  return (
    <Suspense fallback={<EditorLoadingScreen />}>
      <EditorContent />
    </Suspense>
  );
}
