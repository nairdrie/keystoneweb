import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';

export const metadata = { title: 'Keystone Ops' };

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  // Verify authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('https://keystoneweb.ca');
  }

  // Verify admin (double-check beyond middleware)
  const adminEmails = (process.env.OPS_ADMIN_EMAILS || '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

  if (!adminEmails.includes(user.email?.toLowerCase() ?? '')) {
    redirect('https://keystoneweb.ca');
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Top nav */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-8">
              <span className="text-sm font-semibold tracking-widest text-emerald-400 uppercase">
                Keystone Ops
              </span>
              <nav className="flex items-center gap-6 text-sm text-gray-400">
                <Link href="/ops" className="hover:text-white transition-colors">
                  Overview
                </Link>
                <Link href="/ops/users" className="hover:text-white transition-colors">
                  Users
                </Link>
                <Link href="/ops/support" className="hover:text-white transition-colors">
                  Support
                </Link>
              </nav>
            </div>
            <span className="text-xs text-gray-500">{user.email}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
