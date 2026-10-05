import { z } from "zod";
import { guard } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import { generateJson } from "@/lib/llm";
import { applyForm } from "@/lib/settings";

export async function POST(req: Request) {
  const g = await guard();
  if (g) return g;
  const s = applyForm(getSettings(), await req.json());
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
