'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/apparel-panel/AppShell';
import {
  getCaseDetail,
  getCaseEvidence,
  type PanelEvidenceStatus,
  type PanelEvidenceType,
} from '@/lib/apparel-panel/panel-relations';

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 18,
        background: '#ffffff',
        padding: 18,
      }}
    >
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>{value}</div>
      {helper ? (
        <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
          {helper}
        </div>
      ) : null}
    </div>
  );
}

function typeLabel(type: PanelEvidenceType) {
  if (type === 'image') return 'Görsel';
  if (type === 'video') return 'Video';
  if (type === 'audio') return 'Ses';
  return 'Belge';
}

function typeStyles(type: PanelEvidenceType) {
  if (type === 'image') {
    return { background: '#eff6ff', color: '#1d4ed8' };
  }
  if (type === 'video') {
    return { background: '#fef3c7', color: '#92400e' };
  }
  if (type === 'audio') {
    return { background: '#ede9fe', color: '#6d28d9' };
  }
  return { background: '#f3f4f6', color: '#374151' };
}

function statusStyles(status: PanelEvidenceStatus) {
  if (status === 'Doğrulandı') {
    return { background: '#ecfdf5', color: '#065f46' };
  }
  if (status === 'Arşiv') {
    return { background: '#f3f4f6', color: '#374151' };
  }
  if (status === 'Ek bilgi bekleniyor') {
    return { background: '#fffbeb', color: '#92400e' };
  }
  return { background: '#fef2f2', color: '#991b1b' };
}

