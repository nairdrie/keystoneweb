'use client';

/**
 * Admin → Ecommerce → Fulfillment: connect Printful (OAuth when Keystone has a
 * Printful app, or a private token), the auto-confirm setting, the products
 * Printful fulfills, and recent Printful orders with retry / confirm / refresh.
 *
 * Products are linked to Printful by the site's AI agent over MCP (or by
 * asking the agent); there is no import screen here on purpose.
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, ExternalLink, Loader2, Package, RefreshCw, Truck } from 'lucide-react';

interface PfProduct { id: string; name: string; status: string; image: string | null; printful_product_id: number | null; variant_count: number; unavailable_variants: number; synced_at: string | null }
interface PfOrder { order_id: string; printful_order_id: number | null; status: string; confirmed: boolean; error: string | null; shipments: Array<{ id: number; carrier: string | null; tracking_number: string | null; tracking_url: string | null }>; attempts: number; created_at: string; customer_name: string | null; order_status: string | null }
interface Status {
  connected: boolean;
  auth_type?: 'oauth' | 'token';
  store_id?: number | null;
  store_name?: string | null;
  auto_confirm?: boolean;
  webhook_configured?: boolean;
  last_error?: string | null;
  connected_at?: string | null;
  oauth_available: boolean;
  products: PfProduct[];
  orders: PfOrder[];
}

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  submitting: { label: 'Sending…', tone: 'bg-slate-100 text-slate-600' },
  draft: { label: 'Draft — confirm to produce', tone: 'bg-amber-100 text-amber-800' },
  pending: { label: 'Confirmed', tone: 'bg-blue-100 text-blue-800' },
  inprocess: { label: 'In production', tone: 'bg-blue-100 text-blue-800' },
  partial: { label: 'Partly shipped', tone: 'bg-violet-100 text-violet-800' },
  fulfilled: { label: 'Shipped', tone: 'bg-green-100 text-green-800' },
  failed: { label: 'Failed', tone: 'bg-red-100 text-red-700' },
  onhold: { label: 'On hold', tone: 'bg-red-100 text-red-700' },
  canceled: { label: 'Cancelled', tone: 'bg-red-100 text-red-700' },
};

export default function FulfillmentPanel({ siteId }: { siteId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [storeId, setStoreId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/printful/connection?siteId=${siteId}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load fulfillment settings');
      setStatus(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load fulfillment settings');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    load();
    // Result of the Printful OAuth redirect.
    const q = new URLSearchParams(window.location.search);
    if (q.get('printful') === 'connected') setNotice('Printful is connected.');
    if (q.get('printful_error')) setError(q.get('printful_error'));
  }, [load]);

  const call = async (key: string, url: string, init: RequestInit, done?: string) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || 'Something went wrong');
      if (done) setNotice(done);
      await load();
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  const connectWithToken = async () => {
    const data = await call('token', '/api/printful/connection', { method: 'POST', body: JSON.stringify({ siteId, token: token.trim(), storeId: storeId.trim() || undefined }) }, 'Printful is connected.');
    if (data) { setToken(''); setStoreId(''); }
  };

  const orderAction = (orderId: string, action: 'retry' | 'confirm' | 'sync') =>
    call(`${action}:${orderId}`, '/api/printful/orders', { method: 'POST', body: JSON.stringify({ siteId, orderId, action }) },
      action === 'retry' ? 'Sent to Printful again.' : action === 'confirm' ? 'Confirmed: Printful will produce and ship it.' : 'Status refreshed.');

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
          <Check className="w-4 h-4 mt-0.5 shrink-0" /> <span>{notice}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <Truck className="w-4 h-4 text-slate-500" />
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Printful</h3>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-slate-600">
            Printful prints and ships products for you. When a customer pays for a Printful product, Keystone sends the order to
            Printful, and Printful&apos;s tracking is emailed to the customer when it ships. Customers pay you as usual; Printful bills you.
          </p>

          {status?.connected ? (
            <>
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Connected to {status.store_name || `store ${status.store_id}`}</p>
                  <p className="text-xs text-slate-500">
                    {status.auth_type === 'oauth' ? 'Signed in with Printful' : 'Private token'}
                    {status.connected_at ? ` · since ${new Date(status.connected_at).toLocaleDateString()}` : ''}
                    {status.webhook_configured ? ' · shipping updates on' : ' · shipping updates not set up'}
                  </p>
                </div>
                <button
                  onClick={() => { if (confirm('Disconnect Printful? Paid orders for Printful products will no longer be sent to Printful.')) call('disconnect', `/api/printful/connection?siteId=${siteId}`, { method: 'DELETE' }, 'Printful is disconnected.'); }}
                  disabled={busy !== null}
                  className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                >
                  Disconnect
                </button>
              </div>
              {status.last_error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{status.last_error}</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Confirm Printful orders automatically</p>
                  <p className="text-xs text-slate-500">
                    {status.auto_confirm
                      ? 'On: paid orders go straight into production and Printful charges your card.'
                      : 'Off: orders arrive in Printful as drafts. Confirm them here or in Printful to start production.'}
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={!!status.auto_confirm}
                  disabled={busy !== null}
                  onClick={() => call('auto', '/api/printful/connection', { method: 'PATCH', body: JSON.stringify({ siteId, auto_confirm: !status.auto_confirm }) })}
                  className={`relative w-11 h-6 shrink-0 rounded-full transition-colors disabled:opacity-50 ${status.auto_confirm ? 'bg-green-500' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${status.auto_confirm ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {status?.oauth_available && (
                <a
                  href={`/api/printful/oauth/start?siteId=${siteId}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-700"
                >
                  Connect Printful <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-800">{status?.oauth_available ? 'Or use a private token' : 'Connect with a Printful private token'}</p>
                <p className="text-xs text-slate-500">
                  In Printful, open <a className="underline" href="https://developers.printful.com/tokens" target="_blank" rel="noreferrer">developers.printful.com/tokens</a>,
                  create a token for your store with access to products, orders and webhooks, and paste it here. Keystone stores it encrypted and never shows it again.
                </p>
                <input
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Printful private token"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <input
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value.replace(/\D/g, ''))}
                  placeholder="Store id (only if the token has several stores)"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <button
                  onClick={connectWithToken}
                  disabled={!token.trim() || busy !== null}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-700 disabled:opacity-50"
                >
                  {busy === 'token' && <Loader2 className="w-4 h-4 animate-spin" />} Connect
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <Package className="w-4 h-4 text-slate-500" />
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Products fulfilled by Printful</h3>
        </div>
        <div className="p-4">
          {!status?.products.length ? (
            <p className="text-sm text-slate-500">
              None yet. Ask your site&apos;s AI agent to add your Printful products to the store: it reads them from Printful (sizes, colours,
              prices and mockups) and links each one. Other products are shipped by you or your vendors.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {status.products.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.image ? <img src={p.image} alt="" className="w-10 h-10 rounded object-cover bg-slate-100" /> : <div className="w-10 h-10 rounded bg-slate-100" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {p.printful_product_id ? `Printful #${p.printful_product_id} · ${p.variant_count} variants` : <span className="text-red-600">Not linked to a Printful product</span>}
                      {p.unavailable_variants ? <span className="text-amber-700"> · {p.unavailable_variants} out of stock at Printful</span> : null}
                      {p.status !== 'published' ? ' · draft' : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {!!status?.orders.length && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Recent Printful orders</h3>
          </div>
          <ul className="divide-y divide-slate-100">
            {status.orders.map((o) => {
              const s = STATUS_LABEL[o.status] || { label: o.status, tone: 'bg-slate-100 text-slate-600' };
              return (
                <li key={o.order_id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">ORDER-{o.order_id.slice(0, 8).toUpperCase()}{o.customer_name ? ` · ${o.customer_name}` : ''}</p>
                      <p className="text-xs text-slate-500">{new Date(o.created_at).toLocaleString()}{o.printful_order_id ? ` · Printful #${o.printful_order_id}` : ''}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.tone}`}>{s.label}</span>
                  </div>
                  {o.error && <p className="text-xs text-red-700">{o.error}</p>}
                  {o.shipments?.length > 0 && (
                    <p className="text-xs text-slate-600">
                      Tracking: {o.shipments.map((sh) => sh.tracking_url
                        ? <a key={sh.id} href={sh.tracking_url} target="_blank" rel="noreferrer" className="underline mr-2">{sh.carrier ? `${sh.carrier} ` : ''}{sh.tracking_number}</a>
                        : <span key={sh.id} className="mr-2">{sh.tracking_number}</span>)}
                    </p>
                  )}
                  <div className="flex gap-2">
                    {o.status === 'failed' && (
                      <button onClick={() => orderAction(o.order_id, 'retry')} disabled={busy !== null} className="px-3 py-1 text-xs font-semibold bg-slate-900 text-white rounded-lg disabled:opacity-50">
                        {busy === `retry:${o.order_id}` ? 'Sending…' : 'Retry'}
                      </button>
                    )}
                    {o.status === 'draft' && (
                      <button
                        onClick={() => { if (confirm('Confirm this order in Printful? Printful will charge your card and start production.')) orderAction(o.order_id, 'confirm'); }}
                        disabled={busy !== null}
                        className="px-3 py-1 text-xs font-semibold bg-slate-900 text-white rounded-lg disabled:opacity-50"
                      >
                        {busy === `confirm:${o.order_id}` ? 'Confirming…' : 'Confirm in Printful'}
                      </button>
                    )}
                    {o.printful_order_id && (
                      <button onClick={() => orderAction(o.order_id, 'sync')} disabled={busy !== null} className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50">
                        <RefreshCw className={`w-3 h-3 ${busy === `sync:${o.order_id}` ? 'animate-spin' : ''}`} /> Refresh
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
