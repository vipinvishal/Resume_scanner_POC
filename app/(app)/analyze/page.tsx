"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Check, Loader2, Wand2 } from "lucide-react";
import { FileDrop, JdInput, jdFormData, jdReady, loadSamples, type JdValue } from "@/components/inputs";
import { Card, PageHeader, btn, cx } from "@/components/ui";

const STEPS = ["Reading the job description", "Reading the resume", "Matching skills one by one", "Writing the HR report"];

export default function InstantAnalysis() {
  const router = useRouter();
  const [jd, setJd] = useState<JdValue>({ text: "", file: null });
  const [resume, setResume] = useState<File[]>([]);
  const [step, setStep] = useState(-1); // -1 idle
  const [error, setError] = useState("");

  const running = step >= 0;
  const ready = jdReady(jd) && resume.length === 1;

  // Steps 2–4 happen inside a single request; advance the indicator while we wait.
  useEffect(() => {
    if (step < 1 || step > 2) return;
    const t = setTimeout(() => setStep((s) => (s >= 1 && s < 3 ? s + 1 : s)), step === 1 ? 2500 : 9000);
    return () => clearTimeout(t);
  }, [step]);

  async function useSamples() {
    const [j] = await loadSamples("jd");
    const [r] = await loadSamples("resume");
    setJd({ text: "", file: j });
    setResume([r]);
  }

  async function run() {
    setError("");
    setStep(0);
    try {
      const jobRes = await fetch("/api/jobs", { method: "POST", body: jdFormData(jd) });
      const job = await jobRes.json();
      if (!jobRes.ok) throw new Error(job.error ?? "Couldn't read the job description.");

      setStep(1);
      const fd = new FormData();
      fd.append("jobId", String(job.id));
      fd.append("resume", resume[0]);
      fd.append("source", "instant");
      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The analysis failed.");
      setStep(4);
      router.push(`/candidates/${data.id}`);
    } catch (e) {
      setError((e as Error).message);
      setStep(-1);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Instant analysis" title="Compare one resume to one job." />

      {running ? (
        <Card className="mx-auto max-w-xl animate-fade p-9">
          <h2 className="font-display text-2xl font-semibold">Analysing…</h2>
          <p className="mt-1 text-ink-soft">This usually takes 10–40 seconds. A local model can take a little longer.</p>
          <ol className="mt-8 space-y-5">
            {STEPS.map((label, i) => {
              const done = step > i;
              const now = step === i;
              return (
                <li key={label} className={cx("flex items-center gap-4 transition-opacity", !done && !now && "opacity-40")}>
                  <span className={cx("grid h-8 w-8 place-items-center rounded-full border transition-colors", done ? "border-forest bg-forest text-paper" : now ? "border-forest text-forest" : "border-line-strong text-ink-faint")}>
                    {done ? <Check size={16} /> : now ? <Loader2 size={16} className="animate-spin" /> : i + 1}
                  </span>
                  <span className={cx("font-medium", now && "text-forest")}>{label}</span>
                </li>
              );
            })}
          </ol>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-7">
              <div className="mb-5 flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-forest font-mono text-sm text-paper">1</span>
                <h2 className="font-display text-2xl font-semibold">Job description</h2>
              </div>
              <JdInput value={jd} onChange={setJd} />
            </Card>
            <Card className="p-7">
              <div className="mb-5 flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-forest font-mono text-sm text-paper">2</span>
                <h2 className="font-display text-2xl font-semibold">Candidate resume</h2>
              </div>
              <FileDrop files={resume} onChange={setResume} title="Drop the resume here, or click to browse" />
            </Card>
          </div>

          {error && (
            <div role="alert" className="mt-6 flex items-start gap-3 rounded-2xl border border-reject/30 bg-reject-bg/70 px-5 py-4 text-reject">
              <AlertCircle size={20} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Couldn&apos;t complete the analysis</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button onClick={run} disabled={!ready} className={cx(btn.primary, "!px-7 !py-3.5 text-base")}>
              Analyse resume <ArrowRight size={18} />
            </button>
            <button onClick={useSamples} className={btn.ghost}>
              <Wand2 size={16} /> Fill with sample data
            </button>
            {!ready && <p className="text-sm text-ink-soft">Add a job description and one resume to continue.</p>}
          </div>
        </>
      )}
    </>
  );
}
