import { fail } from "@/lib/api";
import { currentActor, guard } from "@/lib/auth";
import { mergeCandidates } from "@/lib/db";

/** Keep this record and fold a duplicate (`fromId`) into it. */
export async function POST(req: Request, ctx: RouteContext<"/api/candidates/[id]/merge">) {
  const g = await guard();
  if (g) return g;
  const keepId = Number((await ctx.params).id);
  const { fromId } = (await req.json().catch(() => ({}))) as { fromId?: number };
  if (!Number.isInteger(fromId)) return Response.json({ error: "Choose a record to merge." }, { status: 400 });
  try {
    const r = await mergeCandidates(keepId, fromId!, currentActor());
    if (r === "same") return Response.json({ error: "A record can't be merged into itself." }, { status: 400 });
    if (r === "missing") return Response.json({ error: "One of those records no longer exists." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
