import { AppBridgeHelper } from '@ikas/app-helpers';
import { useRouter } from 'next/navigation';
import crypto from 'crypto';

/** Key used for storing tokens in session storage */
const TOKEN_KEY = 'token';

/**
 * Utility class for managing authentication tokens in ikas applications.
 * 
 * This class provides methods for:
 * - Retrieving tokens from iFrame context using AppBridge
 * - Managing token storage and expiration
 * - Handling OAuth callback token processing
 * - Token validation and session management
 */
export class TokenHelpers {
  private static pendingIframeToken: Promise<string | null> | null = null;

  private static readIframeTokenIdentity(token: string): string | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3 || parts.some((part) => !part)) return null;

      const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=');
      const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
      const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));
      if (!claims || typeof claims !== 'object' || Array.isArray(claims)) return null;

      const payload = claims as Record<string, unknown>;
      if (
        typeof payload.aud !== 'string' || !payload.aud.trim() ||
        typeof payload.sub !== 'string' || !payload.sub.trim() ||
        typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) ||
        payload.exp * 1000 <= Date.now()
      ) return null;

      // These are client-side shape checks only. Backend routes verify the signature.
      return payload.aud;
    } catch {
      return null;
    }
  }

  private static requestIframeToken = async (): Promise<string | null> => {
    try {
      const token = await AppBridgeHelper.getNewToken();
      if (!token) return null;

      const authorizedAppId = TokenHelpers.readIframeTokenIdentity(token);
      if (!authorizedAppId) {
        console.error('AppBridge returned an invalid or expired iframe token.');
        return null;
      }

      // Establish identity from the current bridge response, never another stored session.
      // Storage is an optional cache and must not prevent valid iframe authentication.
      try {
        sessionStorage.setItem(`${TOKEN_KEY}-${authorizedAppId}`, token);
        sessionStorage.setItem('authorizedAppId', authorizedAppId);
      } catch {
        // Browser storage may be unavailable in an embedded context.
      }

      return token;
    } catch (error) {
      console.error(
        'Error retrieving token from AppBridge:',
        error === 'Timed out getNewToken' ? 'Timed out getNewToken' : 'Token request failed',
      );
      return null;
    }
  };

  /**
   * Retrieves an authentication token for applications running within ikas dashboard iFrame.
   * 
   * This method handles token retrieval through the ikas AppBridge when the application
   * is embedded within the ikas dashboard. Concurrent consumers share one request.
   * The current token's audience identifies its installation for scoped storage;
   * authentication does not depend on a separate authorized-app-ID bridge response.
   * 
   * @returns {Promise<string | null>} A promise that resolves to:
   *   - A valid JWT token string if successfully retrieved
   *   - null if the app is not in an iFrame context or token retrieval fails
   * 
   * @remarks
   * - Outside an iframe, returns null without sending a bridge request.
   * - Never uses a stored token to infer the current merchant's identity.
   * - Decoding checks shape/expiration; backend signature verification is unchanged.
   */
  static getTokenForIframeApp = (): Promise<string | null> => {
    if (typeof window === 'undefined' || window.self === window.top) {
      return Promise.resolve(null);
    }

    if (!TokenHelpers.pendingIframeToken) {
      TokenHelpers.pendingIframeToken = TokenHelpers.requestIframeToken().finally(() => {
        TokenHelpers.pendingIframeToken = null;
      });
    }

    return TokenHelpers.pendingIframeToken;
  };

  /**
   * Processes OAuth callback parameters and handles token storage and redirection.
   * 
   * This method is typically called after an OAuth authorization flow completes.
   * It extracts the token from URL parameters, stores it in session storage,
   * and redirects the user to the specified redirect URL. If the required
   * parameters are missing, it redirects to the authorization page.
   * 
   * @param {ReturnType<typeof useRouter>} router - Next.js router instance for navigation
   * @param {URLSearchParams} params - URL search parameters containing OAuth callback data
   * 
   * @throws {string} Throws 'redirectUrl-called' after successful redirect to indicate flow completion
   * 
   * @remarks
   * - Expects 'token', 'redirectUrl', and 'authorizedAppId' parameters in the URL
   * - Stores both the token and authorized app ID in session storage
   * - Uses window.location.replace() for immediate redirection without history entry
   * - Falls back to authorization page if required parameters are missing
   */
  static setToken = async (
    router: ReturnType<typeof useRouter>, 
    params: URLSearchParams
  ): Promise<void> => {
    // Check if all required OAuth callback parameters are present
    const hasRequiredParams = params.has('token') && 
                             params.has('redirectUrl') && 
                             params.has('authorizedAppId');
    
    if (hasRequiredParams) {
      // Extract OAuth callback parameters
      const token = params.get('token')!;
      const authorizedAppId = params.get('authorizedAppId')!;
      const redirectUrl = params.get('redirectUrl')!;
      
      // Store token with app-specific key for future retrieval
      sessionStorage.setItem(`${TOKEN_KEY}-${authorizedAppId}`, token);
      
      // Store authorized app ID separately for reference
      sessionStorage.setItem('authorizedAppId', authorizedAppId);
      
      // Redirect to the specified URL (typically back to the app)
      window.location.replace(redirectUrl);
      
      // Throw to indicate successful redirect (prevents further execution)
      throw 'redirectUrl-called';
    }
    
    // Missing required parameters - redirect to authorization page
    await router.push('/authorize-store');
  };

  /**
   * Validates a code signature using HMAC-SHA256.
   *
   * This method is used to verify the authenticity of OAuth authorization codes
   * by comparing a received signature with an expected signature computed using
   * the client secret. This provides an additional layer of security to ensure
   * the code has not been tampered with.
   *
   * @param {string} code - The authorization code to validate
   * @param {string} receivedSignature - The signature received with the code
   * @param {string} secret - The client secret used to generate the expected signature
   *
   * @returns {boolean} True if the signatures match, false otherwise
   *
   * @remarks
   * - Uses HMAC-SHA256 algorithm for signature generation
   * - Compares signatures using strict equality
   * - Should be called before exchanging authorization code for tokens
   */
  static validateCodeSignature = (code: string, receivedSignature: string, secret: string): boolean => {
    const expectedSignature = crypto.createHmac('sha256', secret).update(code, 'utf8').digest('hex');
    return expectedSignature === receivedSignature;
  };
}
