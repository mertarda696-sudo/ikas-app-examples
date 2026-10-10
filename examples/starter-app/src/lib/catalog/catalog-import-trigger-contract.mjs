export function classifyCatalogImportTrigger(input) {
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
