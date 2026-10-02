import { guard } from "@/lib/auth";
import { listCandidates } from "@/lib/db";
import type { HrStatus } from "@/lib/types";

export async function GET(req: Request) {
  const g = await guard();
  if (g) return g;
  const u = new URL(req.url);
  const rows = listCandidates({
    status: (u.searchParams.get("status") as HrStatus | "all") || "all",
    jobId: Number(u.searchParams.get("jobId")) || undefined,
    q: u.searchParams.get("q")?.trim() || undefined,
    from: u.searchParams.get("from") || undefined,
    to: u.searchParams.get("to") || undefined,
  });
  return Response.json(rows);
}
