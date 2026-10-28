import { fail } from "@/lib/api";
import { guard } from "@/lib/auth";
import { listSavedResumes } from "@/lib/db";

/** Every resume already saved, one entry per person/file — for screening them against a new job. */
export async function GET(req: Request) {
  const g = await guard();
  if (g) return g;
  try {
    return Response.json(await listSavedResumes(new URL(req.url).searchParams.get("q") ?? ""));
  } catch (e) {
    return fail(e);
  }
}
