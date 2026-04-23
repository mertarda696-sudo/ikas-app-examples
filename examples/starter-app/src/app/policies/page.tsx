'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/apparel-panel/AppShell';
import { TokenHelpers } from '@/helpers/token-helpers';

export default function PoliciesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      const token = await TokenHelpers.getTokenForIframeApp();

      const res = await fetch('/api/apparel/policies', {
        headers: { Authorization: 'JWT ' + token },
      });

      const json = await res.json();
      setData(json);
      setLoading(false);
    };

    run();
  }, []);

  return (
    <AppShell>
      <main style={{ padding: 24 }}>
        <h1>Politikalar</h1>

        {loading ? (
          <div>Yükleniyor...</div>
        ) : (
          <div>
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </div>
        )}
      </main>
    </AppShell>
  );
}
