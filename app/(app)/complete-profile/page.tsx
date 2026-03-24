import { Suspense } from 'react';
import CompleteProfileContent from './complete-profile-content';

export default function CompleteProfilePage() {
  return (
    <Suspense>
      <CompleteProfileContent />
    </Suspense>
  );
}
