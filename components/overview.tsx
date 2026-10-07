"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, ChevronDown, ShieldAlert } from "lucide-react";
import { HoursChart, OutcomeBars, WeeklyChart, fmtDuration } from "./charts";
import { Card, PageHeader, cx } from "./ui";
import type { DashboardData } from "@/lib/types";

interface JobOption {
  id: number;
  title: string;
  candidates: number;
}

function Tile({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-5 py-4 shadow-soft">
      <p className="eyebrow !text-[0.66rem]">{label}</p>
      <p className={cx("font-display mt-1.5 text-3xl font-semibold leading-none", tone)}>{value}</p>
      <p className="mt-1.5 text-xs text-ink-soft">{sub}</p>
    </div>
  );
}

function ChartCard({ title, sub, className, children }: { title: string; sub: string; className?: string; children: React.ReactNode }) {
  return (
    <Card className={cx("p-6", className)}>
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="mb-5 mt-0.5 text-sm text-ink-soft">{sub}</p>
      {children}
    </Card>
  );
}

export default function Overview() {
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [jobId, setJobId] = useState("");
  const [loaded, setLoaded] = useState<{ jobId: string; data: DashboardData } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/jobs").then((r) => r.json()).then((l) => Array.isArray(l) && setJobs(l)).catch(() => {});
  }, []);

  useEffect(() => {
    let live = true;
    fetch(`/api/dashboard${jobId ? `?jobId=${jobId}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        if (d.error) setError(d.error);
        else {
          setError("");
          setLoaded({ jobId, data: d });
        }
      })
      .catch(() => live && setError("Couldn't load the numbers."));
    return () => {
      live = false;
    };
  }, [jobId]);

  const d = loaded?.data;
  const refreshing = !!loaded && loaded.jobId !== jobId; // keep the old charts on screen, dimmed, while new numbers load

  const delta = d ? d.thisWeek - d.lastWeek : 0;
  const deltaText = !d ? "" : d.lastWeek === 0 && d.thisWeek === 0 ? "No screenings in the last two weeks" : d.lastWeek === 0 ? "No screenings the week before" : delta === 0 ? "Same as last week" : `${delta > 0 ? "+" : "−"}${Math.abs(delta)} vs last week`;

  return (
    <>
      <PageHeader eyebrow="Dashboard" title="Overview" />

      {/* Filter row: sits above everything it changes */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label htmlFor="ovjob" className="text-sm font-medium">Show numbers for</label>
        <div className="relative">
          <select id="ovjob" value={jobId} onChange={(e) => setJobId(e.target.value)} className="cursor-pointer appearance-none rounded-full border border-line-strong bg-card py-2 pl-4 pr-10 text-sm outline-none focus:border-forest">
            <option value="">All jobs</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.title} ({j.candidates})</option>
            ))}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-soft" />
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-reject/30 bg-reject-bg/70 px-5 py-4 text-reject">
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <div className="text-sm">
            <p>{error}</p>
            <Link href="/settings" className="mt-1 inline-block font-medium underline">Open Settings</Link>
          </div>
        </div>
      )}

      {!d ? (
        !error && <div className="skeleton h-96 rounded-2xl" />
      ) : d.screened === 0 ? (
        <Card className="px-6 py-16 text-center">
          <p className="font-display text-2xl font-semibold">No data to chart yet</p>
          <p className="mt-1 text-ink-soft">Screen a few resumes from the Home tab to populate these charts.</p>
        </Card>
      ) : (
        <div className={cx("space-y-6 transition-opacity", refreshing && "opacity-50")}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Tile label="Screened this week" value={d.thisWeek} sub={deltaText} />
            <Tile label="Accept rate" value={d.acceptRate == null ? "–" : `${d.acceptRate}%`} sub={d.decided ? `${d.accepted} of ${d.decided} decided` : "No decisions yet"} tone="text-accept" />
            <Tile label="Average time to decision" value={d.avgHours == null ? "–" : fmtDuration(d.avgHours)} sub="From screening to final decision" />
            <Tile label="Waiting for a decision" value={d.pending} sub={`of ${d.screened} screened`} tone="text-pending" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <ChartCard className="lg:col-span-2" title="Screened per week" sub="Last 8 weeks, by outcome">
              <WeeklyChart weeks={d.weeks} />
            </ChartCard>
            <ChartCard title="Where everyone stands" sub={`All ${d.screened} screened`}>
              <OutcomeBars counts={{ accepted: d.accepted, talk: d.talk, pending: d.pending, rejected: d.rejected }} />
            </ChartCard>

            <ChartCard className="lg:col-span-2" title="Time to decision" sub="Average time from screening to final decision, by week screened">
              <HoursChart weeks={d.weeks} />
            </ChartCard>
            <ChartCard title="Eligibility" sub="Mandatory skills check">
              <p className="flex items-center gap-3">
                <span className={cx("grid h-11 w-11 place-items-center rounded-full", d.notEligible ? "bg-reject-bg text-reject" : "bg-moss text-forest")}>
                  <ShieldAlert size={22} />
                </span>
                <span>
                  <span className="font-display block text-3xl font-semibold leading-none">{d.notEligible}</span>
                  <span className="text-sm text-ink-soft">not eligible</span>
                </span>
              </p>
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                These candidates are missing a skill you marked as mandatory. Choose mandatory skills for a job on the Home tab.
              </p>
            </ChartCard>
          </div>
        </div>
      )}
    </>
  );
}