export default function OperationDetailPage() {
  const params = useParams<{ caseId: string }>();
  const rawCaseId = Array.isArray(params?.caseId) ? params.caseId[0] : params?.caseId;
  const caseId = rawCaseId || 'OP-301';

  const detail = getCaseDetail(caseId);
  const evidenceItems = getCaseEvidence(caseId);

  const evidenceCount = evidenceItems.length;
  const customerUploadCount = evidenceItems.filter((item) =>
    item.source.toLocaleLowerCase('tr-TR').includes('müşteri'),
  ).length;
  const pendingCount = evidenceItems.filter(
    (item) => item.status === 'İnceleme bekliyor' || item.status === 'Ek bilgi bekleniyor',
  ).length;
  const documentCount = evidenceItems.filter((item) => item.type === 'document').length;

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
        <div style={{ marginBottom: 20 }}>
          <Link
            href="/operations"
            style={{
              display: 'inline-block',
              textDecoration: 'none',
              borderRadius: 10,
              padding: '8px 12px',
              background: '#ffffff',
              color: '#111827',
              border: '1px solid #e5e7eb',
              fontWeight: 700,
              marginBottom: 14,
            }}
          >
            ← Operasyonlara dön
          </Link>

          <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>
            Operasyon Detayı
          </h1>
          <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
            Bu ekran vaka, sipariş ve müşteri kanıtlarını tek merkezde toplar. Ayrıntılı
            medya / dekont / belge inceleme yüzeyi burada konumlanır.
          </p>
        </div>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.3fr) minmax(320px, 0.95fr)',
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 18,
              background: '#ffffff',
              padding: 18,
            }}
          >
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>Vaka No</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#111827', marginBottom: 8 }}>
              {detail.id}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
              {detail.title}
            </div>
            <div style={{ color: '#4b5563', lineHeight: 1.7 }}>{detail.summary}</div>
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 18,
              background: '#ffffff',
              padding: 18,
            }}
          >
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
              Kanıt merkezi özeti
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 10 }}>
              {detail.evidenceCenterLabel}
            </div>
            <div style={{ color: '#4b5563', lineHeight: 1.7, marginBottom: 12 }}>
              {detail.reviewSummary}
            </div>
            <div
              style={{
                borderTop: '1px solid #f3f4f6',
                paddingTop: 12,
                color: '#374151',
                lineHeight: 1.7,
                fontSize: 13,
              }}
            >
              <strong>Sonraki adım:</strong> {detail.nextAction}
            </div>
          </div>
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <MetricCard label="Vaka Tipi" value={detail.type} />
          <MetricCard label="Müşteri" value={detail.customer} />
          <MetricCard label="Öncelik" value={detail.priority} />
          <MetricCard label="Kanal" value={detail.channel} />
          <MetricCard
            label="Kanıt Sayısı"
            value={evidenceCount}
            helper="Bu vakaya bağlı medya / belge kaydı"
          />
          <MetricCard
            label="İnceleme Bekleyen"
            value={pendingCount}
            helper="Önce bakılması gereken kanıt adedi"
          />
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <MetricCard
            label="Bağlı Sipariş"
            value={detail.orderId}
            helper="Sipariş detail ile birlikte değerlendirme yapılabilir."
          />
          <MetricCard
            label="Sorumlu"
            value={detail.assignee}
            helper="Bu vakayı kim takip ediyor bilgisi"
          />
          <MetricCard
            label="Müşteri Yüklemesi"
            value={customerUploadCount}
            helper="Doğrudan müşteriden gelen kanıt adedi"
          />
          <MetricCard
            label="Belge Sayısı"
            value={documentCount}
            helper="PDF, dekont veya form niteliğindeki kayıtlar"
          />
        </section>

        <section
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 18,
            background: '#ffffff',
            padding: 18,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
            Kanıt Merkezi
          </div>

          <div style={{ color: '#4b5563', lineHeight: 1.7, marginBottom: 14 }}>
            Bu alan hasarlı ürün görselleri, dekont, video, ekran görüntüsü ve diğer müşteri
            kanıtlarının incelendiği ana detay yüzeyidir.
          </div>

          {evidenceItems.length === 0 ? (
            <div
              style={{
                border: '1px dashed #d1d5db',
                borderRadius: 14,
                padding: 16,
                background: '#fafafa',
                color: '#6b7280',
              }}
            >
              Bu vaka için bağlı kanıt kaydı görünmüyor.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 12,
              }}
            >
              {evidenceItems.map((item) => {
                const typeStyle = typeStyles(item.type);
                const reviewStyle = statusStyles(item.status);

                return (
                  <div
                    key={item.id}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 16,
                      background: '#ffffff',
                      padding: 16,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                        marginBottom: 10,
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          borderRadius: 999,
                          padding: '5px 10px',
                          fontSize: 12,
                          fontWeight: 700,
                          ...typeStyle,
                        }}
                      >
                        {typeLabel(item.type)}
                      </span>

                      <span
                        style={{
                          display: 'inline-flex',
                          borderRadius: 999,
                          padding: '5px 10px',
                          fontSize: 12,
                          fontWeight: 700,
                          ...reviewStyle,
                        }}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: '#111827',
                        marginBottom: 8,
                        lineHeight: 1.4,
                      }}
                    >
                      {item.title}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gap: 6,
                        color: '#4b5563',
                        fontSize: 13,
                        lineHeight: 1.6,
                        marginBottom: 10,
                      }}
                    >
                      <div>
                        <strong>Kaynak:</strong> {item.source}
                      </div>
                      <div>
                        <strong>İlişki:</strong> {item.relation}
                      </div>
                      <div>
                        <strong>Yüklenme:</strong> {item.uploadedAt}
                      </div>
                    </div>

                    <div
                      style={{
                        borderTop: '1px solid #f3f4f6',
                        paddingTop: 10,
                        color: '#374151',
                        fontSize: 13,
                        lineHeight: 1.7,
                      }}
                    >
                      {item.note}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              border: '1px solid #fde68a',
              borderRadius: 16,
              background: '#fffbeb',
              padding: 16,
            }}
          >
            <div style={{ fontWeight: 800, color: '#92400e', marginBottom: 8 }}>
              1. Kanıtı önce sınıflandır
            </div>
            <div style={{ color: '#4b5563', lineHeight: 1.7 }}>
              Görsel, video, belge veya ses kaydının gerçekten vakayı destekleyip desteklemediği ilk adımda netleşmeli.
            </div>
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 16,
              background: '#ffffff',
              padding: 16,
            }}
          >
            <div style={{ fontWeight: 800, color: '#111827', marginBottom: 8 }}>
              2. Sipariş ve konuşmayla eşleştir
            </div>
            <div style={{ color: '#4b5563', lineHeight: 1.7 }}>
              Kanıt, müşteri konuşması ve doğru sipariş kaydı ile birlikte değerlendirildiğinde çözüm daha güvenli ilerler.
            </div>
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 16,
              background: '#ffffff',
              padding: 16,
            }}
          >
            <div style={{ fontWeight: 800, color: '#111827', marginBottom: 8 }}>
              3. Sonra operatör kararını ver
            </div>
            <div style={{ color: '#4b5563', lineHeight: 1.7 }}>
              İnceleme tamamlanınca müşteriye cevap, finans onayı, değişim veya kapanış kararı daha net verilir.
            </div>
          </div>
        </section>

        <section
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 18,
            background: '#ffffff',
            padding: 18,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
            Hızlı Geçişler
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link
              href={detail.linkedOrderId ? `/orders/${detail.linkedOrderId}` : '/orders'}
              style={{
                textDecoration: 'none',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: '10px 14px',
                background: '#ffffff',
                color: '#111827',
                fontWeight: 700,
              }}
            >
              Siparişe Git
            </Link>

            <Link
              href="/inbox"
              style={{
                textDecoration: 'none',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: '10px 14px',
                background: '#ffffff',
                color: '#111827',
                fontWeight: 700,
              }}
            >
              Mesajlara Git
            </Link>
          </div>

          <div
            style={{
              marginTop: 12,
              color: '#6b7280',
              lineHeight: 1.7,
              fontSize: 13,
            }}
          >
            Bu ekran artık kanıt inceleme için ana merkezdir; konuşma ve sipariş ekranları bunu yalnız özetler.
          </div>
        </section>
      </main>
    </AppShell>
  );
}
