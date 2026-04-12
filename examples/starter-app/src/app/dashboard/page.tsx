"use client";

import { useEffect, useState } from "react";

type MerchantResponse = {
  ok: boolean;
  fetchedAt?: string;
  store?: {
    name?: string | null;
    host?: string | null;
  };
  merchant?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  auth?: {
    hasToken?: boolean;
    tokenRecordFound?: boolean;
  };
  debug?: {
    rawKeys?: string[];
    hasMerchantObject?: boolean;
    hasStoreName?: boolean;
  };
  error?: string;
};

type ProductsResponse = {
  ok: boolean;
  fetchedAt?: string;
  count?: number;
  items?: Array<{
    id: string;
    name: string;
    createdAt?: string | null;
  }>;
  error?: string;
};

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 16,
        background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        gap: 12,
        padding: "8px 0",
        borderBottom: "1px solid #f3f4f6",
      }}
    >
      <div style={{ fontWeight: 600 }}>{label}</div>
      <div style={{ wordBreak: "break-word" }}>{value ?? "-"}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [merchant, setMerchant] = useState<MerchantResponse | null>(null);
  const [products, setProducts] = useState<ProductsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const [merchantRes, productsRes] = await Promise.all([
          fetch("/api/ikas/get-merchant", { cache: "no-store" }),
          fetch("/api/ikas/get-products-preview", { cache: "no-store" }),
        ]);

        const merchantJson = (await merchantRes.json()) as MerchantResponse;
        const productsJson = (await productsRes.json()) as ProductsResponse;

        setMerchant(merchantJson);
        setProducts(productsJson);
      } catch (error) {
        setMerchant({
          ok: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        setProducts({
          ok: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: 24,
        background: "#f9fafb",
        minHeight: "100vh",
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>
          ikas Merchant Dashboard
        </h1>
        <p style={{ color: "#4b5563" }}>
          Merchant bilgisi, auth durumu ve ilk ürün preview testi
        </p>
      </div>

      {loading ? (
        <div>Yükleniyor...</div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 16,
          }}
        >
          <Card title="Bağlantı Durumu">
            <Row label="Merchant API" value={merchant?.ok ? "OK" : "Hata"} />
            <Row label="Products Preview API" value={products?.ok ? "OK" : "Hata"} />
          </Card>

          <Card title="Store Bilgisi">
            <Row label="Store Name" value={merchant?.store?.name || "-"} />
            <Row label="Host" value={merchant?.store?.host || "-"} />
            <Row label="Fetched At" value={merchant?.fetchedAt || "-"} />
          </Card>

          <Card title="Merchant Bilgisi">
            <Row label="Merchant ID" value={merchant?.merchant?.id || "-"} />
            <Row label="Merchant Name" value={merchant?.merchant?.name || "-"} />
            <Row label="Email" value={merchant?.merchant?.email || "-"} />
            <Row label="Phone" value={merchant?.merchant?.phone || "-"} />
          </Card>

          <Card title="Auth / Health">
            <Row label="Has Token" value={String(merchant?.auth?.hasToken ?? false)} />
            <Row
              label="Token Record Found"
              value={String(merchant?.auth?.tokenRecordFound ?? false)}
            />
            <Row
              label="Has Merchant Object"
              value={String(merchant?.debug?.hasMerchantObject ?? false)}
            />
            <Row
              label="Has Store Name"
              value={String(merchant?.debug?.hasStoreName ?? false)}
            />
            <Row
              label="Raw Keys"
              value={
                merchant?.debug?.rawKeys?.length
                  ? merchant.debug.rawKeys.join(", ")
                  : "-"
              }
            />
          </Card>

          <Card title="Products Preview">
            <Row label="Fetch Status" value={products?.ok ? "OK" : "Hata"} />
            <Row label="Count" value={products?.count ?? 0} />
            <div style={{ marginTop: 12 }}>
              {products?.items?.length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {products.items.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 12,
                        background: "#fafafa",
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{item.name}</div>
                      <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                        ID: {item.id}
                      </div>
                      <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                        Created At: {item.createdAt || "-"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div>Henüz ürün verisi gelmedi.</div>
              )}
            </div>
          </Card>

          <Card title="Hata Mesajları">
            <Row label="Merchant Error" value={merchant?.error || "-"} />
            <Row label="Products Error" value={products?.error || "-"} />
          </Card>
        </div>
      )}
    </main>
  );
}
