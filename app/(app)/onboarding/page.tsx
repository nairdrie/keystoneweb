import { Suspense } from 'react';
import OnboardingWizard from '@/app/components/OnboardingWizard';

export const metadata = {
  title: 'Get Started - Keystone Web',
  description: 'Choose your business type and template to build your website in minutes',
};

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OnboardingWizard />
    </Suspense>
  );
}
