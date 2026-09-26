import { NextRequest, NextResponse } from 'next/server';
import { finishPaypal } from '@/lib/shop/actions/public';

export const runtime = 'nodejs';

// GET /api/shop/public/pay/paypal-return?doc=&token=<paypal order id>&PayerID= — PayPal approval redirect.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  try {
    return NextResponse.redirect(await finishPaypal(sp.get('doc') || '', sp.get('token') || ''));
  } catch (err) {
    console.error('[shop/public] PayPal return failed:', err);
    return NextResponse.redirect(new URL(`/shop-doc/${encodeURIComponent(sp.get('doc') || '')}?payment=failed`, request.url));
  }
}
