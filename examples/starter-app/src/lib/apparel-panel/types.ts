export type TenantPanelContext = {
  tenantId: string;
  brandName: string | null;
  waPhoneNumberId: string | null;
  storeName: string | null;
  merchantId: string | null;
  sourcePlatform: string | null;
  channel: "whatsapp";
};

export type LatestSyncSummary = {
  status: string | null;
  finishedAt: string | null;
  errorCount: number;
};

export type DashboardSummaryResponse = {
  ok: boolean;
  fetchedAt: string;
  tenant: TenantPanelContext | null;
  ikasConnected: boolean;
  productCount: number;
  variantCount: number;
  policyCount: number;
  contactChannelCount: number;
  latestSync: LatestSyncSummary | null;
  error?: string;
};

export type CatalogHealthResponse = {
  ok: boolean;
  fetchedAt: string;
  tenant: TenantPanelContext | null;
  productCountTotal: number;
  productCountActive: number;
  variantCountTotal: number;
  variantCountInStock: number;
  variantCountPriced: number;
  latestSync: LatestSyncSummary | null;
  error?: string;
};

export type ProductListItem = {
  id: string;
  name: string;
  handle: string | null;
  category: string | null;
  subcategory: string | null;
  basePrice: number | null;
  currency: string | null;
  stockStatus: string | null;
  isActive: boolean;
  shortDescription: string | null;
  variantCount: number;
  attributes: Record<string, unknown> | null;
};

export type ProductsListResponse = {
  ok: boolean;
  fetchedAt: string;
  tenant: TenantPanelContext | null;
  items: ProductListItem[];
  error?: string;
};

export type VariantListItem = {
  id: string;
  productId: string;
  productName: string;
  sku: string | null;
  title: string | null;
  color: string | null;
  size: string | null;
  price: number | null;
  stockQty: number;
  stockStatus: string | null;
  isActive: boolean;
};

export type VariantsListResponse = {
  ok: boolean;
  fetchedAt: string;
  tenant: TenantPanelContext | null;
  items: VariantListItem[];
  error?: string;
};

export type PolicyMap = {
  shipping: string | null;
  delivery: string | null;
  return: string | null;
  exchange: string | null;
  support: string | null;
  contact: string | null;
};

export type ContactChannelItem = {
  id: string;
  channelKey: string | null;
  label: string | null;
  value: string | null;
  displayValue: string | null;
  contactUrl: string | null;
  availabilityText: string | null;
  isPrimary: boolean;
  isActive: boolean;
  priority: number;
};

export type PoliciesContactResponse = {
  ok: boolean;
  fetchedAt: string;
  tenant: TenantPanelContext | null;
  policies: PolicyMap;
  contactChannels: ContactChannelItem[];
  error?: string;
};

export type InboxConversationItem = {
  id: string;
  memberId: string | null;
  customerId: string | null;
  customerDisplay: string;
  channel: string | null;
  status: string | null;
  isOpen: boolean;
  lastMessageText: string | null;
  lastMessageDirection: 'in' | 'out' | null;
  lastMessageSenderType: 'customer' | 'ai' | 'operator' | 'system' | null;
  lastMessageAt: string | null;
  lastCustomerMessageAt: string | null;
  lastOperatorMessageAt: string | null;
  operatorReviewedAt: string | null;
  operatorReviewedBy: string | null;
  operatorReviewNote: string | null;
  operatorNote: string | null;
  operatorTag: string | null;
  operatorPriority: string | null;
  operatorNoteUpdatedAt: string | null;
  contextProductName: string | null;
};

export type InboxListResponse = {
  ok: boolean;
  fetchedAt: string;
  tenant: TenantPanelContext | null;
  items: InboxConversationItem[];
  error?: string;
};

export type ConversationMessageItem = {
  id: string;
  direction: 'in' | 'out' | null;
  senderType: 'customer' | 'ai' | 'operator' | 'system' | null;
  msgType: string | null;
  textBody: string | null;
  createdAt: string | null;
  hasMediaLikePayload: boolean;
};

export type ConversationDetailItem = {
  id: string;
  memberId: string | null;
  customerId: string | null;
  customerDisplay: string;
  channel: string | null;
  status: string | null;
  isOpen: boolean;
  lastMessageAt: string | null;
  lastCustomerMessageAt: string | null;
  lastOperatorMessageAt: string | null;
  operatorReviewedAt: string | null;
  operatorReviewedBy: string | null;
  operatorReviewNote: string | null;
  operatorNote: string | null;
  operatorTag: string | null;
  operatorPriority: string | null;
  operatorNoteUpdatedAt: string | null;
  contextProductName: string | null;
  messages: ConversationMessageItem[];
};

export type ConversationDetailResponse = {
  ok: boolean;
  fetchedAt: string;
  tenant: TenantPanelContext | null;
  conversation: ConversationDetailItem | null;
  error?: string;
};
