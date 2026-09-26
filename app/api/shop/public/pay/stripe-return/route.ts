import { NextRequest, NextResponse } from 'next/server';
import { finishStripe } from '@/lib/shop/actions/public';

export const runtime = 'nodejs';

// GET /api/shop/public/pay/stripe-return?doc=&session_id= — Stripe Checkout success redirect.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  try {
    return NextResponse.redirect(await finishStripe(sp.get('doc') || '', sp.get('session_id') || ''));
  } catch (err) {
    console.error('[shop/public] Stripe return failed:', err);
    return NextResponse.redirect(new URL(`/shop-doc/${encodeURIComponent(sp.get('doc') || '')}?payment=failed`, request.url));
  }
}
