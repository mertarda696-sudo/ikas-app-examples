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

export type CommerceCandidateSelection =
  | { status: 'matched'; row: CommerceCandidateRow; matchedIdentifierTypes: string[] }
  | { status: 'not_found' | 'ambiguous' };

export function selectExactCommerceSourceCandidate(
  rows: CommerceCandidateRow[],
  identities: CommerceCandidateIdentity[],
): CommerceCandidateSelection;
