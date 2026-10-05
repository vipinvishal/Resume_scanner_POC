// Cloud AI services answer 429/5xx during busy periods. These clear up on their own, so retry with a pause.
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRY_WAITS_MS = [3_000, 8_000, 15_000];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchWithRetry(send: () => Promise<Response>): Promise<Response> {
  let res = await send();
  for (let i = 0; !res.ok && RETRY_STATUS.has(res.status) && i < RETRY_WAITS_MS.length; i++) {
    await sleep(RETRY_WAITS_MS[i]);
    res = await send();
  }
  return res;
}

export async function errorDetail(res: Response): Promise<string> {
  try {
    const j = await res.json();
    return j?.error?.message ?? (typeof j?.error === "string" ? j.error : JSON.stringify(j));
  } catch {
    return await res.text().catch(() => "");
  }
}

export const trimUrl = (u: string) => u.trim().replace(/\/+$/, "");

/** "Can't reach …" for network failures, so HR sees something better than "fetch failed". */
export function unreachable(name: string, url: string, e: unknown): Error {
  const msg = (e as Error)?.message ?? String(e);
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|timed? ?out/i.test(msg) || (e as { cause?: unknown })?.cause)
    return new Error(`Can't reach ${name} at ${url}. Check the internet connection or the address in Settings.`);
  return e as Error;
}
