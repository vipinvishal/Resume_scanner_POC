"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Copy, Download, ListChecks, Search, ShieldAlert, Users, X, Zap } from "lucide-react";
import type { CandidateRow, HrStatus } from "@/lib/types";
import ActivityLog from "@/components/activity";
import { ConfirmDialog } from "@/components/confirm";
import Overview from "@/components/overview";
import { Card, PageHeader, StatusBadge, VerdictBadge, btn, cx, formatDate } from "@/components/ui";

interface Stats {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  talk: number;
  avgScore: number;
}
interface Job {
  id: number;
  title: string;
  candidates: number;
}

const localDay = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const RANGES = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "week", label: "Last 7 days" },
] as const;

const STATUS_TABS: { key: HrStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "accepted", label: "Accepted" },
  { key: "talk", label: "Talk to candidate" },
  { key: "rejected", label: "Rejected" },
];

function CandidatesList() {
  const [status, setStatus] = useState<HrStatus | "all">("all");
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("all");
  const [jobId, setJobId] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [rows, setRows] = useState<CandidateRow[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<CandidateRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [reload, setReload] = useState(0);
  const [loadedKey, setLoadedKey] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    fetch("/api/jobs").then((r) => r.json()).then(setJobs).catch(() => {});
  }, []);

  const dateParams = useMemo(() => {
    const p = new URLSearchParams();
    if (range === "today") {
      p.set("from", localDay());
      p.set("to", localDay());
    }
    if (range === "week") {
      p.set("from", localDay(6));
      p.set("to", localDay());
    }
    return p;
  }, [range]);

  const listParams = useMemo(() => {
    const p = new URLSearchParams(dateParams);
    if (status !== "all") p.set("status", status);
    if (jobId) p.set("jobId", jobId);
    if (debouncedQ) p.set("q", debouncedQ);
    return p.toString();
  }, [dateParams, status, jobId, debouncedQ]);

  useEffect(() => {
    let live = true;
    Promise.all([
      fetch(`/api/candidates?${listParams}`).then((r) => r.json()),
      fetch("/api/stats").then((r) => r.json()), // everyone, ignoring filters: only tells "no candidates yet" from "none match"
    ]).then(([list, st]) => {
      if (!live) return;
      // A broken database connection comes back as { error } instead of a list.
      setError(Array.isArray(list) ? "" : (list?.error ?? "Couldn't load candidates."));
      setRows(Array.isArray(list) ? list : []);
      setStats(st?.error ? null : st);
      setLoadedKey(`${listParams}|${reload}`);
    });
    return () => {
      live = false;
    };
  }, [listParams, reload]);

  const shown = rows;
  const loading = loadedKey !== `${listParams}|${reload}`; // what is on screen is from an older filter

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/candidates/${toDelete.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't delete that entry.");
      setToDelete(null);
      setReload((n) => n + 1);
      fetch("/api/jobs").then((r) => r.json()).then(setJobs).catch(() => {});
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  // The boxes count exactly what the list below shows, so every filter (status, date, job, search) moves them.
  const count = (st: HrStatus) => rows?.filter((r) => r.hr_status === st).length;
  const cards = [
    { k: "Screened", v: rows?.length, tone: "text-ink", bar: "bg-ink" },
    { k: "Accepted", v: count("accepted"), tone: "text-accept", bar: "bg-accept" },
    { k: "Talk to candidate", v: count("talk"), tone: "text-talk", bar: "bg-talk" },
    { k: "Rejected", v: count("rejected"), tone: "text-reject", bar: "bg-reject" },
    { k: "Pending review", v: count("pending"), tone: "text-pending", bar: "bg-pending" },
  ];

  return (
    <>
      <PageHeader eyebrow="Dashboard" title="Candidates">
        <div className="flex gap-2">
          <a href={`/api/candidates/export?${listParams}`} className={btn.ghost}><Download size={16} /> Export CSV</a>
          <Link href="/home" className={btn.primary}><Zap size={16} /> Screen resumes</Link>
        </div>
      </PageHeader>

      {/* Summary */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
        {cards.map((c, i) => (
          <div key={c.k} style={{ animationDelay: `${i * 50}ms` }} className="animate-rise relative overflow-hidden rounded-2xl border border-line bg-card p-5 shadow-soft">
            <span className={cx("absolute inset-x-0 top-0 h-1", c.bar)} />
            <p className={cx("font-display text-4xl font-semibold leading-none", c.tone)}>{c.v ?? "–"}</p>
            <p className="eyebrow mt-2.5 !text-[0.66rem]">{c.k}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex flex-wrap rounded-full border border-line-strong bg-paper-2/60 p-1 text-sm">
          {STATUS_TABS.map((t) => (
            <button key={t.key} onClick={() => setStatus(t.key)} className={cx("rounded-full px-3.5 py-1.5 font-medium transition-colors", status === t.key ? "bg-forest text-paper shadow-soft" : "text-ink-soft hover:text-ink")}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-full border border-line-strong bg-paper-2/60 p-1 text-sm">
          {RANGES.map((t) => (
            <button key={t.key} onClick={() => setRange(t.key)} className={cx("rounded-full px-3.5 py-1.5 font-medium transition-colors", range === t.key ? "bg-ink text-paper shadow-soft" : "text-ink-soft hover:text-ink")}>
              {t.label}
            </button>
          ))}
        </div>
        <select value={jobId} onChange={(e) => setJobId(e.target.value)} aria-label="Filter by job" className="rounded-full border border-line-strong bg-card px-4 py-2 text-sm outline-none focus:border-forest">
          <option value="">All jobs</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>{j.title} ({j.candidates})</option>
          ))}
        </select>
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, role or skill…" aria-label="Search candidates" className="w-full rounded-full border border-line-strong bg-card py-2 pl-10 pr-4 text-sm outline-none focus:border-forest focus:ring-4 focus:ring-forest/10" />
        </div>
      </div>

      {/* Table. While a filter loads, the old list dims and then eases into the new one. */}
      <Card className={cx("overflow-hidden transition-opacity duration-200", loading && rows !== null && "pointer-events-none opacity-60")}>
        {rows === null ? (
          <div className="space-y-px">
            {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[72px]" />)}
          </div>
        ) : error ? (
          <div className="px-6 py-16 text-center">
            <p className="font-display text-2xl font-semibold text-reject">Can&apos;t reach the database</p>
            <p className="mx-auto mt-2 max-w-xl text-ink-soft">{error}</p>
            <Link href="/settings" className={cx(btn.primary, "mt-6")}>Open Settings</Link>
          </div>
        ) : shown!.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-moss text-forest"><Users size={24} /></span>
            <p className="font-display mt-5 text-2xl font-semibold">{stats?.total ? "No candidates match these filters" : "No candidates yet"}</p>
            <p className="mt-1 text-ink-soft">{stats?.total ? "Try a different filter or search." : "Screen your first resume and it will show up here."}</p>
            {!stats?.total && <Link href="/home" className={cx(btn.primary, "mt-6")}>Screen your first resume</Link>}
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[1060px] table-fixed text-left text-sm">
              {/* Fixed column widths: the columns stay put whatever the filters leave in the list. */}
              <colgroup>
                <col />
                <col className="w-48" />
                <col className="w-[6.5rem]" />
                <col className="w-[10.5rem]" />
                <col className="w-[10.5rem]" />
                <col className="w-[8.5rem]" />
                <col className="w-12" />
              </colgroup>
              <thead className="border-b border-line bg-paper-2/50">
                <tr className="eyebrow !text-[0.66rem]">
                  <th className="px-5 py-3 font-medium">Candidate</th>
                  <th className="px-3 py-3 font-medium">Job</th>
                  <th className="px-3 py-3 font-medium">Score</th>
                  <th className="px-3 py-3 font-medium">AI suggests</th>
                  <th className="px-3 py-3 font-medium">HR status</th>
                  <th className="px-5 py-3 font-medium">Screened</th>
                  <th className="px-3 py-3"><span className="sr-only">Delete</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown!.map((r) => (
                  <tr key={r.id} className="animate-row group relative transition-colors hover:bg-paper/70">
                    <td className="px-5 py-3.5">
                      <Link href={`/candidates/${r.id}`} className="font-semibold after:absolute after:inset-0 group-hover:text-forest">{r.name}</Link>
                      <p className="max-w-[16rem] truncate text-ink-soft">{r.current_role || r.email || r.file_name}</p>
                      {r.dup_count > 0 && (
                        <Link href={`/candidates/${r.id}#duplicates`} className="relative z-10 mt-1 inline-flex items-center gap-1 rounded-full bg-talk-bg px-2 py-0.5 text-xs font-medium text-talk hover:bg-talk/15" title="Looks like the same person as another record. Click to review or merge them.">
                          <Copy size={11} /> Seen before
                        </Link>
                      )}
                    </td>
                    <td className="max-w-[14rem] truncate px-3 py-3.5 text-ink-soft">{r.job_title}</td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="font-display w-8 text-xl font-semibold">{r.score}</span>
                        <span className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-paper-2 lg:block">
                          <span className={cx("block h-full rounded-full", r.ai_verdict === "accept" ? "bg-accept" : r.ai_verdict === "talk" ? "bg-talk" : "bg-reject")} style={{ width: `${r.score}%` }} />
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      {r.gate_missing.length ? (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-reject px-2.5 py-1 text-xs font-semibold text-on-solid" title={`Missing mandatory: ${r.gate_missing.join(", ")}`}>
                          <ShieldAlert size={13} /> Not eligible
                        </span>
                      ) : (
                        <VerdictBadge verdict={r.ai_verdict} />
                      )}
                    </td>
                    <td className="px-3 py-3.5"><StatusBadge status={r.hr_status} /></td>
                    <td className="px-5 py-3.5 font-mono text-xs text-ink-soft">{formatDate(r.created_at)}</td>
                    <td className="px-3 py-3.5">
                      <button
                        onClick={() => (setDeleteError(""), setToDelete(r))}
                        aria-label={`Delete ${r.name}`}
                        title="Delete this entry"
                        className="relative z-10 grid h-8 w-8 place-items-center rounded-full text-ink-faint transition-colors hover:bg-reject-bg hover:text-reject"
                      >
                        <X size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {toDelete && (
        <ConfirmDialog
          title="Delete this entry?"
          message={`Do you want "${toDelete.name}" to be deleted permanently? This removes the candidate and their screening report from the database and can't be undone.`}
          busy={deleting}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
      {shown && !error && shown.length > 0 && <p className="mt-3 text-sm text-ink-soft">{shown.length} candidate{shown.length === 1 ? "" : "s"} shown</p>}
    </>
  );
}

type View = "list" | "overview" | "activity";

const VIEWS: { key: View; label: string; icon: React.ElementType }[] = [
  { key: "list", label: "Candidates", icon: Users },
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "activity", label: "Activity log", icon: ListChecks },
];

/** The Candidates tab: the list, the charts and the activity log live side by side as three views. */
export default function Candidates() {
  const [view, setView] = useState<View>("list");
  return (
    <>
      <div className="mb-6 inline-flex flex-wrap rounded-full border border-line-strong bg-paper-2/60 p-1 text-sm" role="tablist" aria-label="Candidates views">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            role="tab"
            aria-selected={view === v.key}
            onClick={() => setView(v.key)}
            className={cx("inline-flex items-center gap-2 rounded-full px-4 py-2 font-medium transition-colors", view === v.key ? "bg-forest text-paper shadow-soft" : "text-ink-soft hover:text-ink")}
          >
            <v.icon size={16} /> {v.label}
          </button>
        ))}
      </div>
      <div key={view} className="animate-tab">
        {view === "list" && <CandidatesList />}
        {view === "overview" && <Overview />}
        {view === "activity" && <ActivityLog />}
      </div>
    </>
  );
}
