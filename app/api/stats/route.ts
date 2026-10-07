import { fail } from "@/lib/api";
import { guard } from "@/lib/auth";
import { getStats } from "@/lib/db";

export async function GET(req: Request) {
  const g = await guard();
  if (g) return g;
  const u = new URL(req.url);
  try {
    const jobId = Number(u.searchParams.get("jobId")) || undefined;
    return Response.json(await getStats({ from: u.searchParams.get("from") || undefined, to: u.searchParams.get("to") || undefined, jobId }));
  } catch (e) {
    return fail(e);
  }
}
