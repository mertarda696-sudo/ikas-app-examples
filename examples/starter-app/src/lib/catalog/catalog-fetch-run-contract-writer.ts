import { Prisma } from '@prisma/client';

export const CATALOG_FETCH_CONTRACT_VERSION = 'e2_fetch_v1';
export const CATALOG_SOURCE_AUTHORITY_VERSION =
  'e2_source_authority_v1';

export type CatalogFetchSemantics =
  | 'full_snapshot'
  | 'delta'
  | 'explicit_event';

export type CatalogFetchCompletionState =
  | 'complete'
  | 'partial'
  | 'failed';

export type CatalogFetchAuthorityInput =
  | {
      basis: 'fetch_completed_at';
    }
  | {
      basis: 'provider_sequence';
      authorityOrder: string | number;
      sourceObservedAt?: string | Date | null;
    }
  | {
      basis: 'provider_observed_at';
      authorityOrder: string | number;
      sourceObservedAt: string | Date;
    };

export type CatalogFetchRunContractWriteInput = {
  catalogSyncRunId: string;
  tenantId: string;
  catalogSourceId: string;
  catalogSourceAccountBindingId: string;
  adapterMode: string;
  fetchSemantics: CatalogFetchSemantics;
  completionState: CatalogFetchCompletionState;
  traversalComplete: boolean;
  productCollectionComplete: boolean;
  variantCollectionComplete: boolean;
  authority: CatalogFetchAuthorityInput;
  adapterEvidence: Record<string, unknown>;
};

export type CatalogFetchRunContractWriteResult = {
  catalogSyncRunId: string;
  tenantId: string;
  catalogSourceId: string;
  catalogSourceAccountBindingId: string;
  contractVersion: typeof CATALOG_FETCH_CONTRACT_VERSION;
  authorityContractVersion: typeof CATALOG_SOURCE_AUTHORITY_VERSION;
  adapterMode: string;
  fetchSemantics: CatalogFetchSemantics;
  completionState: CatalogFetchCompletionState;
  traversalComplete: boolean;
  productCollectionComplete: boolean;
  variantCollectionComplete: boolean;
  productReconciliationState: 'pending' | 'not_eligible';
  variantReconciliationState: 'pending' | 'not_eligible';
  authorityBasis: CatalogFetchAuthorityInput['basis'];
  authorityOrder: string;
  sourceObservedAt: string | null;
};

export type CatalogFetchRunContractErrorCode =
  | 'FETCH_CONTRACT_INVALID_INPUT'
  | 'FETCH_CONTRACT_RUN_NOT_FOUND'
  | 'FETCH_CONTRACT_RUN_NOT_FINISHED'
  | 'FETCH_CONTRACT_RUN_STATE_MISMATCH'
  | 'FETCH_CONTRACT_BINDING_NOT_ACTIVE'
  | 'FETCH_CONTRACT_ALREADY_EXISTS'
  | 'FETCH_CONTRACT_AUTHORITY_HISTORY_MIXED'
  | 'FETCH_CONTRACT_AUTHORITY_BASIS_CHANGE_NOT_ALLOWED'
  | 'FETCH_CONTRACT_AUTHORITY_ORDER_INVALID'
  | 'FETCH_CONTRACT_SOURCE_OBSERVED_AT_INVALID'
  | 'FETCH_CONTRACT_COLLECTION_INCONSISTENT'
  | 'FETCH_CONTRACT_ADAPTER_EVIDENCE_INVALID'
  | 'FETCH_CONTRACT_WRITE_FAILED';

export class CatalogFetchRunContractError extends Error {
  constructor(
    public readonly code: CatalogFetchRunContractErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CatalogFetchRunContractError';
  }
}

type RunRow = {
  id: string;
  tenant_id: string;
  catalog_source_id: string;
  status: string;
  finished_at: Date | string | null;
};

type BindingRow = {
  id: string;
};

type ExistingContractRow = {
  catalog_sync_run_id: string;
};

type AuthorityBasisRow = {
  authority_basis: CatalogFetchAuthorityInput['basis'];
};

type AuthorityOrderRow = {
  next_authority_order: string;
};

