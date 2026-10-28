import type { Settings } from "../types";
import type { LlmRequest } from "./index";

// Node resolves "localhost" to IPv6 (::1) first, but Ollama listens on IPv4 only, so "fetch failed" even though Ollama is running.
const base = (s: Settings) => {
  let u = s.ollamaUrl.trim().replace(/\/+$/, "").replace(/\/api$/, "");
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  return u.replace(/^(https?:\/\/)localhost(?=[:/]|$)/i, "$1127.0.0.1");
};

function unreachable(s: Settings, e: unknown): Error {
  const msg = (e as Error)?.message ?? String(e);
  const cause = (e as { cause?: { code?: string; message?: string } })?.cause;
  if (/fetch failed|ECONNREFUSED|ENOTFOUND/i.test(msg) || cause)
    return new Error(`Can't reach Ollama at ${base(s)} (${cause?.code ?? cause?.message ?? msg}). Is Ollama running? (try: ollama serve) Check the address in Settings.`);
  return e as Error;
}

export async function ollamaChat(s: Settings, req: LlmRequest): Promise<string> {
  const call = async (opts: { think: boolean; format: unknown }) => {
    const body: Record<string, unknown> = {
      model: s.ollamaModel,
      stream: false,
      keep_alive: "15m",
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.prompt },
      ],
      options: { temperature: 0.1, num_ctx: 8192, num_predict: 2048 },
    };
    if (opts.format) body.format = opts.format;
    if (!opts.think) body.think = false;
    return fetch(`${base(s)}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(600_000),
    });
  };

  try {
    let res = await call({ think: false, format: "json" });
    // Some builds reject `think`: retry once with it left at the default.
    if (res.status === 400) res = await call({ think: true, format: "json" });
    if (!res.ok) {
      const t = await res.text();
      if (res.status === 404)
        throw new Error(`Ollama model "${s.ollamaModel}" is not installed. Run: ollama pull ${s.ollamaModel}`);
      throw new Error(`Ollama error ${res.status}: ${t.slice(0, 300)}`);
    }
    const j = await res.json();
    const text: string = j?.message?.content ?? "";
    if (!text.trim()) throw new Error("Ollama returned an empty answer.");
    return text;
  } catch (e) {
    throw unreachable(s, e);
  }
}

export async function ollamaModels(s: Settings): Promise<string[]> {
  try {
    const res = await fetch(`${base(s)}/api/tags`, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) throw new Error(`Ollama error ${res.status}`);
    const j = await res.json();
    return (j.models ?? []).map((m: { name: string }) => m.name).sort();
  } catch (e) {
    throw unreachable(s, e);
  }
}
