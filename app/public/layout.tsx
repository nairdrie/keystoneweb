import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import '@/app/(app)/globals.css';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

export const metadata: Metadata = {
    title: 'Powered by Keystone Web',
    description: 'A custom website built with Keystone Web.',
};

export default function PublicSiteLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    // The lang attribute is set to "en" by default.
    // For translated pages, the template components read __currentLanguage
    // from designData and can update the lang attribute client-side.
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
                {children}
            </body>
        </html>
    );
}
