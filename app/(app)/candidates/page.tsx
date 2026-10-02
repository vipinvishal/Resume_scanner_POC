"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download, Files, Search, Users, Zap } from "lucide-react";
import type { CandidateRow, HrStatus } from "@/lib/types";
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

export default function Candidates() {
  const [status, setStatus] = useState<HrStatus | "all">("all");
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("all");
  const [jobId, setJobId] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [rows, setRows] = useState<CandidateRow[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);

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
      fetch(`/api/stats?${dateParams}`).then((r) => r.json()),
    ]).then(([list, st]) => {
      if (!live) return;
      setRows(list);
      setStats(st);
    });
    return () => {
      live = false;
    };
  }, [listParams, dateParams]);

  const cards = [
    { k: "Screened", v: stats?.total, tone: "text-ink", bar: "bg-ink" },
    { k: "Accepted", v: stats?.accepted, tone: "text-accept", bar: "bg-accept" },
    { k: "Talk to candidate", v: stats?.talk, tone: "text-talk", bar: "bg-talk" },
    { k: "Rejected", v: stats?.rejected, tone: "text-reject", bar: "bg-reject" },
    { k: "Pending review", v: stats?.pending, tone: "text-pending", bar: "bg-pending" },
  ];

  return (
    <>
      <PageHeader eyebrow="Dashboard" title="Candidates">
        <div className="flex gap-2">
          <a href={`/api/candidates/export?${listParams}`} className={btn.ghost}><Download size={16} /> Export CSV</a>
          <Link href="/bulk" className={btn.ghost}><Files size={16} /> Bulk</Link>
          <Link href="/analyze" className={btn.primary}><Zap size={16} /> New analysis</Link>
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

      {/* Table */}
      <Card className="overflow-hidden">
        {rows === null ? (
          <div className="space-y-px">
            {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[72px]" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-moss text-forest"><Users size={24} /></span>
            <p className="font-display mt-5 text-2xl font-semibold">{stats?.total ? "No candidates match these filters" : "No candidates yet"}</p>
            <p className="mt-1 text-ink-soft">{stats?.total ? "Try a different filter or search." : "Screen your first resume and it will show up here."}</p>
            {!stats?.total && <Link href="/analyze" className={cx(btn.primary, "mt-6")}>Start an analysis</Link>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-line bg-paper-2/50">
                <tr className="eyebrow !text-[0.66rem]">
                  <th className="px-5 py-3 font-medium">Candidate</th>
                  <th className="px-3 py-3 font-medium">Job</th>
                  <th className="px-3 py-3 font-medium">Score</th>
                  <th className="px-3 py-3 font-medium">AI suggests</th>
                  <th className="px-3 py-3 font-medium">HR status</th>
                  <th className="px-5 py-3 font-medium">Screened</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className="group relative transition-colors hover:bg-paper/70">
                    <td className="px-5 py-3.5">
                      <Link href={`/candidates/${r.id}`} className="font-semibold after:absolute after:inset-0 group-hover:text-forest">{r.name}</Link>
                      <p className="max-w-[16rem] truncate text-ink-soft">{r.current_role || r.email || r.file_name}</p>
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
                    <td className="px-3 py-3.5"><VerdictBadge verdict={r.ai_verdict} /></td>
                    <td className="px-3 py-3.5"><StatusBadge status={r.hr_status} /></td>
                    <td className="px-5 py-3.5 font-mono text-xs text-ink-soft">{formatDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {rows && rows.length > 0 && <p className="mt-3 text-sm text-ink-soft">{rows.length} candidate{rows.length === 1 ? "" : "s"} shown</p>}
    </>
  );
}
