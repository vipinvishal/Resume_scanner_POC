import { fail } from "@/lib/api";
import { currentActor, guard } from "@/lib/auth";
import { DB_LABEL, getSettings, logAudit, saveSettings, testDatabase } from "@/lib/db";
import { PROVIDER_LABEL, activeModel } from "@/lib/llm";
import { applyForm, validate } from "@/lib/settings";
import { publicSettings } from "@/lib/settings-public";

export async function GET() {
  const g = await guard();
  if (g) return g;
  return Response.json(publicSettings(getSettings()));
}

export async function PUT(req: Request) {
  const g = await guard();
  if (g) return g;
  const saved = getSettings();
  const next = applyForm(saved, await req.json());
  const problem = validate(next);
  if (problem) return fail(new Error(problem), 400);

  // Never save a database setting that doesn't work — that would lock HR out of the Candidates tab.
  if (JSON.stringify(next.db) !== JSON.stringify(saved.db)) {
    try {
      await testDatabase(next.db);
    } catch (e) {
      return fail(e, 400);
    }
  }
  const result = saveSettings(next);

  // Record what changed (never the secrets themselves).
  const changes: string[] = [];
  if (saved.provider !== next.provider) changes.push(`AI provider: ${PROVIDER_LABEL[saved.provider]} → ${PROVIDER_LABEL[next.provider]}`);
  else if (activeModel(saved) !== activeModel(next)) changes.push(`AI model: ${activeModel(saved) || "none"} → ${activeModel(next)}`);
  if ((["openaiKey", "anthropicKey", "geminiKey"] as const).some((k) => saved[k] !== next[k])) changes.push("an API key was updated");
  if (saved.db.type !== next.db.type) changes.push(`database: ${DB_LABEL[saved.db.type]} → ${DB_LABEL[next.db.type]}`);
  else if (JSON.stringify({ ...saved.db, password: "" }) !== JSON.stringify({ ...next.db, password: "" })) changes.push("database connection details");
  if (saved.db.password !== next.db.password) changes.push("the database password was updated");
  if (saved.acceptThreshold !== next.acceptThreshold || saved.talkThreshold !== next.talkThreshold)
    changes.push(`recommendation levels: accept ${next.acceptThreshold}+, talk ${next.talkThreshold}+`);
  if (changes.length) await logAudit({ actor: currentActor(), action: "settings_changed", summary: `Settings changed — ${changes.join("; ")}` }).catch(() => {});
  return Response.json(publicSettings(result));
}
