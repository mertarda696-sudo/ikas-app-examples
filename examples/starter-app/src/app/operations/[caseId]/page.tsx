'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/apparel-panel/AppShell';

type EvidenceType = 'image' | 'video' | 'audio' | 'document';
type EvidenceStatus = 'İnceleme bekliyor' | 'Doğrulandı' | 'Arşiv' | 'Ek bilgi bekleniyor';

type EvidenceItem = {
  id: string;
  type: EvidenceType;
  title: string;
  source: string;
  relation: string;
  uploadedAt: string;
  status: EvidenceStatus;
  note: string;
};

const CASE_DETAIL_MAP: Record<
  string,
  {
    title: string;
    type: string;
    customer: string;
    orderId: string;
    priority: string;
    status: string;
    assignee: string;
    updatedAt: string;
    summary: string;
    nextAction: string;
    channel: string;
    linkedOrderId: string | null;
    evidenceCenterLabel: string;
    reviewSummary: string;
  }
> = {
  'OP-301': {
    title: 'Kargo sonrası hasarlı ürün bildirimi',
    type: 'Hasarlı Ürün',
    customer: '905457464945',
    orderId: 'SIP-10428',
    priority: 'Yüksek',
    status: 'İnceleniyor',
    assignee: 'Operatör 1',
    updatedAt: '15.04.2026 23:18',
    summary:
      'Bu kayıt hasarlı ürün vakalarının konuşma, sipariş ve müşteri kanıtları ile birlikte yönetileceği operasyon detail ekranını temsil eder.',
    nextAction: 'Müşteriden gelen görselleri ve videoyu kontrol edip siparişle eşleştir',
    channel: 'WhatsApp',
    linkedOrderId: 'SIP-10428',
    evidenceCenterLabel: 'Hasar kanıt paketi',
    reviewSummary: 'Görsel ve video kanıtı operatör incelemesinde.',
  },
  'OP-302': {
    title: 'Teslimat gecikmesi şikayeti',
    type: 'Kargo Şikayeti',
    customer: '905457464945',
    orderId: 'SIP-10412',
    priority: 'Normal',
    status: 'Müşteri bekleniyor',
    assignee: 'Operatör 2',
    updatedAt: '15.04.2026 19:42',
    summary:
      'Bu kayıt kargo şikayetlerinde müşteri mesajı, sipariş durumu ve varsa destekleyici ekran görüntüsü ile birlikte ilerler.',
    nextAction: 'Kargo durumunu doğrulayıp müşteriden gerekirse ek ekran görüntüsü talep et',
    channel: 'WhatsApp',
    linkedOrderId: 'SIP-10412',
    evidenceCenterLabel: 'Teslimat destek materyali',
    reviewSummary: 'Şu an ana ihtiyaç kargo yanıtı; güçlü medya paketi görünmüyor.',
  },
  'OP-303': {
    title: 'Dekont doğrulama bekliyor',
    type: 'Ödeme / Dekont',
    customer: '9055•••',
    orderId: 'SIP-10387',
    priority: 'Kritik',
    status: 'Yeni',
    assignee: 'Finans Kuyruğu',
    updatedAt: '15.04.2026 14:09',
    summary:
      'Bu kayıt ödeme/dekont vakalarının finans kontrolü, müşteri konuşması ve belge kanıtıyla yönetileceği merkezi temsil eder.',
    nextAction: 'Dekont PDF ve ödeme ekran görüntüsünü doğrulayıp finans onayı ile ilerle',
    channel: 'WhatsApp',
    linkedOrderId: 'SIP-10387',
    evidenceCenterLabel: 'Finans kanıt paketi',
    reviewSummary: 'Belge ve ekran görüntüsü finans doğrulaması bekliyor.',
  },
  'OP-304': {
    title: 'Beden değişim talebi',
    type: 'İade / Değişim',
    customer: '9055•••',
    orderId: 'SIP-10374',
    priority: 'Normal',
    status: 'Çözüldü',
    assignee: 'Operatör 1',
    updatedAt: '14.04.2026 16:27',
    summary:
      'Bu kayıt değişim süreçlerinde müşteri notu, değişim formu ve kapanış sonrası arşiv mantığını gösterir.',
    nextAction: 'Değişim sonrası notları arşivleyip konuşma ve sipariş kapanışını doğrula',
    channel: 'WhatsApp',
    linkedOrderId: 'SIP-10374',
    evidenceCenterLabel: 'Değişim evrakı',
    reviewSummary: 'Vaka çözülmüş, içerikler arşiv niteliğinde tutuluyor.',
  },
};

