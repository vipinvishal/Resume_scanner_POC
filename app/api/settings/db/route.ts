import { guard } from "@/lib/auth";
import { getSettings, testDatabase } from "@/lib/db";
import { applyForm, validate } from "@/lib/settings";

/** "Test connection" for the database section: connects and makes sure the tables exist. */
export async function POST(req: Request) {
  const g = await guard();
  if (g) return g;
  const { db } = applyForm(getSettings(), { db: (await req.json()).db });
  const s = { ...getSettings(), db };
  const problem = validate(s);
  if (problem) return Response.json({ ok: false, error: problem }, { status: 400 });
  const t0 = Date.now();
  try {
    const { created } = await testDatabase(db);
    return Response.json({ ok: true, ms: Date.now() - t0, created, database: db.database });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
