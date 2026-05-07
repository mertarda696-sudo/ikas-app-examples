import {
  listActiveIkasOrderSyncIdentities,
  syncIkasOrdersForIdentity,
} from '@/lib/apparel-panel/ikas-order-sync-core';
import { NextRequest, NextResponse } from 'next/server';

function isAuthorized(request: NextRequest) {
  const expected = process.env.ORDER_SYNC_SECRET || '';
  const supplied =
    request.headers.get('x-order-sync-secret') ||
    request.nextUrl.searchParams.get('secret') ||
    '';

  return Boolean(expected) && supplied === expected;
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        fetchedAt: new Date().toISOString(),
        tokenCount: 0,
        results: [],
        error: 'Unauthorized',
      },
      { status: 401 },
    );
  }

  try {
    const identities = await listActiveIkasOrderSyncIdentities();
    const results = [];

    for (const identity of identities) {
      results.push(await syncIkasOrdersForIdentity(identity));
    }

    return NextResponse.json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      tokenCount: identities.length,
      results,
      error: null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        fetchedAt: new Date().toISOString(),
        tokenCount: 0,
        results: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
