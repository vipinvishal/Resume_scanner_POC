"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, GitMerge } from "lucide-react";
import { ConfirmDialog } from "./confirm";
import { StatusBadge, btn, cx } from "./ui";
import type { DupRef } from "@/lib/types";

const BASIS = {
  file: { label: "Same resume file", strong: true },
  email: { label: "Same email address", strong: true },
  name: { label: "Same name — could be a different person", strong: false },
} as const;

/** Other records that look like this candidate, with a way to open each one or fold it into this record. */
/** `when` is the screening date, already formatted on the server so the server and browser can't disagree about locale. */
export type DupItem = DupRef & { when: string };

export default function DuplicatesPanel({ id, name, duplicates }: { id: number; name: string; duplicates: DupItem[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<DupItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function merge() {
    if (!target) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/candidates/${id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromId: target.id }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't merge those records.");
      setTarget(null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const n = duplicates.length;
  return (
    <section id="duplicates" className="no-print mb-6 scroll-mt-24 rounded-2xl border border-talk/30 bg-talk-bg/50 p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-talk-bg text-talk">
          <Copy size={17} />
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold text-talk">Seen before</h2>
          <p className="text-sm text-ink-soft">
            {n === 1 ? "1 other record looks" : `${n} other records look`} like this candidate. Open one to compare, or merge it into this record to keep a single entry.
          </p>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-talk/15 overflow-hidden rounded-xl border border-talk/20 bg-card">
        {duplicates.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div className="min-w-0 flex-1 basis-60">
              <p className="truncate font-semibold">{d.name}</p>
              <p className="truncate text-sm text-ink-soft">
                {d.same_job ? "This job" : d.job_title} · Screened {d.when} · Match {d.score}
              </p>
              <p className={cx("mt-0.5 text-xs font-medium", BASIS[d.basis].strong ? "text-forest" : "text-talk")}>{BASIS[d.basis].label}</p>
            </div>
            <StatusBadge status={d.hr_status} />
            <div className="flex items-center gap-2">
              <Link href={`/candidates/${d.id}`} className={cx(btn.ghost, "!px-4 !py-1.5")}>
                Open
              </Link>
              <button onClick={() => (setError(""), setTarget(d))} className={cx(btn.ghost, "!px-4 !py-1.5")}>
                <GitMerge size={15} /> Merge
              </button>
            </div>
          </li>
        ))}
      </ul>

      {target && (
        <ConfirmDialog
          title="Merge these records?"
          message={`The record of "${target.name}" (${target.same_job ? "this job" : target.job_title}, ${target.when}) will be deleted and "${name}" will be kept.${
            target.hr_status !== "pending" ? " If this record has no decision yet, it takes over the decision and note from the other one." : ""
          } This can't be undone.`}
          confirmLabel="Merge"
          icon={GitMerge}
          busy={busy}
          error={error}
          onConfirm={merge}
          onCancel={() => setTarget(null)}
        />
      )}
    </section>
  );
}
