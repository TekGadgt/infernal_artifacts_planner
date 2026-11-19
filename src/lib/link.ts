// Packs share-link bytes into a URL-safe string, deflating them when that is shorter.

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const body = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(body).arrayBuffer());
}

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64Url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

// The first byte of a compact link says whether the rest is deflated.
const RAW = 0;
const DEFLATED = 1;

export async function pack(raw: Uint8Array): Promise<string> {
  const deflated = await pipe(raw, new CompressionStream('deflate-raw'));
  const [flag, body] = deflated.length < raw.length ? [DEFLATED, deflated] : [RAW, raw];
  return toBase64Url(Uint8Array.of(flag, ...body));
}

export async function unpack(encoded: string): Promise<Uint8Array> {
  const bytes = fromBase64Url(encoded);
  const body = bytes.subarray(1);
  return bytes[0] === DEFLATED ? pipe(body, new DecompressionStream('deflate-raw')) : body;
}

/** Links made before the compact format: deflated JSON. */
export async function unpackJson(encoded: string): Promise<unknown> {
  const bytes = await pipe(fromBase64Url(encoded), new DecompressionStream('deflate-raw'));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Builds a link to the current page with `key=value` in the hash. */
export function hashUrl(key: string, value: string): string {
  const url = new URL(window.location.href);
  url.hash = `${key}=${value}`;
  return url.toString();
}

/** Reads these keys from the URL hash, and clears the hash if any was there. */
export function takeHash(...keys: string[]): Record<string, string | null> | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const found = Object.fromEntries(keys.map((k) => [k, params.get(k)]));
  if (!Object.values(found).some(Boolean)) return null;
  history.replaceState(null, '', window.location.pathname + window.location.search);
  return found;
}
