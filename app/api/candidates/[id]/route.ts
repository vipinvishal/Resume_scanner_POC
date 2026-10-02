import { guard } from "@/lib/auth";
import { deleteCandidate, getCandidate, updateCandidateStatus } from "@/lib/db";
import type { HrStatus } from "@/lib/types";

const STATUSES: HrStatus[] = ["pending", "accepted", "rejected", "talk"];

export async function GET(_req: Request, ctx: RouteContext<"/api/candidates/[id]">) {
  const g = await guard();
  if (g) return g;
  const c = getCandidate(Number((await ctx.params).id));
  return c ? Response.json(c) : Response.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/candidates/[id]">) {
  const g = await guard();
  if (g) return g;
  const id = Number((await ctx.params).id);
  const b = (await req.json()) as { status?: HrStatus; note?: string };
  if (!b.status || !STATUSES.includes(b.status)) return Response.json({ error: "Invalid status." }, { status: 400 });
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 1000) : undefined;
  if (!updateCandidateStatus(id, b.status, note))
    return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(getCandidate(id));
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/candidates/[id]">) {
  const g = await guard();
  if (g) return g;
  deleteCandidate(Number((await ctx.params).id));
  return Response.json({ ok: true });
}
