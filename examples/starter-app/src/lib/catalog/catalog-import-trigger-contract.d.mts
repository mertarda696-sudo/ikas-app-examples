export type CatalogImportTriggerErrorCode =
  | 'webhook_not_configured'
  | 'webhook_http_error'
  | 'webhook_network_error'
  | 'trigger_skipped';

export type CatalogImportTriggerClassificationInput = {
  configured: boolean;
  ok: boolean;
  status: number | null;
  skipped?: boolean;
};

export declare function classifyCatalogImportTrigger(
  input: CatalogImportTriggerClassificationInput,
): CatalogImportTriggerErrorCode | null;
