"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, MessageCircleQuestion, RotateCcw, Users, Wand2, XCircle } from "lucide-react";
import { FileDrop, JdInput, jdFormData, jdReady, loadSamples, type JdValue } from "@/components/inputs";
import { Card, PageHeader, StatusBadge, VerdictBadge, btn, cx } from "@/components/ui";
import type { HrStatus, Report } from "@/lib/types";

type RowState =
  | { state: "queued" }
  | { state: "running" }
  | { state: "error"; error: string }
  | { state: "done"; id: number; report: Report; hr: HrStatus };

interface Row {
  file: File;
  res: RowState;
}

export default function BulkUpload() {
  const [jd, setJd] = useState<JdValue>({ text: "", file: null });
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [phase, setPhase] = useState<"setup" | "reading-jd" | "running" | "finished">("setup");
  const [jobTitle, setJobTitle] = useState("");
  const [error, setError] = useState("");
  const cancelled = useRef(false);
  const jobIdRef = useRef(0);

  const ready = jdReady(jd) && files.length > 0;
  const patch = (i: number, res: RowState) => setRows((r) => r.map((x, j) => (j === i ? { ...x, res } : x)));

  async function useSamples() {
    const [j] = await loadSamples("jd");
    setJd({ text: "", file: j });
    setFiles(await loadSamples("resumes"));
  }

  async function analyzeOne(i: number, file: File) {
    patch(i, { state: "running" });
    try {
      const fd = new FormData();
      fd.append("jobId", String(jobIdRef.current));
      fd.append("resume", file);
      fd.append("source", "bulk");
      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed.");
      patch(i, { state: "done", id: data.id, report: data.report, hr: "pending" });
    } catch (e) {
      patch(i, { state: "error", error: (e as Error).message });
    }
  }

  async function run() {
    setError("");
    cancelled.current = false;
    setPhase("reading-jd");
    const jobRes = await fetch("/api/jobs", { method: "POST", body: jdFormData(jd) });
    const job = await jobRes.json();
    if (!jobRes.ok) {
      setError(job.error ?? "Couldn't read the job description.");
      setPhase("setup");
      return;
    }
    setJobTitle(job.title);
    jobIdRef.current = job.id;
    setRows(files.map((file) => ({ file, res: { state: "queued" } })));
    setPhase("running");

    // Resumes are screened one at a time: gentle on rate limits and on a local Ollama model.
    for (let i = 0; i < files.length; i++) {
      if (cancelled.current) break;
      await analyzeOne(i, files[i]);
    }
    setPhase("finished");
  }

  async function decide(i: number, id: number, status: HrStatus) {
    const res = await fetch(`/api/candidates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok)
      setRows((r) => r.map((x, j) => (j === i && x.res.state === "done" ? { ...x, res: { ...x.res, hr: status } } : x)));
  }

  function reset() {
    setRows([]);
    setFiles([]);
    setJd({ text: "", file: null });
    setPhase("setup");
  }

  const doneCount = rows.filter((r) => r.res.state !== "queued" && r.res.state !== "running").length;
  const sorted = rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const sa = a.r.res.state === "done" ? a.r.res.report.score : -1;
      const sb = b.r.res.state === "done" ? b.r.res.report.score : -1;
      return phase === "finished" ? sb - sa : a.i - b.i;
    });

  /* ───── Setup ───── */
  if (phase === "setup" || phase === "reading-jd")
    return (
      <>
        <PageHeader eyebrow="Bulk upload" title="One job. Many resumes." />
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
              <h2 className="font-display text-2xl font-semibold">Resumes <span className="font-sans text-base font-normal text-ink-soft">({files.length})</span></h2>
            </div>
            <FileDrop multiple files={files} onChange={setFiles} title="Drop all the resumes here, or click to browse" hint="Select many at once · PDF, DOCX or TXT" />
          </Card>
        </div>
        {error && (
          <div role="alert" className="mt-6 flex items-start gap-3 rounded-2xl border border-reject/30 bg-reject-bg/70 px-5 py-4 text-reject">
            <AlertCircle size={20} className="mt-0.5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button onClick={run} disabled={!ready || phase === "reading-jd"} className={cx(btn.primary, "!px-7 !py-3.5 text-base")}>
            {phase === "reading-jd" ? <><Loader2 size={18} className="animate-spin" /> Reading the job description…</> : <>Screen {files.length || ""} resume{files.length === 1 ? "" : "s"} <ArrowRight size={18} /></>}
          </button>
          <button onClick={useSamples} className={btn.ghost}>
            <Wand2 size={16} /> Fill with sample data
          </button>
        </div>
      </>
    );

  /* ───── Results ───── */
  return (
    <>
      <PageHeader eyebrow={`Bulk upload · ${jobTitle}`} title={phase === "finished" ? "Shortlist ready." : "Screening in progress…"}>
        {phase === "running" && (
          <button onClick={() => (cancelled.current = true)} className={btn.ghost}>Stop after current</button>
        )}
        {phase === "finished" && (
          <div className="flex gap-2">
            <button onClick={reset} className={btn.ghost}>Screen another batch</button>
            <Link href="/candidates" className={btn.primary}><Users size={16} /> Open dashboard</Link>
          </div>
        )}
      </PageHeader>

      <div className="mb-6 h-2 overflow-hidden rounded-full bg-paper-2" role="progressbar" aria-valuenow={doneCount} aria-valuemax={rows.length}>
        <div className="h-full rounded-full bg-forest transition-all duration-500" style={{ width: `${(doneCount / rows.length) * 100}%` }} />
      </div>
      <p className="mb-4 text-sm text-ink-soft">{doneCount} of {rows.length} resumes screened{phase === "finished" ? " · ranked by match score" : ""}</p>

      <Card className="overflow-hidden">
        <ul className="divide-y divide-line">
          {sorted.map(({ r, i }, rank) => (
            <li key={i} className="grid items-center gap-x-6 gap-y-3 px-5 py-4 md:grid-cols-[2rem_minmax(0,1.3fr)_5rem_11rem_minmax(0,1.2fr)]">
              <span className="font-display hidden text-xl font-semibold text-ink-faint md:block">{phase === "finished" && r.res.state === "done" ? rank + 1 : ""}</span>
              {r.res.state === "done" ? (
                <>
                  <Link href={`/candidates/${r.res.id}`} className="group min-w-0">
                    <p className="truncate font-semibold group-hover:text-forest group-hover:underline">{r.res.report.candidate.name}</p>
                    <p className="truncate text-sm text-ink-soft">{r.res.report.candidate.currentRole || r.file.name}</p>
                  </Link>
                  <span className="font-display text-3xl font-semibold leading-none">{r.res.report.score}</span>
                  <VerdictBadge verdict={r.res.report.verdict} />
                  <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
                    {r.res.hr !== "pending" && <StatusBadge status={r.res.hr} />}
                    {(
                      [
                        ["accepted", CheckCircle2, "Accept", "Accept", "hover:bg-accept-bg hover:text-accept"],
                        ["talk", MessageCircleQuestion, "Talk to candidate", "Call", "hover:bg-talk-bg hover:text-talk"],
                        ["rejected", XCircle, "Reject", "Reject", "hover:bg-reject-bg hover:text-reject"],
                      ] as const
                    ).map(([s, Icon, label, short, hover]) => (
                      <button
                        key={s}
                        onClick={() => decide(i, (r.res as { id: number }).id, s)}
                        title={label}
                        aria-label={`${label}: ${r.res.state === "done" ? r.res.report.candidate.name : ""}`}
                        aria-pressed={(r.res as { hr: HrStatus }).hr === s}
                        className={cx("inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors", hover, (r.res as { hr: HrStatus }).hr === s && "border-ink bg-ink text-paper hover:bg-ink hover:text-paper")}
                      >
                        <Icon size={14} />
                        {short}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="min-w-0 md:col-span-1">
                    <p className="truncate font-medium">{r.file.name}</p>
                    {r.res.state === "error" && <p className="text-sm text-reject">{r.res.error}</p>}
                  </div>
                  <span />
                  <span className="flex items-center gap-2 text-sm text-ink-soft">
                    {r.res.state === "running" && <><Loader2 size={15} className="animate-spin text-forest" /> Analysing…</>}
                    {r.res.state === "queued" && "Waiting"}
                    {r.res.state === "error" && (
                      <button onClick={() => analyzeOne(i, r.file)} disabled={phase === "running"} className={cx(btn.ghost, "!px-3.5 !py-1.5 text-xs")}>
                        <RotateCcw size={13} /> Retry
                      </button>
                    )}
                  </span>
                  <span />
                </>
              )}
            </li>
          ))}
        </ul>
      </Card>
      {phase === "finished" && <p className="mt-4 text-sm text-ink-soft">Decisions you make here are saved instantly. Click a name to open the full report.</p>}
    </>
  );
}
