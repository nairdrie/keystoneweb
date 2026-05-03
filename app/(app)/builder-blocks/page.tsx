import type { Metadata } from 'next';
import BuilderBlocksDocsPage from './BuilderBlocksDocsPage';

export const metadata: Metadata = {
  title: 'Keystone Web Builder Blocks',
  description: 'User-facing documentation for blocks available in the Keystone Web Builder.',
};

export default function Page() {
  return <BuilderBlocksDocsPage />;
}
