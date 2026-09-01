import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth-helpers';
import {
  IKAS_CATALOG_SCHEMA_AUDIT_VERSION,
  runIkasCatalogSchemaAudit,
} from '@/lib/catalog/ikas-catalog-schema-audit';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        fetchedAt: new Date().toISOString(),
        auditVersion: IKAS_CATALOG_SCHEMA_AUDIT_VERSION,
        mutationPerformed: false,
        credentialMutationPerformed: false,
        error: 'Unauthorized',
      },
      { status: 401 },
    );
  }

  const execution = await runIkasCatalogSchemaAudit({
    merchantId: user.merchantId,
    authorizedAppId: user.authorizedAppId,
  });

  return NextResponse.json(execution.body, {
    status: execution.status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
