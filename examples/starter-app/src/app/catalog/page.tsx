import { AppShell } from '@/components/apparel-panel/AppShell';

export default function CatalogPage() {
  return (
    <AppShell>
      <main
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: 24,
          minHeight: '100vh',
        }}
      >
        <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>
          Katalog
        </h1>
        <p style={{ color: '#4b5563', margin: 0 }}>
          Bu sayfa bir sonraki turda ürünler, varyantlar ve sync görünümü için ayrılacak.
        </p>
      </main>
    </AppShell>
  );
}
