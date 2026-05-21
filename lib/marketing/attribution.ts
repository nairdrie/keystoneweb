/**
 * Conversion attribution.
 *
 * A click on a Keystone-managed ad lands on the customer's site with
 * utm_source=keystone&utm_campaign=<id>. The customer-site capture helper
 * (lib/marketing/utm-capture.ts) stores these in sessionStorage and merges
 * them into form/booking/order submissions, which the corresponding API
 * routes persist as a marketing_campaign_id FK.
 *
 * This module computes per-campaign conversion totals + revenue.
 */

import { createAdminClient } from '@/lib/db/supabase-admin';

export interface ConversionTotals {
  bookings: { count: number; revenueCents: number };
  orders: { count: number; revenueCents: number };
  members: { count: number };
  contacts: { count: number };
  totalCount: number;
  totalRevenueCents: number;
}

export async function getConversionTotals(campaignId: string): Promise<ConversionTotals> {
  const db = createAdminClient();

  const [bookingsRes, ordersRes, membersRes, contactsRes] = await Promise.all([
    db.from('bookings')
      .select('total_price_cents, price_cents, status', { count: 'exact' })
      .eq('marketing_campaign_id', campaignId)
      .neq('status', 'cancelled'),
    db.from('orders')
      .select('subtotal_cents, shipping_cents, tax_cents, status', { count: 'exact' })
      .eq('marketing_campaign_id', campaignId)
      .neq('status', 'cancelled'),
    db.from('members')
      .select('id', { count: 'exact', head: true })
      .eq('marketing_campaign_id', campaignId),
    db.from('contact_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('marketing_campaign_id', campaignId),
  ]);

  const bookingsRevenue = (bookingsRes.data || []).reduce(
    (s: number, r: { total_price_cents?: number; price_cents?: number }) =>
      s + (r.total_price_cents ?? r.price_cents ?? 0),
    0,
  );
  const ordersRevenue = (ordersRes.data || []).reduce(
    (s: number, r: { subtotal_cents?: number; shipping_cents?: number; tax_cents?: number }) =>
      s + (r.subtotal_cents || 0) + (r.shipping_cents || 0) + (r.tax_cents || 0),
    0,
  );

  const bookings = { count: bookingsRes.count ?? 0, revenueCents: bookingsRevenue };
  const orders = { count: ordersRes.count ?? 0, revenueCents: ordersRevenue };
  const members = { count: membersRes.count ?? 0 };
  const contacts = { count: contactsRes.count ?? 0 };

  return {
    bookings,
    orders,
    members,
    contacts,
    totalCount: bookings.count + orders.count + members.count + contacts.count,
    totalRevenueCents: bookingsRevenue + ordersRevenue,
  };
}