const EVIDENCE_LIBRARY: Record<string, EvidenceItem[]> = {
  'OP-301': [
    {
      id: 'EV-301-A',
      type: 'image',
      title: 'Hasarlı ürün ön yüz fotoğrafı',
      source: 'Müşteri yüklemesi',
      relation: 'Sipariş teslimatı sonrası',
      uploadedAt: '15.04.2026 23:12',
      status: 'İnceleme bekliyor',
      note: 'Ön bölümde yırtık benzeri hasar görünüyor.',
    },
    {
      id: 'EV-301-B',
      type: 'image',
      title: 'Paket içi yakın plan fotoğraf',
      source: 'Müşteri yüklemesi',
      relation: 'Kutu açılış anı',
      uploadedAt: '15.04.2026 23:13',
      status: 'İnceleme bekliyor',
      note: 'Ürün kat izleri ve deformasyon kontrol edilmeli.',
    },
    {
      id: 'EV-301-C',
      type: 'video',
      title: 'Kutudan çıkarma videosu',
      source: 'Müşteri yüklemesi',
      relation: 'Hasar kanıtı',
      uploadedAt: '15.04.2026 23:14',
      status: 'Ek bilgi bekleniyor',
      note: 'Video süresi kısa; gerekirse ek açı istenebilir.',
    },
  ],
  'OP-302': [
    {
      id: 'EV-302-A',
      type: 'document',
      title: 'Kargo takip notu',
      source: 'Operatör kaydı',
      relation: 'Takip inceleme notu',
      uploadedAt: '15.04.2026 19:44',
      status: 'Arşiv',
      note: 'Bu vakada ana ihtiyaç teslimat akışını doğrulamak; güçlü medya bulunmuyor.',
    },
  ],
  'OP-303': [
    {
      id: 'EV-303-A',
      type: 'document',
      title: 'Dekont PDF',
      source: 'Müşteri yüklemesi',
      relation: 'Ödeme kanıtı',
      uploadedAt: '15.04.2026 14:02',
      status: 'İnceleme bekliyor',
      note: 'Belge üstündeki tutar sipariş toplamı ile karşılaştırılmalı.',
    },
    {
      id: 'EV-303-B',
      type: 'image',
      title: 'Mobil bankacılık ekran görüntüsü',
      source: 'Müşteri yüklemesi',
      relation: 'Transfer kanıtı',
      uploadedAt: '15.04.2026 14:03',
      status: 'İnceleme bekliyor',
      note: 'Saat ve alıcı bilgisi okunuyor; IBAN eşleşmesi kontrol edilmeli.',
    },
  ],
  'OP-304': [
    {
      id: 'EV-304-A',
      type: 'document',
      title: 'Değişim formu özeti',
      source: 'Operatör kaydı',
      relation: 'Kapanış evrakı',
      uploadedAt: '14.04.2026 16:10',
      status: 'Arşiv',
      note: 'Değişim işlemi tamamlanmış; yalnız kayıt amaçlı tutuluyor.',
    },
  ],
};

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

function typeLabel(type: EvidenceType) {
  if (type === 'image') return 'Görsel';
  if (type === 'video') return 'Video';
  if (type === 'audio') return 'Ses';
  return 'Belge';
}

function typeStyles(type: EvidenceType) {
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

function statusStyles(status: EvidenceStatus) {
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

  const detail = CASE_DETAIL_MAP[caseId] || {
    title: 'Placeholder operasyon kaydı',
    type: 'Genel Şikayet',
    customer: 'Bilinmiyor',
    orderId: '-',
    priority: 'Normal',
    status: 'Yeni',
    assignee: 'Atanmadı',
    updatedAt: '-',
    summary: 'Bu vaka için placeholder detail ekranı gösteriliyor.',
    nextAction: 'Aksiyon bilgisi yok',
    channel: 'Belirsiz',
    linkedOrderId: null,
    evidenceCenterLabel: 'Kanıt bulunmuyor',
    reviewSummary: 'İnceleme özeti yok.',
  };

  const evidenceItems = EVIDENCE_LIBRARY[caseId] || [];
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
              {caseId}
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
          <MetricCard label="Kanıt Sayısı" value={evidenceCount} helper="Bu vakaya bağlı medya / belge kaydı" />
          <MetricCard label="İnceleme Bekleyen" value={pendingCount} helper="Önce bakılması gereken kanıt adedi" />
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
