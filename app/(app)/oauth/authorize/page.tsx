/**
 * MCP sign-in: an AI app (e.g. Claude's "Add custom connector") sends the
 * user here. They sign in to Keystone (if needed) and approve access; the app
 * then receives tokens. No API keys to copy.
 */
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Bot, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { OAuthError, signConsentTicket, validateAuthorizeRequest } from '@/lib/v2/oauth';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Connect an AI app | Keystone', robots: { index: false } };

function Card({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">{children}</div>
    </main>
  );
}

export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) if (typeof v === 'string') params.set(k, v);

  let request;
  try {
    request = await validateAuthorizeRequest(createAdminClient(), params);
  } catch (e) {
    const message = e instanceof OAuthError ? e.message : 'This connection request is invalid.';
    return (
      <Card>
        <h1 className="mb-2 text-xl font-bold text-slate-900">Can&apos;t connect this app</h1>
        <p className="text-sm text-slate-600">{message}</p>
        <p className="mt-4 text-sm text-slate-500">Try adding the connector again from the app.</p>
      </Card>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const query = params.toString();
  if (!user) redirect(`/signin?returnTo=${encodeURIComponent(`/oauth/authorize?${query}`)}`);

  const ticket = await signConsentTicket(user.id, query);
  const appName = request.client.client_name || 'An AI app';
  const redirectHost = (() => { try { return new URL(request.redirectUri).host; } catch { return request.redirectUri; } })();

  return (
    <Card>
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white"><Bot className="h-5 w-5" /></span>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Connect {appName} to Keystone</h1>
          <p className="text-sm text-slate-500">Signed in as {user.email}</p>
        </div>
      </div>

      <p className="mb-3 text-sm font-medium text-slate-700">{appName} will be able to:</p>
      <ul className="mb-5 space-y-2 text-sm text-slate-600">
        <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />See your websites and their content</li>
        <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />Create sites and edit designs, pages, products and services as drafts</li>
        <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />It can&apos;t overwrite text you&apos;ve edited unless you ask it to</li>
      </ul>

      <form method="post" action="/api/oauth/authorize" className="space-y-5">
        <input type="hidden" name="ticket" value={ticket} />
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
          <input type="checkbox" name="allow_publish" value="1" defaultChecked={request.scopes.includes('sites:publish')} className="mt-0.5" />
          <span>
            <span className="font-medium">Also allow publishing</span>
            <span className="block text-slate-500">Let it make changes live on your published sites. Leave off to review drafts yourself first.</span>
          </span>
        </label>
        <div className="flex gap-3">
          <button name="decision" value="deny" className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          <button name="decision" value="allow" className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">Allow</button>
        </div>
        <p className="text-center text-xs text-slate-400">You&apos;ll be sent back to {redirectHost}. Disconnect any time in Account Settings.</p>
      </form>
    </Card>
  );
}
