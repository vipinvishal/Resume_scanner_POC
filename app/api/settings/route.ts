import { guard } from "@/lib/auth";
import { getSettings, saveSettings } from "@/lib/db";
import type { Settings } from "@/lib/types";

const mask = (s: Settings) => ({ ...s, geminiKey: "", hasGeminiKey: !!s.geminiKey });

export async function GET() {
  const g = await guard();
  if (g) return g;
  return Response.json(mask(getSettings()));
}

export async function PUT(req: Request) {
  const g = await guard();
  if (g) return g;
  const b = (await req.json()) as Partial<Settings>;
  const patch: Partial<Settings> = {};
  if (b.provider === "gemini" || b.provider === "ollama") patch.provider = b.provider;
  // An empty key in the form means "keep the saved one".
  if (typeof b.geminiKey === "string" && b.geminiKey.trim()) patch.geminiKey = b.geminiKey.trim();
  if (typeof b.geminiModel === "string" && b.geminiModel.trim()) patch.geminiModel = b.geminiModel.trim();
  if (typeof b.ollamaUrl === "string" && b.ollamaUrl.trim()) patch.ollamaUrl = b.ollamaUrl.trim();
  if (typeof b.ollamaModel === "string") patch.ollamaModel = b.ollamaModel.trim();
  const acc = Number(b.acceptThreshold);
  const talk = Number(b.talkThreshold);
  if (Number.isFinite(acc) && Number.isFinite(talk)) {
    if (!(talk >= 1 && acc <= 100 && talk < acc))
      return Response.json({ error: "Thresholds must satisfy: reject level < accept level, within 1–100." }, { status: 400 });
    patch.acceptThreshold = Math.round(acc);
    patch.talkThreshold = Math.round(talk);
  }
  saveSettings(patch);
  return Response.json(mask(getSettings()));
}
