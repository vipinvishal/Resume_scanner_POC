import { fail } from "@/lib/api";
import { currentActor, guard } from "@/lib/auth";
import { findDuplicates, getJob, getReviewInput, getSettings, updateCandidateReport } from "@/lib/db";
import { reviewResume } from "@/lib/analyze";
import { gateMissing } from "@/lib/gate";
import { activeModel, assertConfigured } from "@/lib/llm";

export const maxDuration = 300;

/** The AI review of one resume that already has its instant-check result. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (g) return g;
  try {
    const id = Number((await ctx.params).id);
    const input = await getReviewInput(id);
    if (!input) return Response.json({ error: "Candidate not found." }, { status: 404 });
    const s = getSettings();
    assertConfigured(s);
    const report = await reviewResume(input.requirements, input.resumeText, input.fileName, s);
    // HR may have changed the mandatory skills meanwhile, so check against the job as it is now.
    const latest = (await getJob(input.jobId))?.requirements ?? input.requirements;
    const gate = gateMissing(latest.requirements, report.skills);
    await updateCandidateReport(id, report, s.provider, activeModel(s), gate, currentActor());
    const duplicates = await findDuplicates({ name: report.candidate.name, email: report.candidate.email, hash: input.hash, jobId: input.jobId, excludeId: id });
    return Response.json({ id, report, gate_missing: gate, duplicates });
  } catch (e) {
    return fail(e, 400);
  }
}
