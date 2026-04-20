export type PanelEvidenceType = 'image' | 'video' | 'audio' | 'document';
export type PanelEvidenceStatus =
  | 'İnceleme bekliyor'
  | 'Doğrulandı'
  | 'Arşiv'
  | 'Ek bilgi bekleniyor';

export type PanelEvidenceItem = {
  id: string;
  type: PanelEvidenceType;
  title: string;
  source: string;
  relation: string;
  uploadedAt: string;
  status: PanelEvidenceStatus;
  note: string;
};

export type PanelOrderDetail = {
  id: string;
  customer: string;
  orderStatus: string;
  paymentStatus: string;
  shipmentStatus: string;
  updatedAt: string;
  linkedConversation: string;
  linkedConversationHref: string;
  linkedCase: string;
  linkedCaseId: string | null;
  note: string;
  action: string;
  risk: string;
};

export type PanelCaseDetail = {
  id: string;
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
};

type ConversationLike = {
  status?: string | null;
  contextProductName?: string | null;
  messages: Array<{
    textBody?: string | null;
    direction?: 'in' | 'out' | null;
    hasMediaLikePayload?: boolean;
  }>;
};

const ORDER_DETAIL_MAP: Record<string, PanelOrderDetail> = {
  'SIP-10428': {
    id: 'SIP-10428',
    customer: '905457464945',
    orderStatus: 'Hazırlanıyor',
    paymentStatus: 'Ödeme alındı',
    shipmentStatus: 'Kargoya hazırlanıyor',
    updatedAt: '15.04.2026 23:10',
    linkedConversation: 'Aktif konuşma mevcut',
    linkedConversationHref: '/inbox',
    linkedCase: 'Açık vaka yok',
    linkedCaseId: null,
    note: 'Bu sipariş detail ekranı ödeme, kargo, konuşma ve operasyon kayıtlarını tek noktada toparlamak için kullanılır.',
    action: 'Kargoya hazırlık ve müşteri konuşma takibi',
    risk: 'Düşük',
  },
  'SIP-10412': {
    id: 'SIP-10412',
    customer: '905457464945',
    orderStatus: 'Teslim edildi',
    paymentStatus: 'Ödeme alındı',
    shipmentStatus: 'Teslim edildi',
    updatedAt: '14.04.2026 18:42',
    linkedConversation: 'Bağlı konuşma var',
    linkedConversationHref: '/inbox',
    linkedCase: 'Kargo şikayeti',
    linkedCaseId: 'OP-302',
    note: 'Teslim edilmiş siparişlerde müşteri memnuniyeti, kargo şikayeti ve son konuşmalar birlikte görülebilir.',
    action: 'Kargo şikayeti ve müşteri memnuniyet kontrolü',
    risk: 'Orta',
  },
  'SIP-10387': {
    id: 'SIP-10387',
    customer: '9055•••',
    orderStatus: 'İnceleniyor',
    paymentStatus: 'Dekont kontrolü',
    shipmentStatus: 'Beklemede',
    updatedAt: '13.04.2026 14:05',
    linkedConversation: 'Bağlı konuşma var',
    linkedConversationHref: '/inbox',
    linkedCase: 'Ödeme / Dekont',
    linkedCaseId: 'OP-303',
    note: 'Dekont kontrolü bekleyen siparişlerde finans doğrulama, operasyon kaydı ve müşteri konuşması aynı ekran altında bağlanır.',
    action: 'Finans doğrulama ve dekont incelemesi',
    risk: 'Yüksek',
  },
  'SIP-10374': {
    id: 'SIP-10374',
    customer: '9055•••',
    orderStatus: 'Değişim Sürecinde',
    paymentStatus: 'Ödeme alındı',
    shipmentStatus: 'Yeni gönderim hazırlanıyor',
    updatedAt: '14.04.2026 16:27',
    linkedConversation: 'Bağlı konuşma var',
    linkedConversationHref: '/inbox',
    linkedCase: 'İade / Değişim',
    linkedCaseId: 'OP-304',
    note: 'Değişim süreçlerinde konuşma, operasyon ve sipariş takibi birlikte yürür.',
    action: 'Değişim sürecini ve müşteri geri bildirimini birlikte takip et',
    risk: 'Orta',
  },
};

