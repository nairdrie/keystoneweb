import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth/context";
import { createClient } from "@/lib/db/supabase-server";
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
  title: "Keystone Web Design",
  description: "Create a beautiful, professional website with Keystone Web's smart builder.",
};

export const viewport = {
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
          <ImpersonationIndicator />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

async function ImpersonationIndicator() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user && (user as any).is_impersonated) {
    return <ImpersonationBanner userEmail={user.email || 'User'} />;
  }

  return null;
}
