import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

type FunctionRow = {
  schema_name: string;
  function_name: string;
  definition: string;
};

type ContractBaselineRow = {
  total_contract_count: bigint;
  non_qa_contract_count: bigint;
  provider_sequence_count: bigint;
  provider_observed_at_count: bigint;
  fetch_completed_at_count: bigint;
};

function authorityLines(definition: string) {
  return definition
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) =>
      /(authority_order|authority_basis|source_observed_at|last_truth_fetch_sync_run_id)/i.test(
        line,
      ),
    )
    .filter(Boolean);
}

function bigintCount(value: bigint | null | undefined): number {
  return value == null ? 0 : Number(value);
}

export async function GET() {
  try {
    if (process.env.VERCEL_ENV === 'production') {
      return NextResponse.json(
        {
          ok: false,
          mutationPerformed: false,
          error: 'Not found',
        },
        { status: 404 },
      );
    }

    const functions = await prisma.$queryRaw<FunctionRow[]>`
      select
        n.nspname::text as schema_name,
        p.proname::text as function_name,
        pg_get_functiondef(p.oid)::text as definition
      from pg_proc p
      join pg_namespace n
        on n.oid = p.pronamespace
      where n.nspname = 'private'
        and p.proname in (
          'catalog_apply_seen_source_truth_core_v1',
          'catalog_source_lifecycle_core_v2'
        )
      order by p.proname
    `;

    const baselineRows = await prisma.$queryRaw<ContractBaselineRow[]>`
      select
        count(*)::bigint as total_contract_count,
        count(*) filter (
          where adapter_mode <> 'qa_fixture'
        )::bigint as non_qa_contract_count,
        count(*) filter (
          where authority_basis = 'provider_sequence'
        )::bigint as provider_sequence_count,
        count(*) filter (
          where authority_basis = 'provider_observed_at'
        )::bigint as provider_observed_at_count,
        count(*) filter (
          where authority_basis = 'fetch_completed_at'
        )::bigint as fetch_completed_at_count
      from public.catalog_fetch_run_contracts
    `;

    const baseline = baselineRows[0];

    const consumers = functions.map((row) => ({
      schema: row.schema_name,
      functionName: row.function_name,
      authorityLines: authorityLines(row.definition),
      referencesAuthorityOrder: /authority_order/i.test(row.definition),
      referencesAuthorityBasis: /authority_basis/i.test(row.definition),
      referencesSourceObservedAt: /source_observed_at/i.test(row.definition),
      referencesFetchRunPointer: /last_truth_fetch_sync_run_id/i.test(
        row.definition,
      ),
    }));

    return NextResponse.json(
      {
        ok: true,
        fetchedAt: new Date().toISOString(),
        auditVersion: 'g3_c3_fetch_contract_consumer_audit_v1',
        mutationPerformed: false,
        consumerCount: consumers.length,
        consumers,
        contractBaseline: {
          totalContractCount: bigintCount(
            baseline?.total_contract_count,
          ),
          nonQaContractCount: bigintCount(
            baseline?.non_qa_contract_count,
          ),
          providerSequenceCount: bigintCount(
            baseline?.provider_sequence_count,
          ),
          providerObservedAtCount: bigintCount(
            baseline?.provider_observed_at_count,
          ),
          fetchCompletedAtCount: bigintCount(
            baseline?.fetch_completed_at_count,
          ),
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        mutationPerformed: false,
        error:
          error instanceof Error
            ? error.message
            : 'UNKNOWN_G3_C3_FETCH_CONTRACT_AUDIT_ERROR',
      },
      { status: 500 },
    );
  }
}
