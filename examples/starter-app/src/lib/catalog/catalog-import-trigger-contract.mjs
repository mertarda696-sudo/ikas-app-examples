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

export function classifyCatalogImportTrigger(
  input: CatalogImportTriggerClassificationInput,
): CatalogImportTriggerErrorCode | null {
  if (input.skipped === true) {
    return 'trigger_skipped';
  }

  if (!input.configured) {
    return 'webhook_not_configured';
  }

  if (input.ok) {
    return null;
  }

  return Number.isInteger(input.status) &&
    input.status !== null &&
    input.status >= 100 &&
    input.status <= 599
    ? 'webhook_http_error'
    : 'webhook_network_error';
}
