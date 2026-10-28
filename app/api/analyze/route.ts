import { guard, currentActor } from "@/lib/auth";
import { findDuplicates, findSameFile, getCandidate, getJob, getSavedResumeText, getSettings, insertCandidate, textHash } from "@/lib/db";
import { quickReport } from "@/lib/analyze";
import { gateMissing } from "@/lib/gate";
import { isConfigured } from "@/lib/llm";
import { fileToText } from "@/lib/parse";

export const maxDuration = 300;

/**
 * Instant first pass for ONE resume against an existing job: no AI, so it answers in milliseconds.
 * The Home page then asks /api/candidates/[id]/review for the AI review of the best ones.
 */
export async function POST(req: Request) {
  const g = await guard();
  if (g) return g;
  try {
    const form = await req.formData();
    const jobId = Number(form.get("jobId"));
    const file = form.get("resume");
    let stored: { fileName: string; text: string } | null = null;
    // Screening a resume that is already saved (from an earlier job) against this job.
    const fromId = Number(form.get("fromId"));
    if (fromId) {
      const saved = await getSavedResumeText(fromId);
      if (!saved) return Response.json({ error: "That saved resume no longer exists." }, { status: 404 });
      stored = saved;
    }
    const source = form.get("source") === "bulk" ? "bulk" : "instant";
    const job = await getJob(jobId);
    if (!job) return Response.json({ error: "Job not found." }, { status: 404 });
    if (!stored && !(file instanceof File)) return Response.json({ error: "No resume uploaded." }, { status: 400 });

    const s = getSettings();
    const plan = { aiReady: isConfigured(s), parallel: s.parallel, top: s.aiReviewTop };
    const fileName = stored ? stored.fileName || "resume" : (file as File).name;
    const text = stored ? stored.text : await fileToText(file as File);
    const hash = textHash(text);

    // The very same resume was already screened for this job: show that result instead of paying for it twice.
    const prior = await findSameFile(jobId, hash);
    if (prior) {
      const c = await getCandidate(prior);
      if (c) return Response.json({ id: prior, report: c.report, reused: true, hr_status: c.hr_status, gate_missing: c.gate_missing, duplicates: c.duplicates, plan });
    }

    const report = quickReport(job.requirements, text, fileName, s);
    // The analysis takes a while and HR may change the mandatory skills meanwhile, so check against the job as it is now.
    const latest = (await getJob(jobId)) ?? job;
    const gate = gateMissing(latest.requirements.requirements, report.skills);
    const id = await insertCandidate({
      jobId,
      fileName: fileName,
      resumeText: text,
      report,
      source,
      provider: "quick",
      model: "keyword check",
      gateMissing: gate,
      actor: currentActor(),
    });
    const duplicates = await findDuplicates({ name: report.candidate.name, email: report.candidate.email, hash, jobId, excludeId: id });
    return Response.json({ id, report, reused: false, gate_missing: gate, duplicates, plan });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
