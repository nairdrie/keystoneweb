import { NextRequest } from 'next/server';
import { createJob, type CreateJobInput } from '@/lib/shop/actions/jobs';
import { ownerJson, run } from '@/lib/shop/http';

export const runtime = 'nodejs';

// POST /api/shop/jobs — log a drop-off (customer, vehicle, complaint, key tag, estimate fee).
export async function POST(request: NextRequest) {
  return run(async () => {
    const { access, body } = await ownerJson<CreateJobInput & Record<string, unknown>>(request);
    return createJob(access, body);
  });
}
