"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type HomePageProps = {
  token: string | null;
  storeName: string;
};

export default function HomePage({ token, storeName }: HomePageProps) {
  const router = useRouter();

  useEffect(() => {
    if (token && storeName) {
      router.replace("/dashboard");
    }
  }, [router, token, storeName]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f9fafb",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          fontSize: 16,
          fontWeight: 600,
        }}
      >
        Dashboard ekranına yönlendiriliyor...
      </div>
    </main>
  );
}
