import { guard } from "@/lib/auth";
import { getStats } from "@/lib/db";

export async function GET(req: Request) {
  const g = await guard();
  if (g) return g;
  const u = new URL(req.url);
  return Response.json(getStats({ from: u.searchParams.get("from") || undefined, to: u.searchParams.get("to") || undefined }));
}
