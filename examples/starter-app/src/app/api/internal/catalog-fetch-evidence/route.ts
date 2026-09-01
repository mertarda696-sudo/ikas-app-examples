import { prisma } from '@/lib/prisma';
import { listActiveIkasCatalogIdentities } from '@/lib/catalog/ikas-catalog-fetch-service';
import { NextResponse } from 'next/server';

type FetchEvidenceRow = {
  fetch_run_id: string;
  run_status: string;
  sync_mode: string;
  started_at: Date | string | null;
  finished_at: Date | string | null;
  items_seen: number | string;
  error_count: number | string;
  run_type: string | null;
  outcome: string | null;
  queued_count: string | null;
  traversal_contract_version: string | null;
  pagination_sort: string | null;
  pages_fetched: string | null;
  upstream_count: string | null;
  run_traversal_complete: string | null;
  contract_version: string;
  adapter_mode: string;
  fetch_semantics: string;
  completion_state: string;
  traversal_complete: boolean;
  product_collection_complete: boolean;
  variant_collection_complete: boolean;
  product_reconciliation_state: string;
  variant_reconciliation_state: string;
  authority_contract_version: string;
  authority_basis: string;
  authority_order: string;
  source_observed_at: Date | string | null;
  source_observed_matches_finished_at: boolean;
  adapter_evidence: Record<string, unknown> | null;
};

type RawStatusRow = {
  processed_status: string;
  item_count: number | string;
  error_count: number | string;
};

type RawSummaryRow = {
  total_count: number | string;
  processed_count: number | string;
  normalized_count: number | string;
  error_count: number | string;
};