const CASE_DETAIL_MAP: Record<string, PanelCaseDetail> = {
  'OP-301': {
    id: 'OP-301',
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
    id: 'OP-302',
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
    id: 'OP-303',
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
    id: 'OP-304',
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

const EVIDENCE_LIBRARY: Record<string, PanelEvidenceItem[]> = {
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

const FALLBACK_ORDER: PanelOrderDetail = {
  id: 'UNKNOWN',
  customer: 'Bilinmiyor',
  orderStatus: 'Taslak',
  paymentStatus: 'Bilinmiyor',
  shipmentStatus: 'Bilinmiyor',
  updatedAt: '-',
  linkedConversation: 'Bağlı konuşma bilgisi yok',
  linkedConversationHref: '/inbox',
  linkedCase: 'Bağlı vaka bilgisi yok',
  linkedCaseId: null,
  note: 'Bu sipariş için placeholder detail ekranı gösteriliyor.',
  action: 'Aksiyon bilgisi yok',
  risk: 'Belirsiz',
};

const FALLBACK_CASE: PanelCaseDetail = {
  id: 'UNKNOWN',
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

export function normalizePanelText(value: string | null | undefined) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .trim();
}

export function inferLinkedOrderId(
  lastMessageText: string | null | undefined,
  contextProductName: string | null | undefined,
) {
  const text = normalizePanelText(lastMessageText);
  const product = normalizePanelText(contextProductName);

  if (text.includes('dekont') || text.includes('odeme')) return 'SIP-10387';
  if (text.includes('kargo')) return 'SIP-10412';
  if (text.includes('iade') || text.includes('degisim')) return 'SIP-10374';
  if (product) return 'SIP-10428';

  return null;
}

export function inferLinkedCaseId(lastMessageText: string | null | undefined) {
  const text = normalizePanelText(lastMessageText);

  if (text.includes('dekont') || text.includes('odeme')) return 'OP-303';
  if (text.includes('kargo')) return 'OP-302';
  if (text.includes('iade') || text.includes('degisim') || text.includes('beden'))
    return 'OP-304';
  if (text.includes('hasar') || text.includes('yirtik') || text.includes('kusur'))
    return 'OP-301';

  return null;
}

export function inferPriorityLabel(lastMessageText: string | null | undefined) {
  const text = normalizePanelText(lastMessageText);

  if (text.includes('dekont') || text.includes('odeme')) return 'Finans öncelikli';
  if (text.includes('kargo')) return 'Kargo takibi';
  if (text.includes('iade') || text.includes('degisim')) return 'Operasyon adayı';
  if (text.includes('hasar') || text.includes('kusur')) return 'Kanıt kontrolü';
  return 'Genel takip';
}

export function getConversationQueueHint(input: {
  lastMessageText: string | null | undefined;
  contextProductName: string | null | undefined;
  lastMessageDirection: 'in' | 'out' | null | undefined;
  status: string | null | undefined;
}) {
  const text = normalizePanelText(input.lastMessageText);
  const hasProductContext = Boolean(input.contextProductName);
  const customerWaiting =
    String(input.status || '').toLowerCase() === 'open' &&
    input.lastMessageDirection === 'in';

  if (text.includes('dekont') || text.includes('odeme')) {
    return {
      title: 'Önce ödeme akışını kontrol et',
      helper: 'Dekont veya ödeme sinyali var. Finans ve sipariş tarafı birlikte kontrol edilmeli.',
      tone: 'warning' as const,
      queueLabel: 'Finans akışı',
    };
  }

  if (text.includes('kargo')) {
    return {
      title: 'Sipariş ve kargo durumuna bak',
      helper: 'Teslimat / kargo ile ilgili konuşma görünüyor. Sipariş detail ekranı faydalı olur.',
      tone: 'info' as const,
      queueLabel: 'Kargo takibi',
    };
  }

  if (text.includes('iade') || text.includes('degisim') || text.includes('beden')) {
    return {
      title: 'Operasyon ve sipariş kaydını birlikte aç',
      helper: 'İade, değişim veya beden akışı olabilir. Operasyon tarafı kontrol edilmeli.',
      tone: 'warning' as const,
      queueLabel: 'Operasyon adayı',
    };
  }

  if (text.includes('hasar') || text.includes('kusur') || text.includes('yirtik')) {
    return {
      title: 'Kanıt ve operasyon sinyalini kontrol et',
      helper: 'Hasar/kusur dili geçtiği için vaka akışı üretmeye yakın olabilir.',
      tone: 'warning' as const,
      queueLabel: 'Kanıt kontrolü',
    };
  }

  if (customerWaiting && hasProductContext) {
    return {
      title: 'Ürün bağlamıyla müşteriye cevap ver',
      helper: 'Müşteri açık konuşmada bekliyor. Ürün bağlamı görünür olduğu için hızlı dönüş yapılabilir.',
      tone: 'success' as const,
      queueLabel: 'Müşteri bekliyor',
    };
  }

  if (customerWaiting) {
    return {
      title: 'Müşteriye geri dönüş yap',
      helper: 'Son mesaj müşteriden gelmiş görünüyor. Önce konuşma detail ekranı açılmalı.',
      tone: 'warning' as const,
      queueLabel: 'Açık konuşma',
    };
  }

  return {
    title: 'Genel takip',
    helper: 'Bu konuşma şu an kritik görünmüyor ama kayıt bağı için detail ekranı açılabilir.',
    tone: 'neutral' as const,
    queueLabel: 'Rutin takip',
  };
}

export function getConversationFlowContext(conversation: ConversationLike | null) {
  if (!conversation) {
    return {
      orderId: null as string | null,
      orderLabel: 'Henüz bağlanmadı',
      caseId: null as string | null,
      caseLabel: 'Henüz bağlanmadı',
      summary: 'Konuşma bağı henüz oluşturulmadı.',
    };
  }

  const allText = normalizePanelText(
    conversation.messages.map((message) => message.textBody || '').join(' '),
  );
  const product = normalizePanelText(conversation.contextProductName);

  if (allText.includes('dekont') || allText.includes('odeme')) {
    return {
      orderId: 'SIP-10387',
      orderLabel: 'Dekont / ödeme ile ilişkili sipariş',
      caseId: 'OP-303',
      caseLabel: 'Ödeme / Dekont vakası',
      summary: 'Bu konuşma finans ve dekont kontrolü gerektiren müşteri akışına benziyor.',
    };
  }

  if (allText.includes('kargo')) {
    return {
      orderId: 'SIP-10412',
      orderLabel: 'Kargo takibi olan sipariş',
      caseId: 'OP-302',
      caseLabel: 'Kargo şikayeti vakası',
      summary: 'Bu konuşma daha çok teslimat ve kargo akışıyla ilişkili görünüyor.',
    };
  }

  if (allText.includes('iade') || allText.includes('degisim') || allText.includes('beden')) {
    return {
      orderId: 'SIP-10374',
      orderLabel: 'İade / değişim ilişkili sipariş',
      caseId: 'OP-304',
      caseLabel: 'İade / Değişim vakası',
      summary: 'Bu konuşma değişim veya iade operasyonuna yakın görünüyor.',
    };
  }

  if (
    allText.includes('hasar') ||
    allText.includes('kusur') ||
    conversation.messages.some((message) => message.hasMediaLikePayload)
  ) {
    return {
      orderId: 'SIP-10428',
      orderLabel: 'Hasarlı ürün ilişkili sipariş',
      caseId: 'OP-301',
      caseLabel: 'Hasarlı Ürün vakası',
      summary: 'Bu konuşmada medya veya hasar sinyali olduğu için operasyon bağı önemli olabilir.',
    };
  }

  if (product) {
    return {
      orderId: 'SIP-10428',
      orderLabel: 'Ürün bağlamına yakın sipariş',
      caseId: null,
      caseLabel: 'Şu an açık vaka görünmüyor',
      summary: 'Konuşmada aktif ürün bağlamı var; sipariş ve ürün akışı birlikte düşünülmeli.',
    };
  }

  return {
    orderId: null,
    orderLabel: 'Henüz bağlanmadı',
    caseId: null,
    caseLabel: 'Henüz bağlanmadı',
    summary: 'Bu konuşma şu an genel yardım veya erken aşama müşteri akışı gibi görünüyor.',
  };
}

export function getConversationDeskState(
  conversation: ConversationLike | null,
  flowContext: ReturnType<typeof getConversationFlowContext>,
) {
  if (!conversation) {
    return {
      title: 'Konuşma bilgisi bekleniyor',
      helper: 'Henüz işlenebilir bir konuşma verisi görünmüyor.',
      tone: 'neutral' as const,
      attention: 'Belirsiz',
      recommendedStep: 'Önce konuşma kaydı doğrulanmalı.',
    };
  }

  const allText = normalizePanelText(
    conversation.messages.map((message) => message.textBody || '').join(' '),
  );
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  const customerWaiting =
    String(conversation.status || '').toLowerCase() === 'open' &&
    lastMessage?.direction === 'in';

  if (allText.includes('dekont') || allText.includes('odeme')) {
    return {
      title: 'Önce ödeme / dekont akışını kontrol et',
      helper:
        'Bu konuşmada finans ve sipariş tarafı birlikte düşünülmeli. Müşteriye cevap vermeden önce sipariş ve operasyon kaydına bakmak doğru olur.',
      tone: 'warning' as const,
      attention: customerWaiting ? 'Müşteri bekliyor' : 'Finans öncelikli',
      recommendedStep:
        'Önce sipariş ve operasyon kaydını aç, sonra müşteriye kontrollü dönüş yap.',
    };
  }

  if (allText.includes('kargo')) {
    return {
      title: 'Sipariş ve kargo durumunu doğrula',
      helper:
        'Teslimat veya kargo akışı baskın görünüyor. Yanıt öncesi sipariş ekranında durum kontrolü faydalı olur.',
      tone: 'info' as const,
      attention: customerWaiting ? 'Müşteri bekliyor' : 'Takip gerekli',
      recommendedStep:
        'Önce sipariş ekranına bak, sonra müşteriye güncel durumla cevap ver.',
    };
  }

  if (flowContext.caseId) {
    return {
      title: 'Operasyon kaydını da birlikte yönet',
      helper:
        'Bu konuşma vaka üretmiş veya üretmeye yakın görünüyor. Reply ile birlikte operasyon ekranı da önemli.',
      tone: 'warning' as const,
      attention: customerWaiting ? 'Vaka + müşteri bekliyor' : 'Operasyon odaklı',
      recommendedStep:
        'Operasyon kaydını aç, gerekiyorsa ardından sipariş ve reply akışına dön.',
    };
  }

  if (conversation.contextProductName && customerWaiting) {
    return {
      title: 'Ürün bağlamını kullanarak hızlı dönüş yap',
      helper:
        'Aktif ürün bağlamı görünür olduğu için konuşma daha hızlı ve kontrollü cevaplanabilir.',
      tone: 'success' as const,
      attention: 'Ürün sorusu / müşteri bekliyor',
      recommendedStep:
        'Önce konuşma içinde ürün bağlamını doğrula, sonra müşteriye yanıt yaz.',
    };
  }

  if (customerWaiting) {
    return {
      title: 'Müşteriye geri dönüş yap',
      helper:
        'Bu konuşmada son top müşteride. Operatör ekranından doğrudan yanıt üretmek öncelikli olabilir.',
      tone: 'warning' as const,
      attention: 'Açık konuşma',
      recommendedStep: 'Reply alanına odaklan ve gerekirse sonra sipariş/operasyon akışına geç.',
    };
  }

  return {
    title: 'Genel takip modunda kal',
    helper:
      'Bu konuşma şu an kritik görünmüyor. Bağlı kayıtları gözden geçirip genel takipte kalınabilir.',
    tone: 'neutral' as const,
    attention: 'Rutin takip',
    recommendedStep: 'Konuşmayı, siparişi ve operasyon kaydını ihtiyaç halinde aç.',
  };
}

export function getOrderDetail(orderId: string | null | undefined) {
  return ORDER_DETAIL_MAP[orderId || ''] || FALLBACK_ORDER;
}

export function getCaseDetail(caseId: string | null | undefined) {
  return CASE_DETAIL_MAP[caseId || ''] || FALLBACK_CASE;
}

export function getCaseEvidence(caseId: string | null | undefined) {
  return EVIDENCE_LIBRARY[caseId || ''] || [];
}
