/**
 * Hand a paid order to Printful after the response is sent (Next's after()),
 * so a slow or failing Printful call never delays or breaks a payment
 * confirmation. Every payment path calls this once the order is paid; it is a
 * no-op for orders without Printful items.
 */
import { after } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { fulfillPaidOrder } from './fulfillment';

export function queuePrintfulFulfillment(orderId: string | null | undefined): void {
  if (!orderId) return;
  const run = async () => {
    try {
      await fulfillPaidOrder(createAdminClient(), orderId);
    } catch (e) {
      console.error(`[printful] fulfillment for order ${orderId} failed`, e);
    }
  };
  try {
    after(run);
  } catch {
    void run();
  }
}
