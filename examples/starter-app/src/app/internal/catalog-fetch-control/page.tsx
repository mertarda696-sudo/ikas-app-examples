import { notFound } from 'next/navigation';

import { CatalogFetchControlClient } from './CatalogFetchControlClient';

export default function CatalogFetchControlPage() {
  if (process.env.VERCEL_ENV !== 'preview') {
    notFound();
  }

  return <CatalogFetchControlClient />;
}
