import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { config } from '@/globals/config';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

type SourceRow = {
  id: string;
  tenant_id: string;
  source_name: string;
};

const IKAS_SOURCE_NAME = 'MIRELLE IKAS App Catalog';

function slugify(value: string | null | undefined) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          runId: null,
          sourceName: null,
          queuedCount: 0,
          queuedExternalProductIds: [],
          error: 'Unauthorized',
        },
        { status: 401 },
      );
    }

    const authToken = await AuthTokenManager.get(user.authorizedAppId);

    if (!authToken?.accessToken) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          runId: null,
          sourceName: null,
          queuedCount: 0,
          queuedExternalProductIds: [],
          error: 'Auth token not found',
        },
        { status: 404 },
      );
    }

    if (!config.graphApiUrl) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          runId: null,
          sourceName: null,
          queuedCount: 0,
          queuedExternalProductIds: [],
          error: 'Graph API URL not configured',
        },
        { status: 500 },
      );
    }

    const sourceRows = await prisma.$queryRaw<SourceRow[]>`
      select id, tenant_id, source_name
      from public.catalog_sources
      where source_name = ${IKAS_SOURCE_NAME}
        and is_active = true
      order by created_at desc
      limit 1
    `;

    const source = sourceRows[0];

    if (!source) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          runId: null,
          sourceName: IKAS_SOURCE_NAME,
          queuedCount: 0,
          queuedExternalProductIds: [],
          error: 'IKAS catalog source not found',
        },
        { status: 404 },
      );
    }

    const query = `
      query SyncProductsToQueue {
        listProduct {
          data {
            id
            name
            createdAt
            shortDescription
            description
            totalStock
            brand {
              name
            }
            categories {
              name
            }
          }
        }
      }
    `;

    const upstreamResponse = await fetch(config.graphApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + authToken.accessToken,
      },
      body: JSON.stringify({ query }),
      cache: 'no-store',
    });

    const raw = await upstreamResponse.json();

    if (!upstreamResponse.ok || raw?.errors) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          runId: null,
          sourceName: source.source_name,
          queuedCount: 0,
          queuedExternalProductIds: [],
          error:
            raw?.errors?.[0]?.message ||
            'Graph API request failed with status ' + upstreamResponse.status,
        },
        { status: upstreamResponse.ok ? 500 : upstreamResponse.status },
      );
    }

    const fetchedItems = Array.isArray(raw?.data?.listProduct?.data)
      ? raw.data.listProduct.data.slice(0, 5)
      : [];

    const payloadItems = fetchedItems.map((item: any) => {
      const firstCategoryName =
        Array.isArray(item?.categories) && item.categories.length
          ? item.categories[0]?.name || null
          : null;

      const normalizedSubcategory = slugify(firstCategoryName) || null;

      return {
        id: item?.id ?? '',
        brand: item?.brand?.name ?? 'MIRELLE STUDIO',
        title: item?.name ?? '-',
        handle: slugify(item?.name) || item?.id || '',
        category: 'giyim',
        currency: 'TRY',
        variants: [],
        is_active: true,
        attributes: {
          source_platform: 'ikas',
          sync_origin: 'ikas_app',
          merchant_id: user.merchantId,
          store_name: 'mirellestudio',
          original_category_name: firstCategoryName,
        },
        base_price: 0,
        description: item?.description ?? null,
        subcategory: normalizedSubcategory,
        stock_status:
          typeof item?.totalStock === 'number' && item.totalStock > 0
            ? 'in_stock'
            : 'out_of_stock',
        short_description: item?.shortDescription ?? null,
        external_product_id: item?.id ?? '',
        created_at_source:
          item?.createdAt != null ? String(item.createdAt) : null,
      };
    });

    if (!payloadItems.length) {
      return NextResponse.json({
        ok: true,
        fetchedAt: new Date().toISOString(),
        runId: null,
        sourceName: source.source_name,
        queuedCount: 0,
        queuedExternalProductIds: [],
        error: undefined,
      });
    }

    const transactionResult = await prisma.$transaction(async (tx) => {
      const runRows = await tx.$queryRaw<{ id: string }[]>`
        insert into public.catalog_sync_runs (
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
        values (
          CAST(${source.tenant_id} AS uuid),
          CAST(${source.id} AS uuid),
          'manual',
          'success',
          now(),
          now(),
          ${payloadItems.length},
          0,
          0,
          0,
          0,
          'IKAS app queue write pilot',
          jsonb_build_object(
            'trigger', 'ikas_app_queue_pilot',
            'source_name', ${source.source_name},
            'merchant_id', ${user.merchantId},
            'queued_count', ${payloadItems.length}
          )
        )
        returning id
      `;

      const runId = runRows[0]?.id;

      if (!runId) {
        throw new Error('Failed to create catalog sync run');
      }

      for (const item of payloadItems) {
        await tx.$executeRaw`
          insert into public.catalog_sync_raw_items (
            tenant_id,
            catalog_source_id,
            catalog_sync_run_id,
            external_product_id,
            item_type,
            processed_status,
            payload_json
          )
          values (
            CAST(${source.tenant_id} AS uuid),
            CAST(${source.id} AS uuid),
            CAST(${runId} AS uuid),
            ${item.id},
            'product',
            'pending',
            CAST(${JSON.stringify(item)} AS jsonb)
          )
        `;
      }

      return {
        runId,
      };
    });

   return NextResponse.json({
  ok: true,
  fetchedAt: new Date().toISOString(),
  runId: transactionResult.runId,
  sourceName: source.source_name,
  queuedCount: payloadItems.length,
  queuedExternalProductIds: payloadItems.map((item: { id: string }) => item.id),
  error: undefined,
});
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        fetchedAt: new Date().toISOString(),
        runId: null,
        sourceName: IKAS_SOURCE_NAME,
        queuedCount: 0,
        queuedExternalProductIds: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
