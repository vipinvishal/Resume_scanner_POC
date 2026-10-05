import { guard, currentActor } from "@/lib/auth";
import { findDuplicates, findSameFile, getCandidate, getJob, getSettings, insertCandidate, textHash } from "@/lib/db";
import { analyzeResume } from "@/lib/analyze";
import { gateMissing } from "@/lib/gate";
import { activeModel, assertConfigured } from "@/lib/llm";
import { fileToText } from "@/lib/parse";

export const maxDuration = 300;

/** Analyze ONE resume against an existing job. The Home page calls this once per resume. */
export async function POST(req: Request) {
  const g = await guard();
  if (g) return g;
  try {
    const form = await req.formData();
    const jobId = Number(form.get("jobId"));
    const file = form.get("resume");
    const source = form.get("source") === "bulk" ? "bulk" : "instant";
    const job = await getJob(jobId);
    if (!job) return Response.json({ error: "Job not found." }, { status: 404 });
    if (!(file instanceof File)) return Response.json({ error: "No resume uploaded." }, { status: 400 });

    const s = getSettings();
    assertConfigured(s);
    const text = await fileToText(file);
    const hash = textHash(text);

    // The very same resume was already screened for this job: show that result instead of paying for it twice.
    const prior = await findSameFile(jobId, hash);
    if (prior) {
      const c = await getCandidate(prior);
      if (c) return Response.json({ id: prior, report: c.report, reused: true, hr_status: c.hr_status, gate_missing: c.gate_missing, duplicates: c.duplicates });
    }

    const report = await analyzeResume(job.requirements, text, file.name, s);
    const gate = gateMissing(job.requirements.requirements, report.skills);
    const id = await insertCandidate({
      jobId,
      fileName: file.name,
      resumeText: text,
      report,
      source,
      provider: s.provider,
      model: activeModel(s),
      gateMissing: gate,
      actor: currentActor(),
    });
    const duplicates = await findDuplicates({ name: report.candidate.name, email: report.candidate.email, hash, jobId, excludeId: id });
    return Response.json({ id, report, reused: false, gate_missing: gate, duplicates });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
