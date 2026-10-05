import type { Settings } from "../types";
import type { LlmRequest } from "./index";
import { errorDetail, fetchWithRetry, trimUrl, unreachable } from "./http";

const base = (s: Settings) => trimUrl(s.openaiUrl || "https://api.openai.com/v1");
const headers = (s: Settings) => ({ "Content-Type": "application/json", Authorization: `Bearer ${s.openaiKey.trim()}` });

async function explain(res: Response): Promise<string> {
  const detail = await errorDetail(res);
  if (res.status === 401) return "OpenAI rejected the API key. Check it in Settings.";
  if (res.status === 404) return `OpenAI model not found, or the API address is wrong. Pick another model in Settings. ${detail}`.trim();
  if (res.status === 429) return `OpenAI says the limit was reached: ${detail}`.slice(0, 400);
  return `OpenAI error ${res.status}: ${detail}`.slice(0, 400);
}

/** Also works with OpenAI-compatible services (Azure OpenAI gateways, company proxies…) by changing the API address. */
export async function openaiChat(s: Settings, req: LlmRequest): Promise<string> {
  try {
    const res = await fetchWithRetry(() =>
      fetch(`${base(s)}/chat/completions`, {
        method: "POST",
        headers: headers(s),
        // No temperature: some newer models only accept their default. The score is calculated in code anyway.
        body: JSON.stringify({
          model: s.openaiModel,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: `${req.system}\nAlways answer with a single JSON object.` },
            { role: "user", content: req.prompt },
          ],
        }),
        signal: AbortSignal.timeout(180_000),
      }),
    );
    if (!res.ok) throw new Error(await explain(res));
    const j = await res.json();
    const text: string = j?.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) throw new Error(`OpenAI returned no content (${j?.choices?.[0]?.finish_reason ?? "empty response"}).`);
    return text;
  } catch (e) {
    throw unreachable("OpenAI", base(s), e);
  }
}

export async function openaiModels(s: Settings): Promise<string[]> {
  if (!s.openaiKey.trim()) throw new Error("Enter your OpenAI API key first.");
  try {
    const res = await fetch(`${base(s)}/models`, { headers: headers(s), signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(await explain(res));
    const j = await res.json();
    return (j.data ?? [])
      .map((m: { id: string }) => m.id)
      .filter((id: string) => /^(gpt|o\d|chatgpt)/.test(id) && !/(embedding|audio|image|realtime|tts|transcribe|moderation|search|instruct|dall)/.test(id))
      .sort();
  } catch (e) {
    throw unreachable("OpenAI", base(s), e);
  }
}
