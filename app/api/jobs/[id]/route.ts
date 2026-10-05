import { fail } from "@/lib/api";
import { currentActor, guard } from "@/lib/auth";
import { getJob, setMandatory } from "@/lib/db";

export async function GET(_req: Request, ctx: RouteContext<"/api/jobs/[id]">) {
  const g = await guard();
  if (g) return g;
  try {
    const job = await getJob(Number((await ctx.params).id));
    return job ? Response.json(job) : Response.json({ error: "Job not found." }, { status: 404 });
  } catch (e) {
    return fail(e);
  }
}

/** Choose which skills are mandatory. Body: { mandatory: string[] } (requirement ids). */
export async function PATCH(req: Request, ctx: RouteContext<"/api/jobs/[id]">) {
  const g = await guard();
  if (g) return g;
  const b = (await req.json().catch(() => ({}))) as { mandatory?: unknown };
  if (!Array.isArray(b.mandatory) || !b.mandatory.every((x) => typeof x === "string")) return fail(new Error("Send a list of skill ids."), 400);
  try {
    const job = await setMandatory(Number((await ctx.params).id), b.mandatory as string[], currentActor());
    return job ? Response.json(job) : Response.json({ error: "Job not found." }, { status: 404 });
  } catch (e) {
    return fail(e);
  }
}
