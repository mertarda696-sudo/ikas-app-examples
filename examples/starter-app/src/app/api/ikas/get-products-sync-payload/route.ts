import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { config } from '@/globals/config';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          itemCount: 0,
          items: [],
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
          itemCount: 0,
          items: [],
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
          itemCount: 0,
          items: [],
          error: 'Graph API URL not configured',
        },
        { status: 500 },
      );
    }

    const query = `
      query ProductsSyncPayload {
        listProduct {
          data {
            id
            name
            createdAt
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
          itemCount: 0,
          items: [],
          error:
            raw?.errors?.[0]?.message ||
            'Graph API request failed with status ' + upstreamResponse.status,
        },
        { status: upstreamResponse.ok ? 500 : upstreamResponse.status },
      );
    }

    const items = Array.isArray(raw?.data?.listProduct?.data)
      ? raw.data.listProduct.data.slice(0, 5).map((item: any) => ({
          externalProductId: item?.id ?? '',
          title: item?.name ?? '-',
          createdAt: item?.createdAt != null ? String(item.createdAt) : null,
          itemType: 'product',
        }))
      : [];

    return NextResponse.json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      itemCount: items.length,
      items,
      error: undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        fetchedAt: new Date().toISOString(),
        itemCount: 0,
        items: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