type ImportRunRow = {
  id: string;
  status: string;
  sync_mode: string;
  started_at: Date | string | null;
  finished_at: Date | string | null;
  items_seen: number | string;
  items_created: number | string;
  items_updated: number | string;
  items_deactivated: number | string;
  error_count: number | string;
  run_type: string | null;
  worker: string | null;
  upstream_fetch_sync_run_id: string | null;
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIso(value: Date | string | null | undefined) {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview') {
    return json(
      {
        ok: false,
        fetchedAt: new Date().toISOString(),
        error: 'NOT_FOUND',
      },
      404,
    );
  }

  const identities = await listActiveIkasCatalogIdentities();

  if (identities.length !== 1) {
    return json(
      {
        ok: false,
        fetchedAt: new Date().toISOString(),
        activeTypedCatalogIdentityCount: identities.length,
        error: 'EVIDENCE_IDENTITY_CARDINALITY_INVALID',
      },
      409,
    );
  }

  const identity = identities[0];

  const evidenceRows = await prisma.$queryRaw<FetchEvidenceRow[]>`
    SELECT
      r.id::text AS fetch_run_id,
      r.status AS run_status,
      r.sync_mode,
      r.started_at,
      r.finished_at,
      r.items_seen,
      r.error_count,
      r.metadata->>'run_type' AS run_type,
      r.metadata->>'outcome' AS outcome,
      r.metadata->>'queued_count' AS queued_count,
      r.metadata->>'traversal_contract_version' AS traversal_contract_version,
      r.metadata->>'pagination_sort' AS pagination_sort,
      r.metadata->>'pages_fetched' AS pages_fetched,
      r.metadata->>'upstream_count' AS upstream_count,
      r.metadata->>'traversal_complete' AS run_traversal_complete,
      fc.contract_version,
      fc.adapter_mode,
      fc.fetch_semantics,
      fc.completion_state,
      fc.traversal_complete,
      fc.product_collection_complete,
      fc.variant_collection_complete,
      fc.product_reconciliation_state,
      fc.variant_reconciliation_state,
      fc.authority_contract_version,
      fc.authority_basis,
      fc.authority_order::text AS authority_order,
      fc.source_observed_at,
      (fc.source_observed_at = r.finished_at) AS source_observed_matches_finished_at,
      fc.adapter_evidence
    FROM public.catalog_fetch_run_contracts fc
    JOIN public.catalog_sync_runs r
      ON r.id = fc.catalog_sync_run_id
     AND r.tenant_id = fc.tenant_id
     AND r.catalog_source_id = fc.catalog_source_id
    WHERE fc.tenant_id = CAST(${identity.tenantId} AS uuid)
      AND fc.catalog_source_id = CAST(${identity.catalogSourceId} AS uuid)
      AND fc.adapter_mode <> 'qa_fixture'
    ORDER BY r.finished_at DESC NULLS LAST, r.started_at DESC
    LIMIT 1
  `;

  const evidence = evidenceRows[0] ?? null;

  if (!evidence) {
    return json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      evidenceFound: false,
      productionContractCount: 0,
      fetchRun: null,
      fetchContract: null,
      rawQueue: null,
      importRuns: [],
      assertions: {
        typedContractFound: false,
      },
      error: null,
    });
  }

  const rawStatusRows = await prisma.$queryRaw<RawStatusRow[]>`
    SELECT
      cri.processed_status,
      COUNT(*)::int AS item_count,
      COUNT(*) FILTER (
        WHERE NULLIF(BTRIM(COALESCE(cri.error_text, '')), '') IS NOT NULL
      )::int AS error_count
    FROM public.catalog_sync_raw_items cri
    WHERE cri.tenant_id = CAST(${identity.tenantId} AS uuid)
      AND cri.catalog_source_id = CAST(${identity.catalogSourceId} AS uuid)
      AND cri.catalog_sync_run_id = CAST(${evidence.fetch_run_id} AS uuid)
    GROUP BY cri.processed_status
    ORDER BY cri.processed_status
  `;

  const rawSummaryRows = await prisma.$queryRaw<RawSummaryRow[]>`
    SELECT
      COUNT(*)::int AS total_count,
      COUNT(*) FILTER (
        WHERE cri.processed_at IS NOT NULL
      )::int AS processed_count,
      COUNT(*) FILTER (
        WHERE cri.normalized_json IS NOT NULL
      )::int AS normalized_count,
      COUNT(*) FILTER (
        WHERE NULLIF(BTRIM(COALESCE(cri.error_text, '')), '') IS NOT NULL
      )::int AS error_count
    FROM public.catalog_sync_raw_items cri
    WHERE cri.tenant_id = CAST(${identity.tenantId} AS uuid)
      AND cri.catalog_source_id = CAST(${identity.catalogSourceId} AS uuid)
      AND cri.catalog_sync_run_id = CAST(${evidence.fetch_run_id} AS uuid)
  `;

  const importRunRows = await prisma.$queryRaw<ImportRunRow[]>`
    SELECT DISTINCT
      ir.id::text AS id,
      ir.status,
      ir.sync_mode,
      ir.started_at,
      ir.finished_at,
      ir.items_seen,
      ir.items_created,
      ir.items_updated,
      ir.items_deactivated,
      ir.error_count,
      ir.metadata->>'run_type' AS run_type,
      ir.metadata->>'worker' AS worker,
      ir.metadata->>'upstream_fetch_sync_run_id' AS upstream_fetch_sync_run_id
    FROM public.catalog_sync_raw_items cri
    JOIN public.catalog_sync_runs ir
      ON ir.id = cri.processed_by_sync_run_id
     AND ir.tenant_id = cri.tenant_id
     AND ir.catalog_source_id = cri.catalog_source_id
    WHERE cri.tenant_id = CAST(${identity.tenantId} AS uuid)
      AND cri.catalog_source_id = CAST(${identity.catalogSourceId} AS uuid)
      AND cri.catalog_sync_run_id = CAST(${evidence.fetch_run_id} AS uuid)
      AND cri.processed_by_sync_run_id IS NOT NULL
    ORDER BY ir.started_at, ir.id
  `;

  const contractCountRows = await prisma.$queryRaw<
    Array<{ contract_count: number | string }>
  >`
    SELECT COUNT(*)::int AS contract_count
    FROM public.catalog_fetch_run_contracts fc
    WHERE fc.tenant_id = CAST(${identity.tenantId} AS uuid)
      AND fc.catalog_source_id = CAST(${identity.catalogSourceId} AS uuid)
      AND fc.adapter_mode <> 'qa_fixture'
  `;

  const rawSummary = rawSummaryRows[0] ?? {
    total_count: 0,
    processed_count: 0,
    normalized_count: 0,
    error_count: 0,
  };
  const itemsSeen = toNumber(evidence.items_seen);
  const rawTotal = toNumber(rawSummary.total_count);
  const rawProcessed = toNumber(rawSummary.processed_count);
  const rawErrors = toNumber(rawSummary.error_count);
  const zeroItems = itemsSeen === 0;

  const fetchRun = {
    id: evidence.fetch_run_id,
    status: evidence.run_status,
    syncMode: evidence.sync_mode,
    startedAt: toIso(evidence.started_at),
    finishedAt: toIso(evidence.finished_at),
    itemsSeen,
    errorCount: toNumber(evidence.error_count),
    runType: evidence.run_type,
    outcome: evidence.outcome,
    queuedCount: toNumber(evidence.queued_count),
    traversalContractVersion: evidence.traversal_contract_version,
    paginationSort: evidence.pagination_sort,
    pagesFetched: toNumber(evidence.pages_fetched),
    upstreamCount: toNumber(evidence.upstream_count),
    traversalComplete: evidence.run_traversal_complete === 'true',
  };

  const fetchContract = {
    contractVersion: evidence.contract_version,
    adapterMode: evidence.adapter_mode,
    fetchSemantics: evidence.fetch_semantics,
    completionState: evidence.completion_state,
    traversalComplete: evidence.traversal_complete,
    productCollectionComplete: evidence.product_collection_complete,
    variantCollectionComplete: evidence.variant_collection_complete,
    productReconciliationState: evidence.product_reconciliation_state,
    variantReconciliationState: evidence.variant_reconciliation_state,
    authorityContractVersion: evidence.authority_contract_version,
    authorityBasis: evidence.authority_basis,
    authorityOrder: evidence.authority_order,
    sourceObservedAt: toIso(evidence.source_observed_at),
    sourceObservedMatchesFinishedAt:
      evidence.source_observed_matches_finished_at,
    adapterEvidence: evidence.adapter_evidence,
  };

  const rawQueue = {
    totalCount: rawTotal,
    processedCount: rawProcessed,
    normalizedCount: toNumber(rawSummary.normalized_count),
    errorCount: rawErrors,
    byStatus: rawStatusRows.map((row) => ({
      status: row.processed_status,
      count: toNumber(row.item_count),
      errorCount: toNumber(row.error_count),
    })),
  };

  const importRuns = importRunRows.map((row) => ({
    id: row.id,
    status: row.status,
    syncMode: row.sync_mode,
    startedAt: toIso(row.started_at),
    finishedAt: toIso(row.finished_at),
    itemsSeen: toNumber(row.items_seen),
    itemsCreated: toNumber(row.items_created),
    itemsUpdated: toNumber(row.items_updated),
    itemsDeactivated: toNumber(row.items_deactivated),
    errorCount: toNumber(row.error_count),
    runType: row.run_type,
    worker: row.worker,
    upstreamFetchSyncRunId: row.upstream_fetch_sync_run_id,
  }));

  const assertions = {
    typedContractFound: true,
    exactlyOneProductionContract:
      toNumber(contractCountRows[0]?.contract_count) === 1,
    fetchRunTerminalSuccess: evidence.run_status === 'success',
    fullSyncMode: evidence.sync_mode === 'full',
    fetchContractVersionPass: evidence.contract_version === 'e2_fetch_v1',
    authorityContractVersionPass:
      evidence.authority_contract_version === 'e2_source_authority_v1',
    fullSnapshotSemantics: evidence.fetch_semantics === 'full_snapshot',
    completionComplete: evidence.completion_state === 'complete',
    traversalComplete: evidence.traversal_complete === true,
    productCollectionComplete:
      evidence.product_collection_complete === true,
    variantCollectionComplete:
      evidence.variant_collection_complete === true,
    fetchCompletedAtAuthority:
      evidence.authority_basis === 'fetch_completed_at',
    sourceObservedMatchesRunFinishedAt:
      evidence.source_observed_matches_finished_at === true,
    rawQueueCountMatchesFetch:
      zeroItems ? rawTotal === 0 : rawTotal === itemsSeen,
    rawQueueHasNoErrors: rawErrors === 0,
    rawQueueFullyProcessed:
      zeroItems ? rawTotal === 0 : rawProcessed === rawTotal,
    importRunObserved: zeroItems ? true : importRuns.length > 0,
  };

  return json({
    ok: true,
    fetchedAt: new Date().toISOString(),
    evidenceFound: true,
    productionContractCount: toNumber(
      contractCountRows[0]?.contract_count,
    ),
    fetchRun,
    fetchContract,
    rawQueue,
    importRuns,
    assertions,
    error: null,
  });
}
