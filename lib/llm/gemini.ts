import type { Settings } from "../types";
import type { LlmRequest } from "./index";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

async function explain(res: Response): Promise<string> {
  let detail = "";
  try {
    const j = await res.json();
    detail = j?.error?.message ?? JSON.stringify(j);
  } catch {
    detail = await res.text().catch(() => "");
  }
  if (res.status === 400 && /API key/i.test(detail)) return "Gemini rejected the API key. Check it in Settings.";
  if (res.status === 403) return `Gemini denied access (403). ${detail}`;
  if (res.status === 404) return `Gemini model not found. Pick another model in Settings. ${detail}`;
  if (res.status === 429) return "Gemini rate limit reached (still busy after several retries). Wait a minute and try again.";
  if (res.status === 503)
    return `Gemini is overloaded right now (tried 5 times). This is temporary on Google's side — try again in a minute, or pick a lighter model (e.g. a "flash-lite" model) in Settings.`;
  return `Gemini error ${res.status}: ${detail}`.slice(0, 400);
}

// Gemini sometimes answers 503/429 during demand spikes. These clear up on their own, so retry with a pause.
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRY_WAITS_MS = [3_000, 8_000, 15_000, 25_000];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function geminiChat(s: Settings, req: LlmRequest): Promise<string> {
  const model = s.geminiModel.replace(/^models\//, "");
  const send = () =>
    fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": s.geminiKey.trim() },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: "user", parts: [{ text: req.prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(120_000),
    });

  let res = await send();
  for (let i = 0; !res.ok && RETRY_STATUS.has(res.status) && i < RETRY_WAITS_MS.length; i++) {
    await sleep(RETRY_WAITS_MS[i]);
    res = await send();
  }
  if (!res.ok) throw new Error(await explain(res));
  const j = await res.json();
  const text = (j?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("");
  if (!text) {
    const why = j?.promptFeedback?.blockReason ?? j?.candidates?.[0]?.finishReason ?? "empty response";
    throw new Error(`Gemini returned no content (${why}).`);
  }
  return text;
}

export async function geminiModels(s: Settings): Promise<string[]> {
  if (!s.geminiKey.trim()) throw new Error("Enter your Gemini API key first.");
  const res = await fetch(`${BASE}/models?pageSize=200`, {
    headers: { "x-goog-api-key": s.geminiKey.trim() },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(await explain(res));
  const j = await res.json();
  return (j.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m: { name: string }) => m.name.replace(/^models\//, ""))
    .filter((n: string) => /^gemini/.test(n) && !/(embedding|aqa|image|tts|live|audio)/.test(n))
    .sort();
}
