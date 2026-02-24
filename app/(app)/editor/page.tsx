import { Suspense } from 'react';
import EditorContent from './editor-content-v2';
import EditorLoadingScreen from '../../components/EditorLoadingScreen';

export default function EditorPage() {
  return (
    <Suspense
      fallback={<EditorLoadingScreen />}
    >
      <EditorContent />
    </Suspense>
  );
}
