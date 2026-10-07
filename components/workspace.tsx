"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Loader2,
  Lock,
  MessageCircleQuestion,
  RotateCcw,
  ShieldAlert,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { ConfirmDialog } from "./confirm";
import { FileDrop, JdInput, jdFormData, jdReady, type JdValue } from "./inputs";
import { Card, VerdictBadge, btn, cx } from "./ui";
import { gateMissing } from "@/lib/gate";
import type { CandidateRow, DupRef, HrStatus, JobRow, Report } from "@/lib/types";

type RowState =
  | { state: "queued" }
  | { state: "running" }
  | { state: "error"; error: string }
  | { state: "done"; id: number; report: Report; hr: HrStatus; dups: number; dupTip: string; created: string };

interface Row {
  uid: number;
  name: string;
  file?: File;
  res: RowState;
}

interface Stats {
  total: number;
  pending: number;
  accepted: number;
  avgScore: number;
}

interface SavedJob {
  id: number;
  title: string;
  candidates: number;
}

type VerdictFilter = "all" | "accept" | "talk" | "reject" | "ineligible";
type Sort = "score_desc" | "score_asc" | "name" | "recent";

const LAST_JOB = "talentlens.job";

/** Remember the open job for this session and tell the assistant which job HR is looking at. */
function rememberJob(id: number | null) {
  try {
    if (id) sessionStorage.setItem(LAST_JOB, String(id));
    else sessionStorage.removeItem(LAST_JOB);
  } catch {}
  window.dispatchEvent(new Event("talentlens:job"));
}

const DECISIONS = [
  { status: "accepted", icon: CheckCircle2, label: "Accept — move to L1/L2", short: "Accept", on: "border-accept bg-accept text-on-solid", hover: "hover:border-accept/50 hover:bg-accept-bg hover:text-accept" },
  { status: "talk", icon: MessageCircleQuestion, label: "Talk to candidate first", short: "Talk", on: "border-talk bg-talk text-on-solid", hover: "hover:border-talk/50 hover:bg-talk-bg hover:text-talk" },
  { status: "rejected", icon: XCircle, label: "Reject", short: "Reject", on: "border-reject bg-reject text-on-solid", hover: "hover:border-reject/50 hover:bg-reject-bg hover:text-reject" },
] as const;

// One grid for the header and every row so the columns line up. Skills and "Full report" only show on wide screens.
const GRID =
  "md:grid-cols-[1.5rem_minmax(0,1fr)_4rem_9.5rem_16rem_2rem] xl:grid-cols-[1.5rem_minmax(0,1.1fr)_4rem_9.5rem_minmax(0,1.2fr)_16rem_9rem]";

const field =
  "w-full cursor-pointer appearance-none rounded-xl border border-line-strong bg-paper/50 py-2.5 pl-4 pr-10 outline-none transition focus:border-forest focus:bg-card focus:ring-4 focus:ring-forest/10";

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-forest font-mono text-sm text-paper">{n}</span>
      <h2 className="font-display text-2xl font-semibold">{children}</h2>
    </div>
  );
}

function ScorePill({ score, verdict }: { score: number; verdict: Report["verdict"] }) {
  const tone = verdict === "accept" ? "bg-accept-bg text-accept" : verdict === "talk" ? "bg-talk-bg text-talk" : "bg-reject-bg text-reject";
  return <span className={cx("inline-block min-w-[3.5rem] rounded-full px-3 py-1 text-center font-mono text-sm font-semibold", tone)}>{score}</span>;
}

function SkillChips({ report }: { report: Report }) {
  const matched = report.skills.filter((s) => s.status === "present").sort((a, b) => Number(b.type === "must") - Number(a.type === "must"));
  if (!matched.length) return <span className="text-sm text-ink-faint">No matching skills found</span>;
  return (
    <>
      {matched.slice(0, 3).map((s) => (
        <span key={s.id} className="max-w-[10rem] truncate rounded-md border border-line bg-paper/60 px-2 py-0.5 text-xs text-ink-soft" title={s.requirement}>
          {s.requirement}
        </span>
      ))}
      {matched.length > 3 && <span className="text-xs text-ink-faint">+{matched.length - 3}</span>}
    </>
  );
}

const dupTipOf = (d: DupRef) =>
  d.basis === "file"
    ? `The same resume file was already screened for "${d.job_title}" on ${fmtDay(d.created_at)}.`
    : `${d.basis === "email" ? "Same email" : "Same name"} as ${d.name}, already screened for "${d.job_title}" on ${fmtDay(d.created_at)} (match ${d.score}).`;

