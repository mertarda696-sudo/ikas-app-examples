import { OAuthAPI } from '@ikas/admin-api-client';
import moment from 'moment';
import { AuthToken } from '../models/auth-token';
import { AuthTokenManager } from '../models/auth-token/manager';
import { ikasAdminGraphQLAPIClient } from '../lib/ikas-client/generated/graphql';
import { config } from '../globals/config';

/**
 * Refresh IKAS OAuth tokens before their actual expiry so that
 * a token does not expire while an upstream request is in flight.
 *
 * This value is the single owner of the refresh lead-time contract.
 */
export const IKAS_OAUTH_REFRESH_LEEWAY_MS = 60_000;

/**
 * Determines whether an IKAS OAuth token should be refreshed.
 *
 * Missing or invalid expiration evidence is treated fail-safe:
 * the token is considered refresh-due.
 */
export function isIkasTokenRefreshDue(
  token?: Pick<AuthToken, 'expireDate'>,
  nowMs: number = Date.now(),
): boolean {
  if (!token?.expireDate) {
    return true;
  }

  const expireTime = new Date(token.expireDate).getTime();

  if (!Number.isFinite(expireTime)) {
    return true;
  }

  return (
    expireTime <=
    nowMs + IKAS_OAUTH_REFRESH_LEEWAY_MS
  );
}

/**
 * Returns a new instance of the ikasAdminGraphQLAPIClient
 * with the provided token.
 *
 * @param token AuthToken object containing access and refresh tokens.
 */
export function getIkas(
  token: AuthToken,
): ikasAdminGraphQLAPIClient<AuthToken> {
  return new ikasAdminGraphQLAPIClient<AuthToken>({
    graphApiUrl: config.graphApiUrl!,
    accessToken: token.accessToken,
    tokenData: token,
    onCheckToken: () => onCheckToken(token),
  });
}

/**
 * Checks whether the provided token is inside the configured
 * refresh lead-time window and refreshes it when necessary.
 *
 * Existing return semantics are intentionally preserved:
 * - refreshed token => returns refreshed accessToken
 * - still-valid token => returns undefined accessToken
 * - missing token / refresh failure => returns undefined accessToken
 *
 * @param token AuthToken object to check and refresh.
 */
export async function onCheckToken(
  token?: AuthToken,
): Promise<{
  accessToken: string | undefined;
  tokenData?: AuthToken;
}> {
  try {
    if (!token) {
      return {
        accessToken: undefined,
      };
    }

    if (!isIkasTokenRefreshDue(token)) {
      return {
        accessToken: undefined,
        tokenData: token,
      };
    }

    const response = await OAuthAPI.refreshToken(
      {
        refresh_token: token.refreshToken,
        client_id: process.env.NEXT_PUBLIC_CLIENT_ID!,
        client_secret: process.env.CLIENT_SECRET!,
      },
      {
        storeName: 'api',
      },
    );

    if (!response.data) {
      return {
        accessToken: undefined,
        tokenData: token,
      };
    }

    const newExpireDate = moment()
      .add(response.data.expires_in, 'seconds')
      .toDate()
      .toISOString();

    token.accessToken = response.data.access_token;
    token.refreshToken = response.data.refresh_token;
    token.tokenType = response.data.token_type;
    token.expiresIn = response.data.expires_in;
    token.expireDate = newExpireDate;

    await AuthTokenManager.put(token);

    return {
      accessToken: token.accessToken,
      tokenData: token,
    };
  } catch (error) {
    console.error(
      'Failed to check or refresh token:',
      error,
    );

    return {
      accessToken: undefined,
      tokenData: token,
    };
  }
}

/**
 * Generates the appropriate OAuth redirect URI
 * for the current environment.
 *
 * Handles localhost development vs production deployment scenarios.
 *
 * @param host - The current request host header
 * @returns The correct redirect URI for OAuth callback
 */
export const getRedirectUri = (host: string) => {
  if (
    config.oauth.redirectUri.includes('localhost') &&
    !host.includes('localhost')
  ) {
    const redirectUri = new URL(
      config.oauth.redirectUri,
    );

    redirectUri.host = host;
    redirectUri.protocol = 'https';
    redirectUri.port = '443';

    return redirectUri.toString();
  }

  return config.oauth.redirectUri;
};
