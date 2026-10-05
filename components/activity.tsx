"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, FileSearch, Gavel, Loader2, Lock, Search, Settings2, Trash2, Briefcase } from "lucide-react";
import { Card, PageHeader, btn, cx } from "./ui";
import type { AuditAction, AuditRow } from "@/lib/types";

const KINDS: Record<AuditAction, { label: string; icon: React.ElementType; tone: string }> = {
  screened: { label: "Screened", icon: FileSearch, tone: "bg-moss text-forest" },
  decision: { label: "Decision", icon: Gavel, tone: "bg-accept-bg text-accept" },
  deleted: { label: "Deleted", icon: Trash2, tone: "bg-reject-bg text-reject" },
  job_created: { label: "Job saved", icon: Briefcase, tone: "bg-pending-bg text-pending" },
  gate_changed: { label: "Mandatory skills", icon: Lock, tone: "bg-talk-bg text-talk" },
  settings_changed: { label: "Settings", icon: Settings2, tone: "bg-paper-2 text-ink-soft" },
};

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function ActivityLog() {
  const [action, setAction] = useState("all");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [data, setData] = useState<{ key: string; rows: AuditRow[]; more: boolean } | null>(null);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const params = new URLSearchParams();
  if (action !== "all") params.set("action", action);
  if (debouncedQ) params.set("q", debouncedQ);
  const key = params.toString();

  useEffect(() => {
    let live = true;
    fetch(`/api/audit?${key}`)
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        if (d.error) setError(d.error);
        else {
          setError("");
          setData({ key, rows: d.rows, more: d.more });
        }
      })
      .catch(() => live && setError("Couldn't load the activity log."));
    return () => {
      live = false;
    };
  }, [key]);

  async function more() {
    if (!data) return;
    setLoadingMore(true);
    const p = new URLSearchParams(key);
    p.set("offset", String(data.rows.length));
    const d = await (await fetch(`/api/audit?${p}`)).json().catch(() => null);
    setLoadingMore(false);
    if (d?.rows) setData({ ...data, rows: [...data.rows, ...d.rows], more: d.more });
  }

  const loading = !data || data.key !== key;

  return (
    <>
      <PageHeader eyebrow="Compliance" title="Activity log">
        <a href={`/api/audit?format=csv${key ? `&${key}` : ""}`} className={btn.ghost}>
          <Download size={16} /> Export CSV
        </a>
      </PageHeader>
      <p className="-mt-4 mb-6 max-w-2xl text-ink-soft">A record of who did what and when — screenings, decisions, mandatory-skill changes and settings. Entries can&apos;t be edited from the app.</p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex flex-wrap rounded-full border border-line-strong bg-paper-2/60 p-1 text-sm" role="group" aria-label="Filter by event">
          {[["all", "Everything"], ...Object.entries(KINDS).map(([k, v]) => [k, v.label])].map(([k, label]) => (
            <button key={k} onClick={() => setAction(k)} aria-pressed={action === k} className={cx("rounded-full px-3.5 py-1.5 font-medium transition-colors", action === k ? "bg-forest text-paper shadow-soft" : "text-ink-soft hover:text-ink")}>
              {label}
            </button>
          ))}
        </div>
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, person or detail…" aria-label="Search the activity log" className="w-full rounded-full border border-line-strong bg-card py-2 pl-10 pr-4 text-sm outline-none focus:border-forest focus:ring-4 focus:ring-forest/10" />
        </div>
      </div>

      <Card className={cx("overflow-hidden transition-opacity", loading && data && "opacity-60")}>
        {error ? (
          <p role="alert" className="px-6 py-12 text-center text-reject">{error}</p>
        ) : !data ? (
          <div className="space-y-px">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-14" />)}</div>
        ) : data.rows.length === 0 ? (
          <p className="px-6 py-16 text-center text-ink-soft">{key ? "Nothing matches these filters." : "Nothing has happened yet. Screen a resume and it will appear here."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-line bg-paper-2/50">
                <tr className="eyebrow !text-[0.66rem]">
                  <th className="px-5 py-3 font-medium">When</th>
                  <th className="px-3 py-3 font-medium">Who</th>
                  <th className="px-3 py-3 font-medium">Event</th>
                  <th className="px-5 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.rows.map((r) => {
                  const k = KINDS[r.action] ?? { label: r.action, icon: FileSearch, tone: "bg-paper-2 text-ink-soft" };
                  return (
                    <tr key={r.id} className="align-top">
                      <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs text-ink-soft">{when(r.at)}</td>
                      <td className="px-3 py-3.5">{r.actor}</td>
                      <td className="px-3 py-3.5">
                        <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", k.tone)}>
                          <k.icon size={13} /> {k.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {r.candidate_id && r.action !== "deleted" ? (
                          <Link href={`/candidates/${r.candidate_id}`} className="hover:text-forest hover:underline">{r.summary}</Link>
                        ) : (
                          r.summary
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {data?.more && (
        <div className="mt-4 text-center">
          <button onClick={more} disabled={loadingMore} className={btn.ghost}>
            {loadingMore && <Loader2 size={16} className="animate-spin" />} Show older entries
          </button>
        </div>
      )}
    </>
  );
}
