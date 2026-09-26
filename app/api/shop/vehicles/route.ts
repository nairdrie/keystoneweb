import { NextRequest } from 'next/server';
import { createVehicle } from '@/lib/shop/actions/admin';
import { ownerJson, run } from '@/lib/shop/http';

export const runtime = 'nodejs';

// POST /api/shop/vehicles — { customer_id, year, make, model, vin, plate, ... }
export async function POST(request: NextRequest) {
  return run(async () => {
    const { access, body } = await ownerJson(request);
    return createVehicle(access, body.customer_id, body);
  });
}
