import { NextRequest } from 'next/server';
import { revokeDevice } from '@/lib/shop/actions/admin';
import { owner, run } from '@/lib/shop/http';

export const runtime = 'nodejs';

// DELETE /api/shop/settings/devices?siteId=&id= — sign a bay phone/tablet out.
export async function DELETE(request: NextRequest) {
  return run(async () => revokeDevice(await owner(request), request.nextUrl.searchParams.get('id') || ''));
}
