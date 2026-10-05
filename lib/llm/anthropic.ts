import type { Settings } from "../types";
import type { LlmRequest } from "./index";
import { errorDetail, fetchWithRetry, trimUrl, unreachable } from "./http";

const base = (s: Settings) => trimUrl(s.anthropicUrl || "https://api.anthropic.com");
const headers = (s: Settings) => ({
  "Content-Type": "application/json",
  "x-api-key": s.anthropicKey.trim(),
  "anthropic-version": "2023-06-01",
});

async function explain(res: Response): Promise<string> {
  const detail = await errorDetail(res);
  if (res.status === 401) return "Anthropic rejected the API key. Check it in Settings.";
  if (res.status === 403) return `Anthropic denied access (403). ${detail}`;
  if (res.status === 404) return `Anthropic model not found. Pick another model in Settings. ${detail}`;
  if (res.status === 429) return `Anthropic says the limit was reached: ${detail}`.slice(0, 400);
  if (res.status === 529) return "Anthropic is overloaded right now. Try again in a minute.";
  return `Anthropic error ${res.status}: ${detail}`.slice(0, 400);
}

export async function anthropicChat(s: Settings, req: LlmRequest): Promise<string> {
  try {
    const res = await fetchWithRetry(() =>
      fetch(`${base(s)}/v1/messages`, {
        method: "POST",
        headers: headers(s),
        body: JSON.stringify({
          model: s.anthropicModel,
          max_tokens: 8000,
          system: `${req.system}\nAnswer with a single JSON object and nothing else.`,
          messages: [{ role: "user", content: req.prompt }],
        }),
        signal: AbortSignal.timeout(180_000),
      }),
    );
    if (!res.ok) throw new Error(await explain(res));
    const j = await res.json();
    const text = ((j?.content ?? []) as { type: string; text?: string }[])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    if (!text.trim()) throw new Error(`Anthropic returned no content (${j?.stop_reason ?? "empty response"}).`);
    return text;
  } catch (e) {
    throw unreachable("Anthropic", base(s), e);
  }
}

export async function anthropicModels(s: Settings): Promise<string[]> {
  if (!s.anthropicKey.trim()) throw new Error("Enter your Anthropic API key first.");
  try {
    const res = await fetch(`${base(s)}/v1/models?limit=100`, { headers: headers(s), signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(await explain(res));
    const j = await res.json();
    return (j.data ?? []).map((m: { id: string }) => m.id);
  } catch (e) {
    throw unreachable("Anthropic", base(s), e);
  }
}
