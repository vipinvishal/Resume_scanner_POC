import { z } from "zod";
import { guard } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import { generateJson } from "@/lib/llm";
import type { Provider, Settings } from "@/lib/types";

export async function POST(req: Request) {
  const g = await guard();
  if (g) return g;
  const b = (await req.json()) as Partial<Settings> & { provider: Provider };
  const saved = getSettings();
  const s: Settings = {
    ...saved,
    provider: b.provider,
    geminiKey: b.geminiKey?.trim() || saved.geminiKey,
    geminiModel: b.geminiModel?.trim() || saved.geminiModel,
    ollamaUrl: b.ollamaUrl?.trim() || saved.ollamaUrl,
    ollamaModel: b.ollamaModel?.trim() || saved.ollamaModel,
  };
  const t0 = Date.now();
  try {
    const out = await generateJson(
      z.object({ reply: z.string() }),
      { system: "Reply with a JSON object only.", prompt: 'Return {"reply":"ok"}.' },
      s,
    );
    return Response.json({ ok: true, ms: Date.now() - t0, reply: out.reply });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
