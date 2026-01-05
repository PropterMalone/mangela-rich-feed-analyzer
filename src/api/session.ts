/**
 * Session extraction from Bluesky's localStorage
 * Reused pattern from ErgoBlock
 */

import type { BskySession, BskyAccount, BskyStorageStructure } from './types.js';

const BSKY_PDS_DEFAULT = 'https://bsky.social';

/**
 * Helper to safely access localStorage
 */
function getLocalStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

/**
 * Get the current session from Bluesky's localStorage
 */
export function getSession(): BskySession | null {
  try {
    const localStorageProxy = getLocalStorage();
    if (!localStorageProxy) return null;

    // Find all possible BSKY storage keys
    const possibleKeys: string[] = [];
    for (let i = 0; i < localStorageProxy.length; i++) {
      const key = localStorageProxy.key(i);
      if (key && (key.includes('BSKY') || key.includes('bsky') || key.includes('session'))) {
        possibleKeys.push(key);
      }
    }

    console.log('[Universe] Found storage keys:', possibleKeys);

    for (const storageKey of possibleKeys) {
      try {
        const raw = localStorageProxy.getItem(storageKey);
        if (!raw) continue;

        const parsed = JSON.parse(raw) as BskyStorageStructure;
        console.log('[Universe] Checking storage key:', storageKey);

        let account: BskyAccount | null = null;

        // Structure 1: { session: { currentAccount: {...}, accounts: [...] } }
        if (parsed?.session?.currentAccount) {
          const currentDid = parsed.session.currentAccount.did;
          account = parsed.session.accounts?.find((a) => a.did === currentDid) || null;
        }

        // Structure 2: { currentAccount: {...}, accounts: [...] }
        if (!account && parsed?.currentAccount) {
          const currentDid = parsed.currentAccount.did;
          account = parsed.accounts?.find((a) => a.did === currentDid) || null;
        }

        // Structure 3: Direct account object
        if (!account && parsed?.accessJwt && parsed?.did) {
          account = parsed as unknown as BskyAccount;
        }

        if (account && account.accessJwt && account.did) {
          console.log('[Universe] Found session for:', account.handle || account.did);

          // Normalize the PDS URL
          let pdsUrl = account.pdsUrl || account.service || BSKY_PDS_DEFAULT;
          pdsUrl = pdsUrl.replace(/\/+$/, '');
          if (!pdsUrl.startsWith('http://') && !pdsUrl.startsWith('https://')) {
            pdsUrl = 'https://' + pdsUrl;
          }

          return {
            accessJwt: account.accessJwt,
            refreshJwt: account.refreshJwt,
            did: account.did,
            handle: account.handle || '',
            pdsUrl,
          };
        }
      } catch {
        // Continue to next key
      }
    }

    console.error('[Universe] No valid session found in localStorage');
    return null;
  } catch (e) {
    console.error('[Universe] Failed to get session:', e);
    return null;
  }
}

/**
 * Check if we have a valid session
 */
export function hasSession(): boolean {
  return getSession() !== null;
}

/**
 * Get the current user's DID
 */
export function getCurrentDid(): string | null {
  const session = getSession();
  return session?.did ?? null;
}

/**
 * Get the current user's handle
 */
export function getCurrentHandle(): string | null {
  const session = getSession();
  return session?.handle ?? null;
}
