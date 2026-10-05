import { guard } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import { listModels } from "@/lib/llm";
import { applyForm } from "@/lib/settings";

/** Lists models for a provider using form values (so you can fetch before saving). */
export async function POST(req: Request) {
  const g = await guard();
  if (g) return g;
  const s = applyForm(getSettings(), await req.json());
  try {
    return Response.json({ models: await listModels(s) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
