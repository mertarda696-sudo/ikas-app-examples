export function selectExactCommerceSourceCandidate(rows, identities) {
  const expectedIdentityKeys = new Set(
    identities
      .map((identity) => {
        const type = String(identity.identifierType ?? '').trim();
        const value = String(identity.identifierValue ?? '').trim();
        return type && value ? type + '\u0000' + value : '';
      })
      .filter(Boolean),
  );

  if (!expectedIdentityKeys.size) return { status: 'not_found' };

  const candidates = new Map();

  for (const row of rows) {
    const candidateKey = [
      row.tenant_id,
      row.external_commerce_account_id,
      row.binding_id,
      row.catalog_source_id,
    ].join(':');
    const candidate = candidates.get(candidateKey) ?? {
      row,
      matchedIdentityKeys: new Set(),
    };

    candidate.matchedIdentityKeys.add(
      String(row.identifier_type ?? '').trim() +
        '\u0000' +
        String(row.identifier_value ?? '').trim(),
    );
    candidates.set(candidateKey, candidate);
  }

  const exactCandidates = Array.from(candidates.values()).filter((candidate) =>
    Array.from(expectedIdentityKeys).every((identityKey) =>
      candidate.matchedIdentityKeys.has(identityKey),
    ),
  );

  if (exactCandidates.length === 0) return { status: 'not_found' };
  if (exactCandidates.length > 1) return { status: 'ambiguous' };

  return {
    status: 'matched',
    row: exactCandidates[0].row,
    matchedIdentifierTypes: Array.from(
      new Set(identities.map((identity) => String(identity.identifierType).trim()).filter(Boolean)),
    ).sort(),
  };
}
