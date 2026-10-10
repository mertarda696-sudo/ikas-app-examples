export type CommerceCandidateIdentity = {
  identifierType: string;
  identifierValue: string;
};

export type CommerceCandidateRow = {
  tenant_id: string;
  external_commerce_account_id: string;
  binding_id: string;
  catalog_source_id: string;
  identifier_type: string;
  identifier_value: string;
};

export type CommerceCandidateSelection<T extends CommerceCandidateRow = CommerceCandidateRow> =
  | { status: 'matched'; row: T; matchedIdentifierTypes: string[] }
  | { status: 'not_found' | 'ambiguous' };

export function selectExactCommerceSourceCandidate<T extends CommerceCandidateRow>(
  rows: T[],
  identities: CommerceCandidateIdentity[],
): CommerceCandidateSelection<T>;
