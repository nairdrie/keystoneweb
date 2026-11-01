import type { Metadata } from 'next';
import '@/app/(app)/globals.css';

/**
 * Root layout for Keystone-hosted flows (cart, booking, product pages) on
 * agent-built (v2) sites. The page supplies the site's own header/footer and
 * design tokens; the flow UI is Keystone's existing components.
 */
export const metadata: Metadata = {
  title: 'Keystone',
};

export default function V2FlowLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="ks-mode-published">
      <body className="antialiased">{children}</body>
    </html>
  );
}
