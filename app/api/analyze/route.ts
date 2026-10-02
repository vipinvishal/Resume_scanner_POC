import { guard } from "@/lib/auth";
import { getJob, getSettings, insertCandidate } from "@/lib/db";
import { analyzeResume } from "@/lib/analyze";
import { activeModel, assertConfigured } from "@/lib/llm";
import { fileToText } from "@/lib/parse";

export const maxDuration = 300;

/** Analyze ONE resume against an existing job. Bulk mode calls this once per resume. */
export async function POST(req: Request) {
  const g = await guard();
  if (g) return g;
  try {
    const form = await req.formData();
    const jobId = Number(form.get("jobId"));
    const file = form.get("resume");
    const source = form.get("source") === "bulk" ? "bulk" : "instant";
    const job = getJob(jobId);
    if (!job) return Response.json({ error: "Job not found." }, { status: 404 });
    if (!(file instanceof File)) return Response.json({ error: "No resume uploaded." }, { status: 400 });

    const s = getSettings();
    assertConfigured(s);
    const text = await fileToText(file);
    const report = await analyzeResume(job.requirements, text, file.name, s);
    const id = insertCandidate({
      jobId,
      fileName: file.name,
      resumeText: text,
      report,
      source,
      provider: s.provider,
      model: activeModel(s),
    });
    return Response.json({ id, report });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
