import { prisma } from '@/lib/prisma';
import { listActiveIkasCatalogIdentities } from '@/lib/catalog/ikas-catalog-fetch-service';
import { NextResponse } from 'next/server';

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}

function n(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview') {
    return json({ ok: false, mutationPerformed: false, error: 'NOT_FOUND' }, 404);
  }

  const identities = await listActiveIkasCatalogIdentities();
  if (identities.length !== 1) {
    return json({
      ok: false,
      mutationPerformed: false,
      activeTypedCatalogIdentityCount: identities.length,
      error: 'EVIDENCE_IDENTITY_CARDINALITY_INVALID',
    }, 409);
  }

  const identity = identities[0];

  const contracts = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT
      fc.catalog_sync_run_id::text AS fetch_run_id,
      r.status AS run_status,
      r.sync_mode,
      r.items_seen,
      r.error_count AS run_error_count,
      r.finished_at,
      r.metadata->>'run_type' AS run_type,
      r.metadata->>'outcome' AS outcome,
      r.metadata->>'queued_count' AS queued_count,
      r.metadata->>'pages_fetched' AS pages_fetched,
      r.metadata->>'upstream_count' AS upstream_count,
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
      (fc.source_observed_at = r.finished_at) AS source_observed_matches_finished_at
    FROM public.catalog_fetch_run_contracts fc
    JOIN public.catalog_sync_runs r ON r.id = fc.catalog_sync_run_id
    WHERE fc.tenant_id = CAST(${identity.tenantId} AS uuid)
      AND fc.catalog_source_id = CAST(${identity.catalogSourceId} AS uuid)
      AND fc.adapter_mode <> 'qa_fixture'
    ORDER BY r.finished_at DESC NULLS LAST
  `;

  const contract = contracts[0] ?? null;
  if (!contract) {
    return json({
      ok: true,
      mutationPerformed: false,
      productionContractCount: 0,
      evidenceFound: false,
      error: null,
    });
  }

  const runId = String(contract.fetch_run_id);

  const rawRows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT
      COUNT(*)::int AS total_count,
      COUNT(*) FILTER (WHERE processed_at IS NOT NULL)::int AS processed_count,
      COUNT(*) FILTER (WHERE normalized_json IS NOT NULL)::int AS normalized_count,
      COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(error_text, '')), '') IS NOT NULL)::int AS error_count,
      COUNT(*) FILTER (WHERE processed_status = 'pending')::int AS pending_count,
      COUNT(*) FILTER (WHERE processed_status = 'processed')::int AS processed_status_count,
      COUNT(*) FILTER (WHERE processed_status = 'failed')::int AS failed_status_count
    FROM public.catalog_sync_raw_items
    WHERE tenant_id = CAST(${identity.tenantId} AS uuid)
      AND catalog_source_id = CAST(${identity.catalogSourceId} AS uuid)
      AND catalog_sync_run_id = CAST(${runId} AS uuid)
  `;

  const importRuns = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT DISTINCT
      ir.id::text AS id,
      ir.status,
      ir.sync_mode,
      ir.items_seen,
      ir.items_created,
      ir.items_updated,
      ir.items_deactivated,
      ir.error_count,
      ir.metadata->>'run_type' AS run_type,
      ir.metadata->>'worker' AS worker,
      ir.metadata->>'upstream_fetch_sync_run_id' AS upstream_fetch_sync_run_id,
      ir.started_at
    FROM public.catalog_sync_raw_items cri
    JOIN public.catalog_sync_runs ir
      ON ir.id = cri.processed_by_sync_run_id
    WHERE cri.tenant_id = CAST(${identity.tenantId} AS uuid)
      AND cri.catalog_source_id = CAST(${identity.catalogSourceId} AS uuid)
      AND cri.catalog_sync_run_id = CAST(${runId} AS uuid)
      AND cri.processed_by_sync_run_id IS NOT NULL
    ORDER BY ir.started_at, ir.id::text
  `;

  const raw = rawRows[0] ?? {};
  const itemsSeen = n(contract.items_seen);
  const rawTotal = n(raw.total_count);
  const rawProcessed = n(raw.processed_count);
  const rawErrors = n(raw.error_count);

  const assertions = {
    exactlyOneProductionContract: contracts.length === 1,
    fetchRunSuccess: contract.run_status === 'success',
    fullSyncMode: contract.sync_mode === 'full',
    typedContractVersion: contract.contract_version === 'e2_fetch_v1',
    authorityContractVersion: contract.authority_contract_version === 'e2_source_authority_v1',
    fullSnapshot: contract.fetch_semantics === 'full_snapshot',
    completionComplete: contract.completion_state === 'complete',
    traversalComplete: contract.traversal_complete === true,
    productCollectionComplete: contract.product_collection_complete === true,
    variantCollectionComplete: contract.variant_collection_complete === true,
    fetchCompletedAtAuthority: contract.authority_basis === 'fetch_completed_at',
    sourceObservedMatchesFinishedAt: contract.source_observed_matches_finished_at === true,
    rawQueueCountMatchesFetch: rawTotal === itemsSeen,
    rawQueueHasNoErrors: rawErrors === 0,
    rawQueueFullyProcessed: rawTotal > 0 && rawProcessed === rawTotal,
    importRunObserved: importRuns.length > 0,
  };

  return json({
    ok: true,
    mutationPerformed: false,
    fetchedAt: new Date().toISOString(),
    productionContractCount: contracts.length,
    evidenceFound: true,
    fetchRun: {
      id: runId,
      status: contract.run_status,
      syncMode: contract.sync_mode,
      itemsSeen,
      errorCount: n(contract.run_error_count),
      runType: contract.run_type,
      outcome: contract.outcome,
      queuedCount: n(contract.queued_count),
      pagesFetched: n(contract.pages_fetched),
      upstreamCount: n(contract.upstream_count),
    },
    fetchContract: {
      contractVersion: contract.contract_version,
      adapterMode: contract.adapter_mode,
      fetchSemantics: contract.fetch_semantics,
      completionState: contract.completion_state,
      traversalComplete: contract.traversal_complete,
      productCollectionComplete: contract.product_collection_complete,
      variantCollectionComplete: contract.variant_collection_complete,
      productReconciliationState: contract.product_reconciliation_state,
      variantReconciliationState: contract.variant_reconciliation_state,
      authorityContractVersion: contract.authority_contract_version,
      authorityBasis: contract.authority_basis,
      authorityOrder: contract.authority_order,
      sourceObservedMatchesFinishedAt: contract.source_observed_matches_finished_at,
    },
    rawQueue: {
      totalCount: rawTotal,
      processedCount: rawProcessed,
      normalizedCount: n(raw.normalized_count),
      errorCount: rawErrors,
      pendingCount: n(raw.pending_count),
      processedStatusCount: n(raw.processed_status_count),
      failedStatusCount: n(raw.failed_status_count),
    },
    importRuns,
    assertions,
    allAssertionsPass: Object.values(assertions).every(Boolean),
    error: null,
  });
}
