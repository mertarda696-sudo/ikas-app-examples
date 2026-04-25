export function mapCaseTypeLabel(type: string | null | undefined) {
  const normalized = String(type || 'general').toLowerCase();

  if (normalized === 'damaged_product') return 'Hasarlı Ürün';
  if (normalized === 'shipping_delivery') return 'Kargo / Teslimat';
  if (normalized === 'payment_proof') return 'Ödeme / Dekont';
  if (normalized === 'return_exchange') return 'İade / Değişim';
  if (normalized === 'size_consultation') return 'Beden Danışma';
  if (normalized === 'order_support') return 'Sipariş Destek';
  if (normalized === 'hot_lead') return 'Sıcak Lead';
  if (normalized === 'general_followup') return 'Genel Takip';
  if (normalized === 'general') return 'Genel';

  return type || 'Genel';
}

export function mapPriorityLabel(priority: string | null | undefined) {
  const normalized = String(priority || 'normal').toLowerCase();

  if (normalized === 'critical') return 'Kritik';
  if (normalized === 'high') return 'Yüksek';
  if (normalized === 'low') return 'Düşük';
  if (normalized === 'normal') return 'Normal';

  return priority || 'Normal';
}

export function mapStatusLabel(status: string | null | undefined) {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'open') return 'Açık';
  if (normalized === 'in_progress') return 'İnceleniyor';
  if (normalized === 'waiting_customer') return 'Müşteri Bekleniyor';
  if (normalized === 'resolved') return 'Çözüldü';
  if (normalized === 'closed') return 'Kapalı';

  return status || '-';
}

export function mapEvidenceStateLabel(state: string | null | undefined) {
  const normalized = String(state || '').toLowerCase();

  if (normalized === 'requested') return 'Kanıt istendi';
  if (normalized === 'received') return 'Kanıt alındı';
  if (normalized === 'verified') return 'Doğrulandı';
  if (normalized === 'missing') return 'Eksik';
  if (normalized === 'rejected') return 'Reddedildi';

  return state || 'Kanıt durumu yok';
}

export function mapStockStatusLabel(status: string | null | undefined) {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'in_stock') return 'Stokta';
  if (normalized === 'out_of_stock') return 'Stokta Yok';
  if (normalized === 'low_stock') return 'Az Stok';
  if (normalized === 'preorder') return 'Ön Sipariş';
  if (normalized === 'discontinued') return 'Satış Dışı';

  return status || 'Stok bilgisi yok';
}

export function mapCrmTagLabel(tag: string | null | undefined) {
  const normalized = String(tag || 'general').toLowerCase();

  if (normalized === 'vip_customer') return 'VIP Müşteri';
  if (normalized === 'risky_customer') return 'Riskli Müşteri';
  if (normalized === 'high_return_tendency') return 'İade Eğilimi Yüksek';
  if (normalized === 'needs_followup') return 'Tekrar Takip Edilecek';
  if (normalized === 'delivery_issue') return 'Problemli Teslimat';
  if (normalized === 'hot_lead') return 'Potansiyel Sıcak Lead';

  return 'Genel Müşteri';
}

export function mapRiskLevelLabel(level: string | null | undefined) {
  const normalized = String(level || 'normal').toLowerCase();

  if (normalized === 'critical') return 'Kritik';
  if (normalized === 'high') return 'Yüksek';
  if (normalized === 'low') return 'Düşük';

  return 'Normal';
}

export function mapFollowupStatusLabel(status: string | null | undefined) {
  const normalized = String(status || 'none').toLowerCase();

  if (normalized === 'follow_up') return 'Takip Edilecek';
  if (normalized === 'waiting_customer') return 'Müşteri Bekleniyor';
  if (normalized === 'operator_action_required') return 'Operatör Aksiyonu Gerekli';

  return 'Takip Gerekmiyor';
}
