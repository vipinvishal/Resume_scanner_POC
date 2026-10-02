import type { Settings } from "../types";
import type { LlmRequest } from "./index";

const base = (s: Settings) => s.ollamaUrl.trim().replace(/\/+$/, "");

function unreachable(s: Settings, e: unknown): Error {
  const msg = (e as Error)?.message ?? String(e);
  if (/fetch failed|ECONNREFUSED|ENOTFOUND/i.test(msg) || (e as { cause?: unknown })?.cause)
    return new Error(`Can't reach Ollama at ${base(s)}. Is Ollama running? (try: ollama serve)`);
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
      options: { temperature: 0.1, num_ctx: 12288 },
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
    let res = await call({ think: false, format: req.jsonSchema ?? "json" });
    // Some builds reject `think` or a schema-style format: retry once plainly.
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
