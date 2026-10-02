"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, MessageCircleQuestion, Printer, RotateCcw, Send, XCircle } from "lucide-react";
import type { HrStatus, Verdict } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import { StatusBadge, VerdictBadge, btn, cx, formatDate } from "./ui";

interface Hist {
  id: number;
  from_status: string | null;
  to_status: string;
  note: string;
  created_at: string;
}

type Choice = Exclude<HrStatus, "pending">;

const OPTIONS: { status: Choice; label: string; sub: string; icon: React.ElementType; on: string; ring: string }[] = [
  { status: "accepted", label: "Accept", sub: "Proceed to L1 / L2", icon: CheckCircle2, on: "bg-accept text-white", ring: "hover:border-accept/60 hover:bg-accept-bg/50" },
  { status: "talk", label: "Talk to candidate", sub: "HR call first", icon: MessageCircleQuestion, on: "bg-talk text-white", ring: "hover:border-talk/60 hover:bg-talk-bg/50" },
  { status: "rejected", label: "Reject", sub: "Close with a reason", icon: XCircle, on: "bg-reject text-white", ring: "hover:border-reject/60 hover:bg-reject-bg/50" },
];

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className={btn.ghost}>
      <Printer size={16} /> Save as PDF
    </button>
  );
}

export default function DecisionPanel({
  id,
  status: initial,
  note: initialNote,
  aiVerdict,
  history: initialHistory,
}: {
  id: number;
  status: HrStatus;
  note: string;
  aiVerdict: Verdict;
  history: Hist[];
}) {
  const router = useRouter();
  // `status` / `savedNote` = what is saved. `choice` / `note` = what HR is editing, not saved until Submit.
  const [status, setStatus] = useState(initial);
  const [savedNote, setSavedNote] = useState(initialNote);
  const [choice, setChoice] = useState<Choice | null>(initial === "pending" ? null : initial);
  const [note, setNote] = useState(initialNote);
  const [history, setHistory] = useState(initialHistory);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const dirty = choice !== null && (choice !== status || note.trim() !== savedNote.trim());

  async function save(next: HrStatus, noteToSave: string) {
    setBusy(true);
    setError("");
    setDone("");
    const res = await fetch(`/api/candidates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, note: noteToSave }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Couldn't save the decision.");
      return false;
    }
    const d = await res.json();
    setStatus(d.hr_status);
    setSavedNote(d.note);
    setNote(d.note);
    setChoice(d.hr_status === "pending" ? null : d.hr_status);
    setHistory(d.history);
    router.refresh();
    return true;
  }

  async function submit() {
    if (!choice) return;
    if (await save(choice, note)) setDone(`Decision submitted: ${STATUS_LABEL[choice]}`);
  }

  async function reset() {
    if (await save("pending", note)) setDone("Reset to pending review.");
  }

  return (
    <div className="no-print space-y-5">
      <div className="rounded-2xl border border-line bg-card p-6 shadow-soft">
        <p className="eyebrow">HR decision</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          {dirty && <span className="rounded-full bg-paper-2 px-2.5 py-1 text-xs font-medium text-ink-soft">Not submitted yet</span>}
        </div>
        <p className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
          AI suggested: <VerdictBadge verdict={aiVerdict} />
        </p>

        {(choice === "talk" || status === "talk") && (
          <p className="mt-4 rounded-xl bg-talk-bg/70 px-4 py-3 text-sm text-talk">
            After the call, come back here and choose <b>Accept</b> or <b>Reject</b>, then submit.
          </p>
        )}

        <fieldset className="mt-5 space-y-2.5" disabled={busy}>
          <legend className="sr-only">Choose a decision</legend>
          {OPTIONS.map((o) => {
            const active = choice === o.status;
            return (
              <button
                key={o.status}
                type="button"
                onClick={() => {
                  setChoice(o.status);
                  setDone("");
                }}
                aria-pressed={active}
                className={cx(
                  "flex w-full items-center gap-3.5 rounded-xl border px-4 py-3 text-left transition-all disabled:opacity-60",
                  active ? cx(o.on, "border-transparent shadow-soft") : cx("border-line-strong bg-paper/40", o.ring),
                )}
              >
                <o.icon size={20} />
                <span>
                  <span className="block text-sm font-semibold leading-tight">{o.label}</span>
                  <span className={cx("text-xs", active ? "text-white/80" : "text-ink-soft")}>{o.sub}</span>
                </span>
              </button>
            );
          })}
        </fieldset>

        <label htmlFor="note" className="mt-5 block text-sm font-medium">
          Note / feedback <span className="font-normal text-ink-faint">(optional)</span>
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setDone("");
          }}
          rows={4}
          maxLength={1000}
          placeholder="e.g. Spoke on phone — notice period 30 days"
          className="mt-1.5 w-full resize-none rounded-xl border border-line-strong bg-paper/50 px-3.5 py-2.5 text-sm outline-none focus:border-forest focus:bg-card focus:ring-4 focus:ring-forest/10"
        />

        <button type="button" onClick={submit} disabled={!dirty || busy} className={cx(btn.primary, "mt-4 w-full !py-3")}>
          {busy ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
          {busy ? "Submitting…" : "Submit decision"}
        </button>
        {!choice && !done && <p className="mt-2 text-center text-xs text-ink-soft">Choose an option above, add a note if you like, then submit.</p>}
        {done && (
          <p role="status" className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-accept-bg px-3.5 py-2 text-sm font-medium text-accept">
            <CheckCircle2 size={16} /> {done}
          </p>
        )}
        {error && <p role="alert" className="mt-3 rounded-xl bg-reject-bg px-3.5 py-2 text-sm text-reject">{error}</p>}

        {status !== "pending" && (
          <button type="button" onClick={reset} disabled={busy} className={cx(btn.quiet, "mt-3 !px-2 text-xs")}>
            <RotateCcw size={13} /> Reset to pending
          </button>
        )}
      </div>

      {history.length > 0 && (
        <div className="rounded-2xl border border-line bg-card p-6 shadow-soft">
          <p className="eyebrow mb-4">History</p>
          <ol className="relative space-y-4 border-l border-line pl-5">
            {history.map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-forest" />
                <p className="text-sm font-medium">{STATUS_LABEL[h.to_status as HrStatus] ?? h.to_status}</p>
                {h.note && <p className="text-sm text-ink-soft">“{h.note}”</p>}
                <p className="font-mono text-xs text-ink-faint">{formatDate(h.created_at)}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
