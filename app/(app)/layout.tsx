import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { AuthProvider } from "@/lib/auth/context";
import { createClient } from "@/lib/db/supabase-server";
import { createAdminClient } from "@/lib/db/supabase-admin";
import PlatformJsonLd from "@/app/components/PlatformJsonLd";
import ImpersonationBanner from "./ImpersonationBanner";
import AdminManageSiteBanner from "./AdminManageSiteBanner";
import PaymentFailedBanner from "./PaymentFailedBanner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Keystone Web | AI Website Builder for Canadian Small Businesses",
  description: "Create a professional website in minutes with Keystone Web's smart AI builder. Designed for Canadian trades and small businesses starting at $15/mo.",
  keywords: ["AI website builder", "small business website Canada", "trades website builder", "simple website builder", "Keystone Web Design"],
  openGraph: {
    title: "Keystone Web | AI Website Builder",
    description: "Launch your professional website today with AI assistance.",
    url: "https://kswd.ca",
    siteName: "Keystone Web",
    locale: "en_CA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Keystone Web | AI Website Builder",
    description: "Your professional website, built in minutes.",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isImpersonated = user && (user as any).is_impersonated;

  // Failed-payment banner data. Show a persistent warning when the user's
  // subscription payment has failed (past_due → grace window) or has lapsed to
  // Free because we couldn't recover payment. Skipped while impersonating so it
  // doesn't collide with the impersonation banner.
  let paymentBanner: { variant: 'past_due' | 'lapsed'; graceEndsAt: string | null } | null = null;
  if (user && !isImpersonated) {
    try {
      const { data: sub } = await supabase
        .from('user_subscriptions')
        .select('subscription_status, grace_period_ends_at, cancellation_reason')
        .eq('user_id', user.id)
        .maybeSingle();
      if (sub?.subscription_status === 'past_due') {
        paymentBanner = {
          variant: 'past_due',
          graceEndsAt: sub.grace_period_ends_at
            ? new Date(sub.grace_period_ends_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
            : null,
        };
      } else if (sub?.subscription_status === 'canceled' && sub.cancellation_reason === 'payment_failed') {
        paymentBanner = { variant: 'lapsed', graceEndsAt: null };
      }
    } catch (err) {
      console.error('[layout] payment-banner lookup failed:', err);
    }
  }

  // Manage-site banner data — middleware set this header when an admin is
  // actively managing a non-owned site. Resolve site title + owner email here
  // (server-side) so the banner can render statically.
  const headerList = await headers();
  const managedSiteId = headerList.get('x-admin-managed-site-id');
  let manageInfo: { siteId: string; siteSlug: string | null; ownerEmail: string | null } | null = null;
  if (managedSiteId && !isImpersonated) {
    try {
      const db = createAdminClient();
      const { data: site } = await db
        .from('sites')
        .select('id, site_slug, user_id')
        .eq('id', managedSiteId)
        .single();
      if (site) {
        const { data: owner } = await db
          .from('users')
          .select('email')
          .eq('id', site.user_id)
          .single();
        manageInfo = {
          siteId: site.id,
          siteSlug: site.site_slug ?? null,
          ownerEmail: owner?.email ?? null,
        };
      }
    } catch (err) {
      console.error('[layout] manage-site lookup failed:', err);
    }
  }

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider initialUser={user}>
          <PlatformJsonLd />
          {isImpersonated && <ImpersonationBanner userEmail={user.email || 'User'} />}
          {!isImpersonated && manageInfo && (
            <AdminManageSiteBanner
              siteId={manageInfo.siteId}
              siteSlug={manageInfo.siteSlug}
              ownerEmail={manageInfo.ownerEmail}
            />
          )}
          {paymentBanner && (
            <PaymentFailedBanner
              variant={paymentBanner.variant}
              graceEndsAt={paymentBanner.graceEndsAt}
            />
          )}

          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