export default function Workspace({ engineReady }: { engineReady: boolean }) {
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [job, setJob] = useState<JobRow | null>(null); // the job being worked on (saved or just created)
  const [jd, setJd] = useState<JdValue>({ text: "", file: null });
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [loadingJob, setLoadingJob] = useState(false);
  const [error, setError] = useState("");
  const [notices, setNotices] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>("all");
  const [decisionFilter, setDecisionFilter] = useState<HrStatus | "all">("all");
  const [sort, setSort] = useState<Sort>("score_desc");
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const cancelled = useRef(false);
  const uid = useRef(0);

  // Numbers follow the selected job; with no job selected they cover everything.
  const jobId = job?.id;
  const loadStats = useCallback(() => {
    fetch(jobId ? `/api/stats?jobId=${jobId}` : "/api/stats").then((r) => r.json()).then((d) => typeof d.total === "number" && setStats(d)).catch(() => {});
  }, [jobId]);

  const loadSavedJobs = useCallback(async (): Promise<SavedJob[]> => {
    try {
      const list = await (await fetch("/api/jobs")).json();
      if (Array.isArray(list)) {
        setSavedJobs(list);
        return list;
      }
    } catch {}
    return [];
  }, []);

  const toRow = useCallback(
    (c: CandidateRow): Row => ({
      uid: uid.current++,
      name: c.name,
      res: {
        state: "done",
        id: c.id,
        report: c.report!,
        hr: c.hr_status,
        dups: c.dup_count,
        dupTip: c.dup_count ? `Looks like ${c.dup_count} other record${c.dup_count === 1 ? "" : "s"} of the same person.` : "",
        created: c.created_at,
      },
    }),
    [],
  );

  /** Open a saved job: its requirements and everyone already screened for it. */
  const openJob = useCallback(
    async (id: number) => {
      setLoadingJob(true);
      setError("");
      try {
        const [jr, cr] = await Promise.all([fetch(`/api/jobs/${id}`), fetch(`/api/candidates?jobId=${id}&report=1`)]);
        const j = await jr.json();
        if (!jr.ok) throw new Error(j.error ?? "Couldn't open that job.");
        const list = await cr.json();
        if (!Array.isArray(list)) throw new Error(list.error ?? "Couldn't load the candidates.");
        setJob(j);
        setRows(list.map(toRow));
        setNotices([]);
        rememberJob(id);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoadingJob(false);
      }
    },
    [toRow],
  );

  // On arrival: numbers, the saved-jobs list, and the job HR was last working on.
  useEffect(() => {
    void (async () => {
      const list = await loadSavedJobs();
      try {
        const last = Number(sessionStorage.getItem(LAST_JOB));
        if (last && list.some((j) => j.id === last)) await openJob(last);
      } catch {}
    })();
  }, [loadSavedJobs, openJob]);

  // Refresh the numbers on arrival and whenever the selected job changes.
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const ready = jdReady(jd) && files.length > 0;
  const readyWithJob = !!job && files.length > 0;
  const patch = (u: number, res: RowState) => setRows((r) => r.map((x) => (x.uid === u ? { ...x, res } : x)));

  function pickJob(value: string) {
    setFiles([]);
    setJd({ text: "", file: null });
    setVerdictFilter("all");
    setDecisionFilter("all");
    if (value === "new") {
      setJob(null);
      setRows([]);
      setNotices([]);
      rememberJob(null);
    } else void openJob(Number(value));
  }

  async function analyzeOne(row: Row, jobId: number) {
    patch(row.uid, { state: "running" });
    try {
      const fd = new FormData();
      fd.append("jobId", String(jobId));
      fd.append("resume", row.file!);
      fd.append("source", "bulk");
      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed.");
      const dups: DupRef[] = data.duplicates ?? [];

      if (data.reused) {
        // Same file, same job: the earlier result is already in the list (or will be shown now) — never twice.
        setNotices((n) => [...n, `${row.name} was already screened for this job — the earlier result is kept.`]);
        setRows((rs) =>
          rs.some((r) => r.res.state === "done" && r.res.id === data.id)
            ? rs.filter((r) => r.uid !== row.uid)
            : rs.map((r) => (r.uid === row.uid ? { ...r, res: { state: "done", id: data.id, report: data.report, hr: data.hr_status, dups: dups.length, dupTip: dups[0] ? dupTipOf(dups[0]) : "", created: new Date().toISOString() } } : r)),
        );
        return;
      }
      patch(row.uid, { state: "done", id: data.id, report: data.report, hr: "pending", dups: dups.length, dupTip: dups[0] ? dupTipOf(dups[0]) : "", created: new Date().toISOString() });
    } catch (e) {
      patch(row.uid, { state: "error", error: (e as Error).message });
    }
  }

  async function run() {
    setError("");
    setNotices([]);
    cancelled.current = false;
    setRunning(true);

    let active = job;
    let keep = rows;
    if (!active) {
      // A new job description: read it (or recognise it as one we already saved).
      try {
        const res = await fetch("/api/jobs", { method: "POST", body: jdFormData(jd) });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "Couldn't read the job description.");
        active = j as JobRow;
        setJob(active);
        keep = [];
        if (j.existing) {
          const cr = await (await fetch(`/api/candidates?jobId=${j.id}&report=1`)).json();
          keep = Array.isArray(cr) ? cr.map(toRow) : [];
          setNotices(["This job description was already saved — using the saved job and its shortlist."]);
        }
        rememberJob(j.id);
        void loadSavedJobs();
        setJd({ text: "", file: null });
      } catch (e) {
        setError((e as Error).message);
        setRunning(false);
        return;
      }
    }

    const batch: Row[] = files.map((file) => ({ uid: uid.current++, name: file.name, file, res: { state: "queued" } }));
    setRows([...keep, ...batch]);
    setFiles([]);

    // One at a time: gentle on rate limits and on a local Ollama model.
    const handled = new Set<number>();
    for (const row of batch) {
      if (cancelled.current) break;
      await analyzeOne(row, active.id);
      handled.add(row.uid);
    }
    if (cancelled.current) {
      // Give the unprocessed resumes back so nothing has to be re-added.
      setFiles(batch.filter((b) => !handled.has(b.uid)).map((b) => b.file!));
      setRows((r) => r.filter((x) => x.res.state !== "queued"));
    }
    setRunning(false);
    loadStats();
    void loadSavedJobs();
  }

  async function decide(row: Row, status: HrStatus) {
    if (row.res.state !== "done" || row.res.hr === status) return;
    const res = await fetch(`/api/candidates/${row.res.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      patch(row.uid, { ...row.res, hr: status });
      loadStats();
    }
  }

  async function confirmDelete() {
    const row = toDelete;
    if (!row || row.res.state !== "done") return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/candidates/${row.res.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't delete that entry.");
      setRows((rs) => rs.filter((r) => r.uid !== row.uid));
      setToDelete(null);
      loadStats();
      void loadSavedJobs();
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  /** Click a skill to make it mandatory (or not). Everyone already screened is re-checked on the server too. */
  async function toggleMandatory(reqId: string) {
    if (!job) return;
    const prev = job;
    const reqs = job.requirements.requirements.map((r) => (r.id === reqId ? { ...r, mandatory: !r.mandatory } : r));
    setJob({ ...job, requirements: { ...job.requirements, requirements: reqs } });
    const res = await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mandatory: reqs.filter((r) => r.mandatory).map((r) => r.id) }),
    });
    if (!res.ok) {
      setJob(prev);
      setError((await res.json().catch(() => ({}))).error ?? "Couldn't save that change.");
    }
  }

  function startOver() {
    pickJob("new");
    setError("");
  }

  /* ───── derived: eligibility, filters, sorting ───── */
  const reqs = job?.requirements.requirements ?? [];
  const missingOf = (r: Row) => (r.res.state === "done" ? gateMissing(reqs, r.res.report.skills) : []);
  const done = rows.filter((r) => r.res.state === "done");
  const ineligibleCount = done.filter((r) => missingOf(r).length).length;
  const mandatoryCount = reqs.filter((r) => r.mandatory).length;
  const finished = rows.filter((r) => r.res.state === "done" || r.res.state === "error").length;
  const decided = done.filter((r) => r.res.state === "done" && r.res.hr !== "pending").length;

  const verdictCounts = {
    all: done.length,
    accept: done.filter((r) => r.res.state === "done" && r.res.report.verdict === "accept" && !missingOf(r).length).length,
    talk: done.filter((r) => r.res.state === "done" && r.res.report.verdict === "talk" && !missingOf(r).length).length,
    reject: done.filter((r) => r.res.state === "done" && r.res.report.verdict === "reject" && !missingOf(r).length).length,
    ineligible: ineligibleCount,
  };

  const score = (r: Row) => (r.res.state === "done" ? r.res.report.score : -1);
  const matches = (r: Row) => {
    if (r.res.state !== "done") return true;
    const bad = missingOf(r).length > 0;
    if (verdictFilter === "ineligible" && !bad) return false;
    if (["accept", "talk", "reject"].includes(verdictFilter) && (bad || r.res.report.verdict !== verdictFilter)) return false;
    return decisionFilter === "all" || r.res.hr === decisionFilter;
  };
  const doneRows = rows
    .filter((r) => r.res.state === "done" && matches(r))
    .sort((a, b) => {
      if (sort === "score_asc") return score(a) - score(b);
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "recent") return b.uid - a.uid;
      // Best match first — but people who fail a mandatory skill go below everyone eligible.
      return Number(missingOf(a).length > 0) - Number(missingOf(b).length > 0) || score(b) - score(a);
    });
  const otherRows = rows.filter((r) => r.res.state !== "done"); // still waiting, running, or failed
  const ordered = [...doneRows, ...otherRows];
  const filtered = verdictFilter !== "all" || decisionFilter !== "all";

  const kpis = [
    { k: "Resumes screened", v: stats?.total, sub: job ? "For this job" : "All time" },
    { k: "Average match", v: stats ? `${stats.avgScore}%` : undefined, sub: job ? "Across this job's candidates" : "Across all candidates" },
    { k: "Accepted", v: stats?.accepted, sub: "Moving to L1 / L2", tone: "text-accept" },
    { k: "Waiting for your decision", v: stats?.pending, sub: "Open the Candidates tab", tone: "text-pending" },
  ];

  const pills: { key: VerdictFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "accept", label: "Accept" },
    { key: "talk", label: "Talk" },
    { key: "reject", label: "Reject" },
    ...(mandatoryCount ? [{ key: "ineligible" as const, label: "Not eligible" }] : []),
  ];

  const mustList = reqs.filter((r) => r.type === "must");
  const niceList = reqs.filter((r) => r.type === "nice");

  return (
    <>
      {/* ── Title ── */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">AI-powered Candidate Screening</h1>
          <p className="mt-1 text-ink-soft">Select or add a job description, upload one or more resumes, then click Screen.</p>
        </div>
        <div className="flex gap-2">
          {(rows.length > 0 || !!job || jdReady(jd) || files.length > 0) && (
            <button onClick={startOver} disabled={running} className={btn.quiet}>
              <RotateCcw size={15} /> Start over
            </button>
          )}
        </div>
      </div>

      {!engineReady && (
        <Link href="/settings" className="mb-6 flex items-center gap-3 rounded-2xl border border-talk/40 bg-talk-bg px-5 py-3.5 text-talk transition-colors hover:bg-talk-bg/70">
          <AlertCircle size={20} className="shrink-0" />
          <p className="flex-1 text-sm">
            <b>One-time setup:</b> the AI engine isn&apos;t connected yet. Open Settings to add it before screening.
          </p>
          <ChevronRight size={18} />
        </Link>
      )}

      {/* ── Job filter: pick a JD and the page shows the resumes screened for it ── */}
      {(savedJobs.length > 0 || job) && (
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-card px-5 py-4 shadow-soft">
          <label htmlFor="savedjob" className="text-sm font-medium">
            Show resumes for job description
          </label>
          <div className="relative min-w-0 flex-1 basis-72">
            <select id="savedjob" value={job ? String(job.id) : "new"} onChange={(e) => pickJob(e.target.value)} disabled={running || loadingJob} className={field}>
              <option value="new">＋ New job description</option>
              {savedJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} · {j.candidates} candidate{j.candidates === 1 ? "" : "s"}
                </option>
              ))}
            </select>
            <ChevronDown size={18} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-soft" />
          </div>
          {loadingJob && <Loader2 size={18} className="animate-spin text-forest" />}
        </div>
      )}

      {/* ── Numbers ── */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((c, i) => (
          <div key={c.k} style={{ animationDelay: `${i * 50}ms` }} className="animate-rise rounded-2xl border border-line bg-card px-5 py-4 shadow-soft">
            <p className="eyebrow !text-[0.66rem]">{c.k}</p>
            <p className={cx("font-display mt-1.5 text-3xl font-semibold leading-none", c.tone)}>{c.v ?? "–"}</p>
            <p className="mt-1.5 text-xs text-ink-soft">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Inputs ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <Step n={1}>Job description</Step>

          {loadingJob ? (
            <div className="skeleton h-40 rounded-xl" />
          ) : job ? (
            <div key={job.id} className="animate-tab">
              <p className="font-display text-xl font-semibold leading-snug">{job.title}</p>
              {job.requirements.summary && <p className="mt-1 text-sm text-ink-soft">{job.requirements.summary}</p>}
              <p className="mt-1 text-xs text-ink-faint">
                {[job.requirements.experienceNote, job.requirements.education].filter((x) => x && x !== "Not specified").join(" · ")}
              </p>

              <div className="mt-4 rounded-xl border border-line bg-paper/40 p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Lock size={14} className="text-forest" /> Make a skill mandatory
                  <span className={cx("rounded-full px-2 py-0.5 text-xs font-semibold", mandatoryCount ? "bg-forest text-paper" : "bg-paper-2 text-ink-soft")}>
                    {mandatoryCount ? `${mandatoryCount} selected` : "None selected"}
                  </span>
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  Click any skill below to require it. Candidates whose resume lacks a mandatory skill are flagged <b>Not eligible</b>, whatever their score.
                </p>
                {[
                  ["Must-have", mustList],
                  ["Nice-to-have", niceList],
                ].map(([label, list]) =>
                  (list as typeof reqs).length ? (
                    <div key={label as string} className="mt-3">
                      <p className="eyebrow mb-1.5 !text-[0.62rem]">{label as string}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(list as typeof reqs).map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => toggleMandatory(r.id)}
                            aria-pressed={!!r.mandatory}
                            title={r.mandatory ? "Mandatory — click to make optional" : "Click to make mandatory"}
                            className={cx(
                              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
                              r.mandatory ? "border-forest bg-forest font-medium text-paper" : "border-line-strong bg-card text-ink hover:border-forest/60 hover:bg-moss/40",
                            )}
                          >
                            {r.mandatory && <Lock size={12} />}
                            {r.text}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null,
                )}
              </div>

              <details className="group mt-3 text-sm">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-forest">
                  <ChevronRight size={15} className="transition-transform group-open:rotate-90" /> Show the full job description
                </summary>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-paper/50 p-3 font-sans text-xs leading-relaxed text-ink-soft">{job.jd_text}</pre>
              </details>
            </div>
          ) : (
            <>
              <JdInput value={jd} onChange={setJd} />
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-moss/50 px-3.5 py-2.5 text-sm text-ink-soft">
                <Lock size={15} className="mt-0.5 shrink-0 text-forest" />
                <span>
                  <b className="text-ink">Tip:</b> once the job is read, you can make any skill <b className="text-ink">mandatory</b>. Candidates who lack one are flagged Not eligible.
                </span>
              </p>
            </>
          )}
        </Card>

        <Card className="flex flex-col p-6">
          <Step n={2}>
            Resumes {files.length > 0 && <span className="font-sans text-base font-normal text-ink-soft">({files.length})</span>}
          </Step>
          <FileDrop multiple fill files={files} onChange={setFiles} title="Drop resumes here, or click to browse" hint="One or many at once · PDF, DOCX or TXT" />

          {error && (
            <div role="alert" className="mt-4 flex items-start gap-3 rounded-xl border border-reject/30 bg-reject-bg/70 px-4 py-3 text-reject">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="mt-auto pt-5">
            <button onClick={run} disabled={!(job ? readyWithJob : ready) || running || loadingJob} className={cx(btn.primary, "w-full !py-3.5 text-base")}>
              {running ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Screening…
                </>
              ) : (
                <>
                  <Zap size={18} /> Screen {files.length > 1 ? `${files.length} resumes` : "resume"} <ArrowRight size={18} />
                </>
              )}
            </button>
            {!(job ? readyWithJob : ready) && !running && (
              <p className="mt-2 text-center text-sm text-ink-soft">{!job && !jdReady(jd) ? "Select a saved job or add a job description to begin." : "Add at least one resume to continue."}</p>
            )}
          </div>
        </Card>
      </div>

      {/* ── Shortlist ── */}
      <section className="mt-8" aria-live="polite">
        {notices.length > 0 && (
          <div className="mb-4 space-y-2">
            {notices.map((n, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-talk/30 bg-talk-bg/60 px-4 py-2.5 text-sm text-talk">
                <Copy size={16} className="mt-0.5 shrink-0" />
                <p className="flex-1">{n}</p>
                <button onClick={() => setNotices((x) => x.filter((_, j) => j !== i))} aria-label="Dismiss" className="rounded-full p-0.5 hover:bg-talk/10">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong bg-paper-2/30 px-6 py-10 text-center">
            <p className="font-display text-2xl font-semibold">{job ? "No one has been screened for this job yet" : "Your ranked shortlist will appear here"}</p>
            <p className="mx-auto mt-1 max-w-xl text-ink-soft">
              {job ? "Add resumes above and press Screen." : "Candidates are ranked best match first, each with a clear recommendation. You make the final call in one click."}
            </p>
          </div>
        ) : (
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div className="min-w-0">
                <h2 className="font-display text-2xl font-semibold">Ranked shortlist</h2>
                <p className="truncate text-sm text-ink-soft">
                  {job?.title && <>{job.title} · </>}
                  {running ? `${finished} of ${rows.length} screened` : `${done.length} screened · ${decided} decided`}
                  {ineligibleCount > 0 && <span className="text-reject"> · {ineligibleCount} not eligible</span>}
                </p>
              </div>
              {running ? (
                <button onClick={() => (cancelled.current = true)} className={btn.ghost}>
                  Stop after current
                </button>
              ) : (
                <Link href="/candidates" className={btn.ghost}>
                  Open Candidates <ChevronRight size={16} />
                </Link>
              )}
            </div>
            {running && (
              <div className="h-1 bg-paper-2" role="progressbar" aria-valuenow={finished} aria-valuemax={rows.length}>
                <div className="h-full bg-forest transition-all duration-500" style={{ width: `${(finished / rows.length) * 100}%` }} />
              </div>
            )}

            {/* Filters and sorting */}
            {done.length > 1 && (
              <div className="flex flex-wrap items-center gap-3 border-b border-line bg-paper-2/30 px-5 py-3">
                <div className="inline-flex flex-wrap rounded-full border border-line-strong bg-card/70 p-1 text-sm" role="group" aria-label="Filter by AI suggestion">
                  {pills.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setVerdictFilter(p.key)}
                      aria-pressed={verdictFilter === p.key}
                      className={cx("rounded-full px-3 py-1 font-medium transition-colors", verdictFilter === p.key ? (p.key === "ineligible" ? "bg-reject text-on-solid" : "bg-forest text-paper") : "text-ink-soft hover:text-ink")}
                    >
                      {p.label} <span className="font-mono text-xs opacity-70">{verdictCounts[p.key]}</span>
                    </button>
                  ))}
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
                  <label className="sr-only" htmlFor="decfilter">Filter by your decision</label>
                  <div className="relative">
                    <select id="decfilter" value={decisionFilter} onChange={(e) => setDecisionFilter(e.target.value as HrStatus | "all")} className="cursor-pointer appearance-none rounded-full border border-line-strong bg-card py-1.5 pl-3.5 pr-9 outline-none focus:border-forest">
                      <option value="all">Any decision</option>
                      <option value="pending">Waiting for decision</option>
                      <option value="accepted">Accepted</option>
                      <option value="talk">Talk to candidate</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                  </div>
                  <label className="sr-only" htmlFor="sort">Sort by</label>
                  <div className="relative">
                    <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="cursor-pointer appearance-none rounded-full border border-line-strong bg-card py-1.5 pl-3.5 pr-9 outline-none focus:border-forest">
                      <option value="score_desc">Best match first</option>
                      <option value="score_asc">Lowest match first</option>
                      <option value="name">Name A–Z</option>
                      <option value="recent">Newest first</option>
                    </select>
                    <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                  </div>
                </div>
              </div>
            )}

            <div className={cx("eyebrow hidden items-center gap-x-5 border-b border-line bg-paper-2/50 px-5 py-2.5 !text-[0.66rem] md:grid", GRID)}>
              <span />
              <span>Candidate</span>
              <span>Match</span>
              <span>AI suggests</span>
              <span className="hidden xl:block">Key skills</span>
              <span>Your decision</span>
              <span />
            </div>

            <ul className="divide-y divide-line">
              {ordered.length === 0 && (
                <li className="px-5 py-10 text-center text-ink-soft">
                  No one matches these filters.{" "}
                  <button onClick={() => (setVerdictFilter("all"), setDecisionFilter("all"))} className="font-medium text-forest underline">
                    Show everyone
                  </button>
                </li>
              )}
              {ordered.map((r, rank) => {
                const missing = missingOf(r);
                return (
                  <li key={r.uid} className={cx("animate-row grid items-center gap-x-5 gap-y-3 px-5 py-4", GRID, missing.length > 0 && "bg-reject-bg/20")}>
                    <span className="font-display hidden text-xl font-semibold text-ink-faint md:block">
                      {!running && r.res.state === "done" && sort === "score_desc" && !filtered ? rank + 1 : ""}
                    </span>

                    {r.res.state === "done" ? (
                      <>
                        <div className="min-w-0">
                          <Link href={`/candidates/${r.res.id}`} className="group block min-w-0">
                            <p className="truncate font-semibold group-hover:text-forest group-hover:underline">{r.res.report.candidate.name}</p>
                            <p className="truncate text-sm text-ink-soft">{r.res.report.candidate.currentRole || r.name}</p>
                          </Link>
                          {r.res.dups > 0 && (
                            <Link href={`/candidates/${r.res.id}#duplicates`} title={`${r.res.dupTip} Click to review or merge them.`} className="mt-1 inline-flex items-center gap-1 rounded-full bg-talk-bg px-2 py-0.5 text-xs font-medium text-talk hover:bg-talk/15">
                              <Copy size={11} /> Seen before
                            </Link>
                          )}
                        </div>
                        <ScorePill score={r.res.report.score} verdict={r.res.report.verdict} />
                        <div className="min-w-0">
                          {missing.length ? (
                            <>
                              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-reject px-2.5 py-1 text-xs font-semibold text-on-solid">
                                <ShieldAlert size={13} /> Not eligible
                              </span>
                              <p className="mt-1 line-clamp-2 break-words text-xs leading-snug text-reject" title={`Missing mandatory: ${missing.join(", ")}`}>
                                Missing: {missing.join(", ")}
                              </p>
                            </>
                          ) : (
                            <VerdictBadge verdict={r.res.report.verdict} />
                          )}
                        </div>
                        <div className="hidden min-w-0 flex-wrap items-center gap-1.5 xl:flex">
                          <SkillChips report={r.res.report} />
                        </div>
                        <div className="flex items-center gap-1.5" role="group" aria-label={`Decision for ${r.res.report.candidate.name}`}>
                          {DECISIONS.map((d) => {
                            const active = r.res.state === "done" && r.res.hr === d.status;
                            return (
                              <button
                                key={d.status}
                                onClick={() => decide(r, d.status)}
                                title={d.label}
                                aria-pressed={active}
                                className={cx(
                                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                                  active ? d.on : cx("border-line-strong text-ink-soft", d.hover),
                                )}
                              >
                                <d.icon size={14} />
                                {d.short}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between gap-2 md:justify-end">
                          <Link href={`/candidates/${r.res.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline md:hidden xl:inline-flex">
                            Full report <ChevronRight size={15} />
                          </Link>
                          <button
                            onClick={() => (setDeleteError(""), setToDelete(r))}
                            disabled={running}
                            aria-label={`Delete ${r.res.report.candidate.name}`}
                            title="Delete this entry"
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:bg-reject-bg hover:text-reject disabled:opacity-40"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{r.name}</p>
                          {r.res.state === "error" && <p className="text-sm text-reject">{r.res.error}</p>}
                        </div>
                        <span className="flex items-center gap-2 text-sm text-ink-soft md:col-span-2">
                          {r.res.state === "running" && (
                            <>
                              <Loader2 size={15} className="animate-spin text-forest" /> Reading…
                            </>
                          )}
                          {r.res.state === "queued" && "Waiting"}
                          {r.res.state === "error" && r.file && job && (
                            <button onClick={() => analyzeOne(r, job.id)} disabled={running} className={cx(btn.ghost, "!px-3.5 !py-1.5 text-xs")}>
                              <RotateCcw size={13} /> Retry
                            </button>
                          )}
                        </span>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>

      {toDelete && toDelete.res.state === "done" && (
        <ConfirmDialog
          title="Delete this entry?"
          message={`Do you want "${toDelete.res.report.candidate.name}" to be deleted permanently? This removes the candidate and their screening report from the database and can't be undone.`}
          busy={deleting}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </>
  );
}
