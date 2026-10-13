import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import {
  type CatalogFetchAuthorityInput,
  type CatalogFetchCompletionState,
  type CatalogFetchRunContractWriteResult,
  type CatalogFetchSemantics,
  writeCatalogFetchRunContract,
} from '@/lib/catalog/catalog-fetch-run-contract-writer';

export type CatalogFetchSyncMode =
  | 'full'
  | 'incremental'
  | 'manual';

export type CatalogRawItemType =
  | 'product'
  | 'variant'
  | 'image'
  | 'inventory'
  | 'price'
  | 'other';

export type CatalogFetchRawItemInput = {
  externalProductId: string;
  externalVariantId?: string | null;
  itemType: CatalogRawItemType;
  payload: Record<string, unknown>;
};

export type CatalogFetchOutcomeInput = {
  tenantId: string;
  catalogSourceId: string;
  catalogSourceAccountBindingId: string;
  syncMode: CatalogFetchSyncMode;
  startedAt: string | Date;
  finishedAt: string | Date;
  notes: string;
  metadata: Record<string, unknown>;
  itemsSeen?: number;
  errorCount?: number;
  contract: {
    adapterMode: string;
    fetchSemantics: CatalogFetchSemantics;
    completionState: CatalogFetchCompletionState;
    traversalComplete: boolean;
    productCollectionComplete: boolean;
    variantCollectionComplete: boolean;
    authority: CatalogFetchAuthorityInput;
    adapterEvidence: Record<string, unknown>;
  };
  rawItems?: CatalogFetchRawItemInput[];
};

export type CatalogFetchOutcomeResult = {
  runId: string;
  runStatus: 'success' | 'partial' | 'failed';
  rawItemCount: number;
  fetchContract: CatalogFetchRunContractWriteResult;
};

export type CatalogFetchOutcomeErrorCode =
  | 'FETCH_OUTCOME_INVALID_INPUT'
  | 'FETCH_OUTCOME_TIMESTAMP_INVALID'
  | 'FETCH_OUTCOME_RAW_QUEUE_NOT_ALLOWED'
  | 'FETCH_OUTCOME_RAW_ITEM_INVALID'
  | 'FETCH_OUTCOME_RAW_ITEM_DUPLICATE'
  | 'FETCH_OUTCOME_JSON_INVALID'
  | 'FETCH_OUTCOME_SOURCE_BUSY'
  | 'FETCH_OUTCOME_ACQUISITION_REQUIRED'
  | 'FETCH_OUTCOME_ACQUISITION_SCOPE_MISMATCH'
  | 'FETCH_OUTCOME_ACQUISITION_INCOMPLETE'
  | 'FETCH_OUTCOME_RUN_CREATE_FAILED';

export class CatalogFetchOutcomeError extends Error {
  constructor(
    public readonly code: CatalogFetchOutcomeErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CatalogFetchOutcomeError';
  }
}

type CreatedRunRow = {
  id: string;
};

