/**
 * Fetch with timeout + fallback. Never throws — always returns either parsed JSON or the fallback.
 */
export async function safeFetch<T>(
  url: string,
  fallback: T,
  options: { timeoutMs?: number; init?: RequestInit } = {},
): Promise<{ data: T; ok: boolean; error?: string }> {
  const { timeoutMs = 5000, init } = options;
  try {
    const res = await Promise.race([
      fetch(url, init),
      new Promise<Response>((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs)),
    ]);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as T;
    return { data, ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (typeof window !== "undefined") console.warn("[safeFetch] fallback for", url, msg);
    return { data: fallback, ok: false, error: msg };
  }
}