type InsertedContractRow = {
  catalog_sync_run_id: string;
  tenant_id: string;
  catalog_source_id: string;
  catalog_source_account_binding_id: string;
  contract_version: typeof CATALOG_FETCH_CONTRACT_VERSION;
  authority_contract_version: typeof CATALOG_SOURCE_AUTHORITY_VERSION;
  adapter_mode: string;
  fetch_semantics: CatalogFetchSemantics;
  completion_state: CatalogFetchCompletionState;
  traversal_complete: boolean;
  product_collection_complete: boolean;
  variant_collection_complete: boolean;
  product_reconciliation_state: 'pending' | 'not_eligible';
  variant_reconciliation_state: 'pending' | 'not_eligible';
  authority_basis: CatalogFetchAuthorityInput['basis'];
  authority_order: string;
  source_observed_at: Date | string | null;
};

function normalizeRequiredText(
  value: string | null | undefined,
): string | null {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function normalizeAdapterMode(value: string): string | null {
  const normalized = normalizeRequiredText(value)?.toLowerCase() ?? null;

  if (!normalized || normalized.length > 128) {
    return null;
  }

  return normalized;
}

function normalizeAuthorityOrder(
  value: string | number,
): string | null {
  const normalized = String(value ?? '').trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  return normalized.replace(/^0+(?=\d)/, '');
}

function normalizeTimestamp(
  value: string | Date | null | undefined,
): string | null {
  if (value == null) {
    return null;
  }

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

function validateCollectionContract(input: {
  fetchSemantics: CatalogFetchSemantics;
  completionState: CatalogFetchCompletionState;
  traversalComplete: boolean;
  productCollectionComplete: boolean;
  variantCollectionComplete: boolean;
}) {
  if (
    input.variantCollectionComplete &&
    !input.productCollectionComplete
  ) {
    throw new CatalogFetchRunContractError(
      'FETCH_CONTRACT_COLLECTION_INCONSISTENT',
      'Variant collection completeness requires product collection completeness.',
    );
  }

  if (
    input.productCollectionComplete &&
    !input.traversalComplete
  ) {
    throw new CatalogFetchRunContractError(
      'FETCH_CONTRACT_COLLECTION_INCONSISTENT',
      'Product collection completeness requires traversal completeness.',
    );
  }

  if (
    input.fetchSemantics !== 'full_snapshot' &&
    (input.productCollectionComplete ||
      input.variantCollectionComplete)
  ) {
    throw new CatalogFetchRunContractError(
      'FETCH_CONTRACT_COLLECTION_INCONSISTENT',
      'Only a full snapshot may declare product or variant collection completeness.',
    );
  }

  if (
    input.fetchSemantics === 'full_snapshot' &&
    input.completionState === 'complete' &&
    (!input.traversalComplete ||
      !input.productCollectionComplete)
  ) {
    throw new CatalogFetchRunContractError(
      'FETCH_CONTRACT_COLLECTION_INCONSISTENT',
      'A complete full snapshot requires complete traversal and product collection coverage.',
    );
  }
}

function validateRunCompletionState(
  runStatus: string,
  completionState: CatalogFetchCompletionState,
) {
  const expectedRunStatus: Record<CatalogFetchCompletionState, string> = {
    complete: 'success',
    partial: 'partial',
    failed: 'failed',
  };

  if (runStatus !== expectedRunStatus[completionState]) {
    throw new CatalogFetchRunContractError(
      'FETCH_CONTRACT_RUN_STATE_MISMATCH',
      `Fetch contract completion_state=${completionState} requires catalog_sync_runs.status=${expectedRunStatus[completionState]}.`,
    );
  }
}

function deriveReconciliationStates(input: {
  fetchSemantics: CatalogFetchSemantics;
  completionState: CatalogFetchCompletionState;
  traversalComplete: boolean;
  productCollectionComplete: boolean;
  variantCollectionComplete: boolean;
}): {
  product: 'pending' | 'not_eligible';
  variant: 'pending' | 'not_eligible';
} {
  const productEligible =
    input.fetchSemantics === 'full_snapshot' &&
    input.completionState === 'complete' &&
    input.traversalComplete &&
    input.productCollectionComplete;

  const variantEligible =
    productEligible && input.variantCollectionComplete;

  return {
    product: productEligible ? 'pending' : 'not_eligible',
    variant: variantEligible ? 'pending' : 'not_eligible',
  };
}

function serializeAdapterEvidence(
  evidence: Record<string, unknown>,
): string {
  try {
    const serialized = JSON.stringify(evidence);

    if (!serialized) {
      throw new Error('Adapter evidence serialized to an empty value.');
    }

    return serialized;
  } catch (error) {
    throw new CatalogFetchRunContractError(
      'FETCH_CONTRACT_ADAPTER_EVIDENCE_INVALID',
      error instanceof Error
        ? `Adapter evidence must be JSON-serializable: ${error.message}`
        : 'Adapter evidence must be JSON-serializable.',
    );
  }
}

export async function writeCatalogFetchRunContract(
  tx: Prisma.TransactionClient,
  input: CatalogFetchRunContractWriteInput,
): Promise<CatalogFetchRunContractWriteResult> {
  const catalogSyncRunId = normalizeRequiredText(
    input.catalogSyncRunId,
  );
  const tenantId = normalizeRequiredText(input.tenantId);
  const catalogSourceId = normalizeRequiredText(
    input.catalogSourceId,
  );
  const catalogSourceAccountBindingId = normalizeRequiredText(
    input.catalogSourceAccountBindingId,
  );
  const adapterMode = normalizeAdapterMode(input.adapterMode);

  if (
    !catalogSyncRunId ||
    !tenantId ||
    !catalogSourceId ||
    !catalogSourceAccountBindingId ||
    !adapterMode ||
    !isPlainObject(input.adapterEvidence)
  ) {
    throw new CatalogFetchRunContractError(
      'FETCH_CONTRACT_INVALID_INPUT',
      'Fetch contract identifiers, adapter mode and adapter evidence must be valid.',
    );
  }

  if (
    !['full_snapshot', 'delta', 'explicit_event'].includes(
      input.fetchSemantics,
    ) ||
    !['complete', 'partial', 'failed'].includes(
      input.completionState,
    ) ||
    typeof input.traversalComplete !== 'boolean' ||
    typeof input.productCollectionComplete !== 'boolean' ||
    typeof input.variantCollectionComplete !== 'boolean'
  ) {
    throw new CatalogFetchRunContractError(
      'FETCH_CONTRACT_INVALID_INPUT',
      'Fetch semantics, completion state and collection flags must satisfy the typed contract.',
    );
  }

  validateCollectionContract({
    fetchSemantics: input.fetchSemantics,
    completionState: input.completionState,
    traversalComplete: input.traversalComplete,
    productCollectionComplete: input.productCollectionComplete,
    variantCollectionComplete: input.variantCollectionComplete,
  });

  const evidenceJson = serializeAdapterEvidence(
    input.adapterEvidence,
  );

  const runRows = await tx.$queryRaw<RunRow[]>`
    SELECT
      r.id,
      r.tenant_id,
      r.catalog_source_id,
      r.status,
      r.finished_at
    FROM public.catalog_sync_runs r
    WHERE r.id = CAST(${catalogSyncRunId} AS uuid)
      AND r.tenant_id = CAST(${tenantId} AS uuid)
      AND r.catalog_source_id = CAST(${catalogSourceId} AS uuid)
    FOR UPDATE
  `;

  const run = runRows[0];

  if (!run) {
    throw new CatalogFetchRunContractError(
      'FETCH_CONTRACT_RUN_NOT_FOUND',
      'Catalog sync run does not match the supplied tenant and catalog source.',
    );
  }

  const runFinishedAt = normalizeTimestamp(run.finished_at);

  if (!runFinishedAt) {
    throw new CatalogFetchRunContractError(
      'FETCH_CONTRACT_RUN_NOT_FINISHED',
      'Typed fetch contract publication requires a terminal fetch run with finished_at.',
    );
  }

  validateRunCompletionState(
    String(run.status ?? '').trim(),
    input.completionState,
  );

  const bindingRows = await tx.$queryRaw<BindingRow[]>`
    SELECT b.id
    FROM public.catalog_source_account_bindings b
    JOIN public.catalog_sources s
      ON s.id = b.catalog_source_id
     AND s.tenant_id = b.tenant_id
    WHERE b.id = CAST(${catalogSourceAccountBindingId} AS uuid)
      AND b.tenant_id = CAST(${tenantId} AS uuid)
      AND b.catalog_source_id = CAST(${catalogSourceId} AS uuid)
      AND b.is_active IS TRUE
      AND b.retired_at IS NULL
      AND s.is_active IS TRUE
    FOR UPDATE OF b, s
  `;

  if (!bindingRows[0]) {
    throw new CatalogFetchRunContractError(
      'FETCH_CONTRACT_BINDING_NOT_ACTIVE',
      'Catalog source account binding is missing, inactive, retired or bound to a different source.',
    );
  }

  const existingRows = await tx.$queryRaw<ExistingContractRow[]>`
    SELECT fc.catalog_sync_run_id
    FROM public.catalog_fetch_run_contracts fc
    WHERE fc.catalog_sync_run_id = CAST(${catalogSyncRunId} AS uuid)
    FOR UPDATE
  `;

  if (existingRows[0]) {
    throw new CatalogFetchRunContractError(
      'FETCH_CONTRACT_ALREADY_EXISTS',
      'A typed fetch contract already exists for this catalog sync run.',
    );
  }

  const lockKey =
    `catalog_source_lifecycle_v2:${tenantId}:${catalogSourceId}`;

  // The blocking advisory lock returns PostgreSQL void. Keep that void value
  // inside the materialized CTE so Prisma only decodes a supported boolean.
  const lockRows = await tx.$queryRaw<Array<{ lock_acquired: boolean }>>`
    WITH lock_call AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(
        hashtextextended(${lockKey}, 0)
      )
    )
    SELECT TRUE AS lock_acquired
    FROM lock_call
  `;

  if (lockRows[0]?.lock_acquired !== true) {
    throw new CatalogFetchRunContractError(
      'FETCH_CONTRACT_WRITE_FAILED',
      'Catalog source lifecycle advisory lock call returned no confirmation row.',
    );
  }

  const existingBasisRows = await tx.$queryRaw<AuthorityBasisRow[]>`
    SELECT DISTINCT fc.authority_basis
    FROM public.catalog_fetch_run_contracts fc
    WHERE fc.tenant_id = CAST(${tenantId} AS uuid)
      AND fc.catalog_source_id = CAST(${catalogSourceId} AS uuid)
      AND fc.adapter_mode <> 'qa_fixture'
    ORDER BY fc.authority_basis
  `;

  const existingProductionBases = existingBasisRows.map(
    (row) => row.authority_basis,
  );

  if (existingProductionBases.length > 1) {
    throw new CatalogFetchRunContractError(
      'FETCH_CONTRACT_AUTHORITY_HISTORY_MIXED',
      'Catalog source already contains mixed production authority bases and requires explicit reconciliation before new authority publication.',
    );
  }

  const existingBasis = existingProductionBases[0] ?? null;

  if (existingBasis && existingBasis !== input.authority.basis) {
    throw new CatalogFetchRunContractError(
      'FETCH_CONTRACT_AUTHORITY_BASIS_CHANGE_NOT_ALLOWED',
      `Catalog source already uses authority basis ${existingBasis}; mixed production authority bases are not allowed.`,
    );
  }

  let authorityOrder: string;
  let sourceObservedAt: string | null;

  if (input.authority.basis === 'fetch_completed_at') {
    const orderRows = await tx.$queryRaw<AuthorityOrderRow[]>`
      SELECT (
        COALESCE(MAX(fc.authority_order), -1) + 1
      )::text AS next_authority_order
      FROM public.catalog_fetch_run_contracts fc
      WHERE fc.tenant_id = CAST(${tenantId} AS uuid)
        AND fc.catalog_source_id = CAST(${catalogSourceId} AS uuid)
        AND fc.authority_contract_version = ${CATALOG_SOURCE_AUTHORITY_VERSION}
        AND fc.authority_basis = 'fetch_completed_at'
    `;

    authorityOrder = orderRows[0]?.next_authority_order ?? '0';
    sourceObservedAt = runFinishedAt;
  } else {
    const normalizedOrder = normalizeAuthorityOrder(
      input.authority.authorityOrder,
    );

    if (!normalizedOrder) {
      throw new CatalogFetchRunContractError(
        'FETCH_CONTRACT_AUTHORITY_ORDER_INVALID',
        'Provider authority order must be a non-negative integer.',
      );
    }

    authorityOrder = normalizedOrder;
    sourceObservedAt = normalizeTimestamp(
      input.authority.sourceObservedAt,
    );

    if (
      input.authority.basis === 'provider_observed_at' &&
      !sourceObservedAt
    ) {
      throw new CatalogFetchRunContractError(
        'FETCH_CONTRACT_SOURCE_OBSERVED_AT_INVALID',
        'provider_observed_at authority requires a valid source observation timestamp.',
      );
    }
  }

  const reconciliation = deriveReconciliationStates({
    fetchSemantics: input.fetchSemantics,
    completionState: input.completionState,
    traversalComplete: input.traversalComplete,
    productCollectionComplete: input.productCollectionComplete,
    variantCollectionComplete: input.variantCollectionComplete,
  });

  const insertedRows = await tx.$queryRaw<InsertedContractRow[]>`
    INSERT INTO public.catalog_fetch_run_contracts (
      catalog_sync_run_id,
      tenant_id,
      catalog_source_id,
      catalog_source_account_binding_id,
      contract_version,
      adapter_mode,
      fetch_semantics,
      completion_state,
      traversal_complete,
      product_collection_complete,
      variant_collection_complete,
      product_reconciliation_state,
      product_reconciled_at,
      variant_reconciliation_state,
      variant_reconciled_at,
      adapter_evidence,
      authority_contract_version,
      authority_basis,
      authority_order,
      source_observed_at
    )
    VALUES (
      CAST(${catalogSyncRunId} AS uuid),
      CAST(${tenantId} AS uuid),
      CAST(${catalogSourceId} AS uuid),
      CAST(${catalogSourceAccountBindingId} AS uuid),
      ${CATALOG_FETCH_CONTRACT_VERSION},
      ${adapterMode},
      ${input.fetchSemantics},
      ${input.completionState},
      ${input.traversalComplete},
      ${input.productCollectionComplete},
      ${input.variantCollectionComplete},
      ${reconciliation.product},
      NULL,
      ${reconciliation.variant},
      NULL,
      CAST(${evidenceJson} AS jsonb),
      ${CATALOG_SOURCE_AUTHORITY_VERSION},
      ${input.authority.basis},
      CAST(${authorityOrder} AS bigint),
      CAST(${sourceObservedAt} AS timestamptz)
    )
    RETURNING
      catalog_sync_run_id,
      tenant_id,
      catalog_source_id,
      catalog_source_account_binding_id,
      contract_version,
      authority_contract_version,
      adapter_mode,
      fetch_semantics,
      completion_state,
      traversal_complete,
      product_collection_complete,
      variant_collection_complete,
      product_reconciliation_state,
      variant_reconciliation_state,
      authority_basis,
      authority_order::text AS authority_order,
      source_observed_at
  `;

  const inserted = insertedRows[0];

  if (!inserted) {
    throw new CatalogFetchRunContractError(
      'FETCH_CONTRACT_WRITE_FAILED',
      'Typed catalog fetch contract insert returned no row.',
    );
  }

  return {
    catalogSyncRunId: inserted.catalog_sync_run_id,
    tenantId: inserted.tenant_id,
    catalogSourceId: inserted.catalog_source_id,
    catalogSourceAccountBindingId:
      inserted.catalog_source_account_binding_id,
    contractVersion: inserted.contract_version,
    authorityContractVersion:
      inserted.authority_contract_version,
    adapterMode: inserted.adapter_mode,
    fetchSemantics: inserted.fetch_semantics,
    completionState: inserted.completion_state,
    traversalComplete: inserted.traversal_complete,
    productCollectionComplete:
      inserted.product_collection_complete,
    variantCollectionComplete:
      inserted.variant_collection_complete,
    productReconciliationState:
      inserted.product_reconciliation_state,
    variantReconciliationState:
      inserted.variant_reconciliation_state,
    authorityBasis: inserted.authority_basis,
    authorityOrder: inserted.authority_order,
    sourceObservedAt: normalizeTimestamp(
      inserted.source_observed_at,
    ),
  };
}