function normalizeRequiredText(
  value: string | null | undefined,
): string | null {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function normalizeTimestamp(
  value: string | Date,
): string | null {
  const date = value instanceof Date ? value : new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

function serializeJson(
  value: Record<string, unknown>,
  fieldName: string,
): string {
  try {
    const serialized = JSON.stringify(value);

    if (!serialized) {
      throw new Error(`${fieldName} serialized to an empty value.`);
    }

    return serialized;
  } catch (error) {
    throw new CatalogFetchOutcomeError(
      'FETCH_OUTCOME_JSON_INVALID',
      error instanceof Error
        ? `${fieldName} must be JSON-serializable: ${error.message}`
        : `${fieldName} must be JSON-serializable.`,
    );
  }
}

function normalizeNonNegativeInteger(
  value: number | undefined,
  fallback: number,
): number | null {
  const candidate = value ?? fallback;

  if (!Number.isInteger(candidate) || candidate < 0) {
    return null;
  }

  return candidate;
}

function runStatusForCompletion(
  completionState: CatalogFetchCompletionState,
): 'success' | 'partial' | 'failed' {
  switch (completionState) {
    case 'complete':
      return 'success';
    case 'partial':
      return 'partial';
    case 'failed':
      return 'failed';
  }
}

function validateAndNormalizeRawItems(
  rawItems: CatalogFetchRawItemInput[],
  completionState: CatalogFetchCompletionState,
) {
  if (completionState !== 'complete' && rawItems.length > 0) {
    throw new CatalogFetchOutcomeError(
      'FETCH_OUTCOME_RAW_QUEUE_NOT_ALLOWED',
      'Partial or failed fetch outcomes cannot publish importable raw queue items.',
    );
  }

  const allowedItemTypes = new Set<CatalogRawItemType>([
    'product',
    'variant',
    'image',
    'inventory',
    'price',
    'other',
  ]);
  const seenKeys = new Set<string>();

  return rawItems.map((item, index) => {
    const externalProductId = normalizeRequiredText(
      item.externalProductId,
    );
    const externalVariantId = item.externalVariantId == null
      ? null
      : normalizeRequiredText(item.externalVariantId);

    if (
      !externalProductId ||
      !allowedItemTypes.has(item.itemType) ||
      !isPlainObject(item.payload)
    ) {
      throw new CatalogFetchOutcomeError(
        'FETCH_OUTCOME_RAW_ITEM_INVALID',
        `Raw queue item at index ${index} is missing a stable product id, valid item type or object payload.`,
      );
    }

    const stableKey = [
      item.itemType,
      externalProductId,
      externalVariantId ?? '',
    ].join('\u0000');

    if (seenKeys.has(stableKey)) {
      throw new CatalogFetchOutcomeError(
        'FETCH_OUTCOME_RAW_ITEM_DUPLICATE',
        `Duplicate raw queue item key detected at index ${index}.`,
      );
    }

    seenKeys.add(stableKey);

    return {
      externalProductId,
      externalVariantId,
      itemType: item.itemType,
      payloadJson: serializeJson(
        item.payload,
        `rawItems[${index}].payload`,
      ),
    };
  });
}

async function persistCatalogFetchOutcomeInTransaction(
  input: CatalogFetchOutcomeInput,
  tx: Prisma.TransactionClient,
): Promise<CatalogFetchOutcomeResult> {
  const tenantId = normalizeRequiredText(input.tenantId);
  const catalogSourceId = normalizeRequiredText(
    input.catalogSourceId,
  );
  const catalogSourceAccountBindingId = normalizeRequiredText(
    input.catalogSourceAccountBindingId,
  );
  const notes = normalizeRequiredText(input.notes);
  const rawItems = Array.isArray(input.rawItems)
    ? input.rawItems
    : [];

  if (
    !tenantId ||
    !catalogSourceId ||
    !catalogSourceAccountBindingId ||
    !notes ||
    !['full', 'incremental', 'manual'].includes(input.syncMode) ||
    !isPlainObject(input.metadata)
  ) {
    throw new CatalogFetchOutcomeError(
      'FETCH_OUTCOME_INVALID_INPUT',
      'Fetch outcome requires valid source identity, sync mode, notes and metadata.',
    );
  }

  const startedAt = normalizeTimestamp(input.startedAt);
  const finishedAt = normalizeTimestamp(input.finishedAt);

  if (
    !startedAt ||
    !finishedAt ||
    new Date(finishedAt).getTime() < new Date(startedAt).getTime()
  ) {
    throw new CatalogFetchOutcomeError(
      'FETCH_OUTCOME_TIMESTAMP_INVALID',
      'Fetch outcome requires valid timestamps with finishedAt greater than or equal to startedAt.',
    );
  }

  const normalizedRawItems = validateAndNormalizeRawItems(
    rawItems,
    input.contract.completionState,
  );

  const itemsSeen = normalizeNonNegativeInteger(
    input.itemsSeen,
    normalizedRawItems.length,
  );
  const errorCount = normalizeNonNegativeInteger(
    input.errorCount,
    input.contract.completionState === 'failed' ? 1 : 0,
  );

  if (itemsSeen == null || errorCount == null) {
    throw new CatalogFetchOutcomeError(
      'FETCH_OUTCOME_INVALID_INPUT',
      'itemsSeen and errorCount must be non-negative integers.',
    );
  }

  const metadataJson = serializeJson(
    input.metadata,
    'metadata',
  );
  const runStatus = runStatusForCompletion(
    input.contract.completionState,
  );

  const runRows = await tx.$queryRaw<CreatedRunRow[]>`
    INSERT INTO public.catalog_sync_runs (
      tenant_id,
      catalog_source_id,
      sync_mode,
      status,
      started_at,
      finished_at,
      items_seen,
      items_created,
      items_updated,
      items_deactivated,
      error_count,
      notes,
      metadata
    )
    VALUES (
      CAST(${tenantId} AS uuid),
      CAST(${catalogSourceId} AS uuid),
      ${input.syncMode},
      ${runStatus},
      CAST(${startedAt} AS timestamptz),
      CAST(${finishedAt} AS timestamptz),
      ${itemsSeen},
      0,
      0,
      0,
      ${errorCount},
      ${notes},
      CAST(${metadataJson} AS jsonb)
    )
    RETURNING id
  `;

  const runId = runRows[0]?.id;

  if (!runId) {
    throw new CatalogFetchOutcomeError(
      'FETCH_OUTCOME_RUN_CREATE_FAILED',
      'Terminal catalog fetch run insert returned no id.',
    );
  }

  const fetchContract = await writeCatalogFetchRunContract(tx, {
    catalogSyncRunId: runId,
    tenantId,
    catalogSourceId,
    catalogSourceAccountBindingId,
    adapterMode: input.contract.adapterMode,
    fetchSemantics: input.contract.fetchSemantics,
    completionState: input.contract.completionState,
    traversalComplete: input.contract.traversalComplete,
    productCollectionComplete:
      input.contract.productCollectionComplete,
    variantCollectionComplete:
      input.contract.variantCollectionComplete,
    authority: input.contract.authority,
    adapterEvidence: input.contract.adapterEvidence,
  });

  const chunkSize = 250;

  for (
    let offset = 0;
    offset < normalizedRawItems.length;
    offset += chunkSize
  ) {
    const chunk = normalizedRawItems.slice(
      offset,
      offset + chunkSize,
    );

    const valueRows = chunk.map((item) => Prisma.sql`(
      CAST(${tenantId} AS uuid),
      CAST(${catalogSourceId} AS uuid),
      CAST(${runId} AS uuid),
      CAST(${runId} AS uuid),
      ${item.externalProductId},
      ${item.externalVariantId},
      ${item.itemType},
      'pending',
      CAST(${item.payloadJson} AS jsonb)
    )`);

    await tx.$executeRaw(
      Prisma.sql`
        INSERT INTO public.catalog_sync_raw_items (
          tenant_id,
          catalog_source_id,
          catalog_sync_run_id,
          created_by_sync_run_id,
          external_product_id,
          external_variant_id,
          item_type,
          processed_status,
          payload_json
        )
        VALUES ${Prisma.join(valueRows, ', ')}
      `,
    );
  }

  return {
    runId,
    runStatus,
    rawItemCount: normalizedRawItems.length,
    fetchContract,
  };
}

export async function persistCatalogFetchOutcome(
  input: CatalogFetchOutcomeInput,
): Promise<CatalogFetchOutcomeResult> {
  if (input.contract.authority.basis === 'fetch_completed_at') {
    throw new CatalogFetchOutcomeError(
      'FETCH_OUTCOME_ACQUISITION_REQUIRED',
      'Local fetch completion requires a serialized source acquisition.',
    );
  }
  return prisma.$transaction((tx) =>
    persistCatalogFetchOutcomeInTransaction(input, tx),
  );
}

export type CatalogSourceAcquisitionScope = {
  tenantId: string;
  catalogSourceId: string;
  catalogSourceAccountBindingId: string;
};

export type CatalogSourceAcquisition = {
  startedAt: string;
  signal: AbortSignal;
  persistOutcome: (input: CatalogFetchOutcomeInput) => Promise<CatalogFetchOutcomeResult>;
};

// A completion-time authority must cover the provider read and its atomic
// persistence. Reuse the lifecycle lock across processes; release it before
// dispatching an importer. Both the HTTP read and this transaction are bounded.
export async function withCatalogSourceAcquisition<T>(
  scope: CatalogSourceAcquisitionScope,
  work: (acquisition: CatalogSourceAcquisition) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const lockKey = `catalog_source_lifecycle_v2:${scope.tenantId}:${scope.catalogSourceId}`;
    const locks = await tx.$queryRaw<Array<{ acquired: boolean }>>`
      SELECT pg_try_advisory_xact_lock(hashtextextended(${lockKey}, 0)) AS acquired
    `;
    if (locks[0]?.acquired !== true) {
      throw new CatalogFetchOutcomeError(
        'FETCH_OUTCOME_SOURCE_BUSY',
        'Bu katalog kaynağı şu anda başka bir işlem tarafından kullanılıyor.',
      );
    }
    const gate = await tx.$queryRaw<Array<{ active_binding: boolean; active_run: boolean; open_raw: boolean; acquired_at: Date; transaction_id: string }>>`
      SELECT
        EXISTS (
          SELECT 1 FROM public.catalog_source_account_bindings b
          JOIN public.catalog_sources s ON s.id = b.catalog_source_id AND s.tenant_id = b.tenant_id
          WHERE b.id = CAST(${scope.catalogSourceAccountBindingId} AS uuid)
            AND b.tenant_id = CAST(${scope.tenantId} AS uuid)
            AND b.catalog_source_id = CAST(${scope.catalogSourceId} AS uuid)
            AND b.is_active IS TRUE AND b.retired_at IS NULL AND s.is_active IS TRUE
        ) AS active_binding,
        EXISTS (
          SELECT 1 FROM public.catalog_sync_runs r
          WHERE r.tenant_id = CAST(${scope.tenantId} AS uuid)
            AND r.catalog_source_id = CAST(${scope.catalogSourceId} AS uuid)
            AND r.status IN ('queued', 'running')
        ) AS active_run,
        EXISTS (
          SELECT 1 FROM public.catalog_sync_raw_items r
          WHERE r.tenant_id = CAST(${scope.tenantId} AS uuid)
            AND r.catalog_source_id = CAST(${scope.catalogSourceId} AS uuid)
            AND r.processed_status IS DISTINCT FROM 'imported'
        ) AS open_raw,
        clock_timestamp() AS acquired_at,
        txid_current()::text AS transaction_id
    `;
    const row = gate[0];
    if (!row || row.active_binding !== true) {
      throw new CatalogFetchOutcomeError(
        'FETCH_OUTCOME_ACQUISITION_SCOPE_MISMATCH',
        'An active tenant/source/account binding is required for acquisition.',
      );
    }
    if (row.active_run || row.open_raw) {
      throw new CatalogFetchOutcomeError(
        'FETCH_OUTCOME_SOURCE_BUSY',
        'Bu katalog kaynağının önceki işlemi henüz tamamlanmadı.',
      );
    }
    const startedAt = row.acquired_at.toISOString();
    let active = true;
    let outcomeStarted = false;
    let outcomePersisted = false;
    try {
      const result = await work({
        startedAt,
        signal: AbortSignal.timeout(45_000),
        persistOutcome: async (input) => {
          if (!active || outcomeStarted || input.tenantId !== scope.tenantId ||
              input.catalogSourceId !== scope.catalogSourceId ||
              input.catalogSourceAccountBindingId !== scope.catalogSourceAccountBindingId ||
              normalizeTimestamp(input.startedAt) !== startedAt ||
              input.contract.authority.basis !== 'fetch_completed_at') {
            throw new CatalogFetchOutcomeError(
              'FETCH_OUTCOME_ACQUISITION_SCOPE_MISMATCH',
              'One fetch outcome must belong to the current source acquisition.',
            );
          }
          outcomeStarted = true;
          const outcome = await persistCatalogFetchOutcomeInTransaction({
            ...input,
            contract: {
              ...input.contract,
              adapterEvidence: {
                ...input.contract.adapterEvidence,
                ordering_guarantee: 'serialized_source_acquisition',
                source_acquisition: {
                  contract_version: 'catalog_source_acquisition_v1',
                  mechanism: 'postgres_transaction_advisory_lock',
                  tenant_id: scope.tenantId,
                  catalog_source_id: scope.catalogSourceId,
                  catalog_source_account_binding_id: scope.catalogSourceAccountBindingId,
                  acquired_at: startedAt,
                  transaction_id: row.transaction_id,
                },
              },
            },
          }, tx);
          outcomePersisted = true;
          return outcome;
        },
      });
      if (!outcomePersisted) {
        throw new CatalogFetchOutcomeError(
          'FETCH_OUTCOME_ACQUISITION_INCOMPLETE',
          'Source acquisition did not persist a terminal fetch outcome.',
        );
      }
      return result;
    } finally {
      active = false;
    }
  }, { maxWait: 2_000, timeout: 60_000 });
}
