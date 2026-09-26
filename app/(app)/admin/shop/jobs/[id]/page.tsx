'use client';

import { use } from 'react';
import JobFile from '@/app/components/shop/job/JobFile';

export default function ShopJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <JobFile jobId={id} />;
}
