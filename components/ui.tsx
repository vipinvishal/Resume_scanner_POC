import Link from "next/link";
import type { HrStatus, Verdict } from "@/lib/types";
import { STATUS_LABEL, VERDICT_LABEL } from "@/lib/types";
import { CheckCircle2, CircleDashed, MessageCircleQuestion, XCircle } from "lucide-react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ───────── Logo ───────── */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--color-forest)" />
      <circle cx="15" cy="14.5" r="6.2" stroke="var(--color-paper)" strokeWidth="2.2" />
      <path d="M19.8 19.4 25 24.6" stroke="var(--color-paper)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M12.2 14.6l2 2 3.6-3.8" stroke="#f3b49f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ href = "/", light = false }: { href?: string; light?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="TalentLens home">
      <LogoMark />
      <span className={cx("font-display text-[1.35rem] font-semibold leading-none", light ? "text-on-panel" : "text-ink")}>
        Talent<span className="italic font-normal">Lens</span>
      </span>
    </Link>
  );
}

/* ───────── Buttons ───────── */
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]";
export const btn = {
  primary: cx(btnBase, "bg-forest text-paper hover:bg-forest-deep shadow-soft hover:shadow-lift"),
  ghost: cx(btnBase, "border border-line-strong bg-card/60 text-ink hover:bg-card hover:border-ink-faint"),
  quiet: cx(btnBase, "text-ink-soft hover:bg-paper-2 hover:text-ink px-3"),
  danger: cx(btnBase, "border border-reject/30 bg-reject-bg/60 text-reject hover:bg-reject-bg"),
};

/* ───────── Status & verdict ───────── */
const verdictStyle: Record<Verdict, { cls: string; icon: React.ReactNode }> = {
  accept: { cls: "bg-accept-bg text-accept", icon: <CheckCircle2 size={14} /> },
  talk: { cls: "bg-talk-bg text-talk", icon: <MessageCircleQuestion size={14} /> },
  reject: { cls: "bg-reject-bg text-reject", icon: <XCircle size={14} /> },
};
export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const v = verdictStyle[verdict];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", v.cls)}>
      {v.icon}
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

const statusStyle: Record<HrStatus, { cls: string; icon: React.ReactNode }> = {
  pending: { cls: "bg-pending-bg text-pending", icon: <CircleDashed size={14} /> },
  accepted: verdictStyle.accept,
  talk: verdictStyle.talk,
  rejected: verdictStyle.reject,
};
export function StatusBadge({ status }: { status: HrStatus }) {
  const v = statusStyle[status];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", v.cls)}>
      {v.icon}
      {STATUS_LABEL[status]}
    </span>
  );
}

export const verdictColor: Record<Verdict, string> = {
  accept: "var(--color-accept)",
  talk: "var(--color-talk)",
  reject: "var(--color-reject)",
};

/* ───────── Score ring ───────── */
export function ScoreRing({ score, verdict, size = 120 }: { score: number; verdict: Verdict; size?: number }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Match score ${score} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-paper-2)" strokeWidth="9" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={verdictColor[verdict]}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.2,.7,.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl font-semibold leading-none">{score}</span>
        <span className="eyebrow mt-1 !text-[0.6rem]">of 100</span>
      </div>
    </div>
  );
}

/* ───────── Small helpers ───────── */
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cx("print-card rounded-2xl border border-line bg-card shadow-soft", className)}>{children}</section>;
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-display text-4xl font-semibold leading-tight sm:text-[2.6rem]">{title}</h1>
      </div>
      {children}
    </header>
  );
}

export function formatDate(iso: string) {
  // Timestamps are ISO strings; older rows may be "YYYY-MM-DD HH:MM:SS" in UTC without a zone marker.
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
