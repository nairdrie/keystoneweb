import { NextRequest } from 'next/server';
import { ShopRuleError } from '@/lib/shop/access';
import { recordPayment, sendInvoice, voidInvoice } from '@/lib/shop/actions/invoices';
import { ownerJson, run } from '@/lib/shop/http';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/shop/invoices/:id — { action: send | void | payment }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const { id } = await params;
    const { access, body } = await ownerJson<Record<string, unknown>>(request);
    switch (body.action) {
      case 'send': return sendInvoice(access, id, body);
      case 'void': return voidInvoice(access, id, body.reason);
      case 'payment': {
        // Online payments are recorded by the Stripe/PayPal return routes only.
        const { provider_ref: _ignored, ...manual } = body;
        void _ignored;
        if (manual.method === 'stripe' || manual.method === 'paypal') throw new ShopRuleError('Online payments are recorded automatically.', undefined, 400);
        return recordPayment(access, id, manual);
      }
      default: throw new ShopRuleError('Unknown action.', undefined, 400);
    }
  });
}
