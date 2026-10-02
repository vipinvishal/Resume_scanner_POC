import { guard } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import { listModels } from "@/lib/llm";
import type { Provider, Settings } from "@/lib/types";

/** Lists models for a provider using form values (so you can fetch before saving). */
export async function POST(req: Request) {
  const g = await guard();
  if (g) return g;
  const b = (await req.json()) as Partial<Settings> & { provider: Provider };
  const saved = getSettings();
  const s: Settings = {
    ...saved,
    provider: b.provider,
    geminiKey: b.geminiKey?.trim() || saved.geminiKey,
    ollamaUrl: b.ollamaUrl?.trim() || saved.ollamaUrl,
  };
  try {
    return Response.json({ models: await listModels(s) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
