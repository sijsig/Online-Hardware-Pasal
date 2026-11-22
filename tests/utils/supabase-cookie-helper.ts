/**
 * Helper to generate @supabase/ssr compatible cookies from a Supabase session.
 * @supabase/ssr stores the entire session object as a single cookie (or chunked cookies)
 * with the storage key as the cookie name, not separate access/refresh token cookies.
 */

// Base64URL encoding (from @supabase/ssr)
const TO_BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".split("");

function stringToBase64URL(str: string): string {
  const base64: string[] = [];
  let queue = 0;
  let queuedBits = 0;
  const emitter = (byte: number) => {
    queue = (queue << 8) | byte;
    queuedBits += 8;
    while (queuedBits >= 6) {
      const pos = (queue >> (queuedBits - 6)) & 63;
      base64.push(TO_BASE64URL[pos]);
      queuedBits -= 6;
    }
  };
  // Simple UTF-8 encoding
  for (let i = 0; i < str.length; i++) {
    let codepoint = str.charCodeAt(i);
    if (codepoint > 0xd7ff && codepoint <= 0xdbff) {
      const highSurrogate = ((codepoint - 0xd800) * 0x400) & 0xffff;
      const lowSurrogate = (str.charCodeAt(i + 1) - 0xdc00) & 0xffff;
      codepoint = (lowSurrogate | highSurrogate) + 0x10000;
      i += 1;
    }
    if (codepoint <= 0x7f) {
      emitter(codepoint);
    } else if (codepoint <= 0x7ff) {
      emitter(0xc0 | (codepoint >> 6));
      emitter(0x80 | (codepoint & 0x3f));
    } else if (codepoint <= 0xffff) {
      emitter(0xe0 | (codepoint >> 12));
      emitter(0x80 | ((codepoint >> 6) & 0x3f));
      emitter(0x80 | (codepoint & 0x3f));
    } else if (codepoint <= 0x10ffff) {
      emitter(0xf0 | (codepoint >> 18));
      emitter(0x80 | ((codepoint >> 12) & 0x3f));
      emitter(0x80 | ((codepoint >> 6) & 0x3f));
      emitter(0x80 | (codepoint & 0x3f));
    }
  }
  if (queuedBits > 0) {
    queue = queue << (6 - queuedBits);
    queuedBits = 6;
    while (queuedBits >= 6) {
      const pos = (queue >> (queuedBits - 6)) & 63;
      base64.push(TO_BASE64URL[pos]);
      queuedBits -= 6;
    }
  }
  return base64.join("");
}

// Chunking logic (from @supabase/ssr)
const MAX_CHUNK_SIZE = 3180;

function createChunks(key: string, value: string, chunkSize?: number): Array<{ name: string; value: string }> {
  const resolvedChunkSize = chunkSize ?? MAX_CHUNK_SIZE;
  let encodedValue = encodeURIComponent(value);
  if (encodedValue.length <= resolvedChunkSize) {
    return [{ name: key, value }];
  }
  const chunks: string[] = [];
  while (encodedValue.length > 0) {
    let encodedChunkHead = encodedValue.slice(0, resolvedChunkSize);
    const lastEscapePos = encodedChunkHead.lastIndexOf("%");
    if (lastEscapePos > resolvedChunkSize - 3) {
      encodedChunkHead = encodedChunkHead.slice(0, lastEscapePos);
    }
    let valueHead = "";
    while (encodedChunkHead.length > 0) {
      try {
        valueHead = decodeURIComponent(encodedChunkHead);
        break;
      } catch (error) {
        if (error instanceof URIError && encodedChunkHead.at(-3) === "%" && encodedChunkHead.length > 3) {
          encodedChunkHead = encodedChunkHead.slice(0, encodedChunkHead.length - 3);
        } else {
          throw error;
        }
      }
    }
    chunks.push(valueHead);
    encodedValue = encodedValue.slice(encodedChunkHead.length);
  }
  return chunks.map((value, i) => ({ name: `${key}.${i}`, value }));
}

/**
 * Get the Supabase storage key (cookie name prefix)
 * Default: sb-<project-ref>-auth-token
 */
export function getSupabaseStorageKey(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hhavjnfgedskwomdbpsj.supabase.co';
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  const projectRef = match ? match[1] : 'hhavjnfgedskwomdbpsj';
  return `sb-${projectRef}-auth-token`;
}

/**
 * Convert a Supabase session to the format expected by @supabase/ssr
 * and generate cookie objects for Playwright.
 */
export function createSupabaseSSRCookies(session: {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: any;
}): Array<{ name: string; value: string; url: string; httpOnly: boolean; secure: boolean; sameSite: 'Lax' | 'Strict' | 'None'; maxAge: number }> {
  const storageKey = getSupabaseStorageKey();
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8888';

  // Build the session object as @supabase/ssr expects it
  // This matches the auth-js session format
  const sessionObject = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: Math.max(0, session.expires_at - Math.floor(Date.now() / 1000)),
    expires_at: session.expires_at,
    token_type: 'bearer',
    user: session.user,
  };

  // JSON stringify and base64url encode with "base64-" prefix
  const jsonStr = JSON.stringify(sessionObject);
  const encoded = 'base64-' + stringToBase64URL(jsonStr);

  // Create chunks
  const chunks = createChunks(storageKey, encoded);

  // Convert to Playwright cookie format
  // Use url (not domain+path) for Playwright compatibility
  // Use httpOnly: false so createBrowserClient can read cookies via document.cookie/CookieStore
  return chunks.map((chunk) => ({
    name: chunk.name,
    value: chunk.value,
    url: baseURL,
    httpOnly: false,
    secure: false, // localhost
    sameSite: 'Lax' as const,
    maxAge: 60 * 60 * 24 * 365, // 1 year
  }));
}
