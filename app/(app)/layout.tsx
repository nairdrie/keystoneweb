import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth/context";
import { createClient } from "@/lib/db/supabase-server";
import PlatformJsonLd from "@/app/components/PlatformJsonLd";
import ImpersonationBanner from "./ImpersonationBanner";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <PlatformJsonLd />
          <ImpersonationIndicator />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
}

async function ImpersonationIndicator() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isImpersonated = user && (user as any).is_impersonated;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --impersonation-height: ${isImpersonated ? '36px' : '0px'};
        }
        body {
          padding-top: var(--impersonation-height) !important;
        }
      `}} />
      {isImpersonated && <ImpersonationBanner userEmail={user.email || 'User'} />}
    </>
  );
}
