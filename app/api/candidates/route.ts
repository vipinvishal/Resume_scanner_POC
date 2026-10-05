import { guard } from "@/lib/auth";
import { fail } from "@/lib/api";
import { listCandidates } from "@/lib/db";
import type { HrStatus } from "@/lib/types";

export async function GET(req: Request) {
  const g = await guard();
  if (g) return g;
  const u = new URL(req.url);
  try {
    const rows = await listCandidates({
      status: (u.searchParams.get("status") as HrStatus | "all") || "all",
      jobId: Number(u.searchParams.get("jobId")) || undefined,
      q: u.searchParams.get("q")?.trim() || undefined,
      from: u.searchParams.get("from") || undefined,
      to: u.searchParams.get("to") || undefined,
      withReport: u.searchParams.get("report") === "1",
    });
    return Response.json(rows);
  } catch (e) {
    return fail(e);
  }
}
