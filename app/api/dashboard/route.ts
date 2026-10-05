import { fail } from "@/lib/api";
import { guard } from "@/lib/auth";
import { getDashboard } from "@/lib/db";

export async function GET(req: Request) {
  const g = await guard();
  if (g) return g;
  try {
    return Response.json(await getDashboard({ jobId: Number(new URL(req.url).searchParams.get("jobId")) || undefined }));
  } catch (e) {
    return fail(e);
  }
}
