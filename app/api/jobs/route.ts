import { guard } from "@/lib/auth";
import { createJob, getSettings, listJobs } from "@/lib/db";
import { extractJobRequirements } from "@/lib/analyze";
import { assertConfigured } from "@/lib/llm";
import { fileToText } from "@/lib/parse";

export const maxDuration = 300;

export async function GET() {
  const g = await guard();
  if (g) return g;
  return Response.json(listJobs());
}

/** Create a job from a pasted JD or an uploaded file, and read its requirements. */
export async function POST(req: Request) {
  const g = await guard();
  if (g) return g;
  try {
    const form = await req.formData();
    const file = form.get("jdFile");
    let text = String(form.get("jdText") ?? "").trim();
    if (file instanceof File && file.size > 0) text = await fileToText(file);
    if (text.length < 60) return Response.json({ error: "Please provide a job description (paste text or upload a file)." }, { status: 400 });

    const s = getSettings();
    assertConfigured(s);
    const requirements = await extractJobRequirements(text, s);
    const title = String(form.get("title") ?? "").trim() || requirements.title;
    const job = createJob(title, text, requirements);
    return Response.json(job);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
