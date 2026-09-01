import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export type CommerceIdentityInput = {
  identifierType: string;
  identifierValue: string | null | undefined;
};

export type CatalogSourceResolution = {
  tenantId: string;
  catalogSourceId: string;
  sourceName: string;
  sourceType: string | null;
  sourceConfig: Record<string, unknown> | null;

  externalCommerceAccountId: string;
  providerKey: string;

  bindingId: string;
  bindingRole: string;

  matchedIdentifierTypes: string[];
};

type ResolverRow = {
  tenant_id: string;

  catalog_source_id: string;
  source_name: string;
  source_type: string | null;
  config_json: Record<string, unknown> | null;

  external_commerce_account_id: string;
  provider_key: string;

  binding_id: string;
  binding_role: string;

  identifier_type: string;
  identifier_value: string;
};

export type CommerceSourceResolutionErrorCode =
  | 'COMMERCE_IDENTITY_REQUIRED'
  | 'COMMERCE_SOURCE_NOT_FOUND'
  | 'COMMERCE_SOURCE_AMBIGUOUS';

export class CommerceSourceResolutionError extends Error {
  readonly code: CommerceSourceResolutionErrorCode;

  constructor(
    code: CommerceSourceResolutionErrorCode,
    message: string,
  ) {
    super(message);

    this.name = 'CommerceSourceResolutionError';
    this.code = code;
  }
}

function normalizeRequiredText(
  value: string | null | undefined,
): string | null {
  const normalized = String(value ?? '').trim();

  return normalized || null;
}

function normalizeIdentities(
  identities: CommerceIdentityInput[],
): Array<{
  identifierType: string;
  identifierValue: string;
  identityKey: string;
}> {
  const unique = new Map<
    string,
    {
      identifierType: string;
      identifierValue: string;
      identityKey: string;
    }
  >();

  for (const identity of identities) {
    const identifierType =
      normalizeRequiredText(identity.identifierType);

    const identifierValue =
      normalizeRequiredText(identity.identifierValue);

    if (!identifierType || !identifierValue) {
      continue;
    }

    const identityKey =
      `${identifierType}\u0000${identifierValue}`;

    unique.set(identityKey, {
      identifierType,
      identifierValue,
      identityKey,
    });
  }

  return Array.from(unique.values());
}

export async function resolveCatalogSourceByCommerceIdentity(input: {
  providerKey: string;
  bindingRole: string;
  identities: CommerceIdentityInput[];
}): Promise<CatalogSourceResolution> {
  const providerKey = normalizeRequiredText(input.providerKey);
  const bindingRole = normalizeRequiredText(input.bindingRole);

  const identities = normalizeIdentities(input.identities);

  if (!providerKey || !bindingRole || identities.length === 0) {
    throw new CommerceSourceResolutionError(
      'COMMERCE_IDENTITY_REQUIRED',
      'Commerce provider, binding role and at least one external identity are required.',
    );
  }

  const identityPredicates = identities.map((identity) =>
    Prisma.sql`
      (
        i.identifier_type = ${identity.identifierType}
        AND i.identifier_value = ${identity.identifierValue}
      )
    `,
  );

  const rows = await prisma.$queryRaw<ResolverRow[]>(
    Prisma.sql`
      SELECT
        a.tenant_id,

        s.id AS catalog_source_id,
        s.source_name,
        s.source_type,
        s.config_json,

        a.id AS external_commerce_account_id,
        a.provider_key,

        b.id AS binding_id,
        b.binding_role,

        i.identifier_type,
        i.identifier_value

      FROM public.external_commerce_account_identifiers i

      JOIN public.external_commerce_accounts a
        ON a.id = i.external_commerce_account_id
       AND a.tenant_id = i.tenant_id

      JOIN public.catalog_source_account_bindings b
        ON b.external_commerce_account_id = a.id
       AND b.tenant_id = a.tenant_id

      JOIN public.catalog_sources s
        ON s.id = b.catalog_source_id
       AND s.tenant_id = b.tenant_id

      WHERE i.provider_key = ${providerKey}
        AND a.provider_key = ${providerKey}

        AND i.is_active IS TRUE
        AND i.retired_at IS NULL

        AND a.connection_status = 'active'

        AND b.binding_role = ${bindingRole}
        AND b.is_active IS TRUE
        AND b.retired_at IS NULL

        AND s.is_active IS TRUE

        AND (
          ${Prisma.join(identityPredicates, ' OR ')}
        )

      ORDER BY
        a.tenant_id,
        a.id,
        b.id,
        s.id,
        i.identifier_type,
        i.identifier_value
    `,
  );

  /*
   * A candidate is not valid merely because one supplied identifier
   * matched it.
   *
   * Every supplied identity must resolve to the SAME:
   *   account + binding + catalog source.
   *
   * This prevents split-identity fallback and cross-tenant ambiguity.
   */
  const expectedIdentityKeys = new Set(
    identities.map((identity) => identity.identityKey),
  );

  const candidates = new Map<
    string,
    {
      row: ResolverRow;
      matchedIdentityKeys: Set<string>;
    }
  >();

  for (const row of rows) {
    const candidateKey = [
      row.tenant_id,
      row.external_commerce_account_id,
      row.binding_id,
      row.catalog_source_id,
    ].join(':');

    const existing = candidates.get(candidateKey);

    const candidate =
      existing ?? {
        row,
        matchedIdentityKeys: new Set<string>(),
      };

    candidate.matchedIdentityKeys.add(
      `${row.identifier_type}\u0000${row.identifier_value}`,
    );

    candidates.set(candidateKey, candidate);
  }

  const exactCandidates = Array.from(
    candidates.values(),
  ).filter((candidate) => {
    for (const identityKey of expectedIdentityKeys) {
      if (!candidate.matchedIdentityKeys.has(identityKey)) {
        return false;
      }
    }

    return true;
  });

  if (exactCandidates.length === 0) {
    throw new CommerceSourceResolutionError(
      'COMMERCE_SOURCE_NOT_FOUND',
      'No active catalog source matches the supplied external commerce identity contract.',
    );
  }

  if (exactCandidates.length > 1) {
    throw new CommerceSourceResolutionError(
      'COMMERCE_SOURCE_AMBIGUOUS',
      'Multiple active catalog sources match the same external commerce identity contract.',
    );
  }

  const candidate = exactCandidates[0];
  const row = candidate.row;

  return {
    tenantId: row.tenant_id,

    catalogSourceId: row.catalog_source_id,
    sourceName: row.source_name,
    sourceType: row.source_type,
    sourceConfig: row.config_json,

    externalCommerceAccountId:
      row.external_commerce_account_id,

    providerKey: row.provider_key,

    bindingId: row.binding_id,
    bindingRole: row.binding_role,

    matchedIdentifierTypes: Array.from(
      new Set(
        identities.map(
          (identity) => identity.identifierType,
        ),
      ),
    ).sort(),
  };
}
