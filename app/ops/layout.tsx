import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import OpsHeader from './OpsHeader';
import '../(app)/globals.css';

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
    <html lang="en">
      <body className="antialiased">
        <div className="min-h-screen bg-gray-950 text-gray-100">
          <OpsHeader userEmail={user.email} />

          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
