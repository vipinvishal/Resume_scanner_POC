"use client";

import { useState } from "react";
import { cx } from "./ui";
import type { DashboardWeek } from "@/lib/types";

/* ───────── helpers ───────── */

/** A tidy axis: a "nice" top value and evenly spaced ticks from zero. */
export function niceScale(max: number, target = 4): { top: number; ticks: number[] } {
  const raw = Math.max(max, 1) / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const top = Math.ceil(Math.max(max, 1) / step) * step;
  return { top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
}

/** "45 min", "6.5 hours", "2.3 days" — whatever reads naturally for HR. */
export function fmtDuration(hours: number | null | undefined): string {
  if (hours == null) return "–";
  if (hours < 1 / 60) return "under a minute";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${hours < 10 ? hours.toFixed(1).replace(/\.0$/, "") : Math.round(hours)} hours`;
  return `${(hours / 24).toFixed(1).replace(/\.0$/, "")} days`;
}

const OUTCOMES = [
  { key: "accepted", label: "Accepted", color: "var(--viz-accepted)" },
  { key: "talk", label: "Talk to candidate", color: "var(--viz-talk)" },
  { key: "pending", label: "Waiting for decision", color: "var(--viz-pending)" },
  { key: "rejected", label: "Rejected", color: "var(--viz-rejected)" },
] as const;

const PLOT_H = 200;

/** Shared frame: y-axis ticks + hairline grid behind a row of columns. */
function Frame({ ticks, top, unit, children }: { ticks: number[]; top: number; unit?: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="relative w-9 shrink-0 text-right font-mono text-[0.68rem] text-[color:var(--viz-muted)]" style={{ height: PLOT_H }} aria-hidden>
        {ticks.map((t) => (
          <span key={t} className="absolute right-0 leading-none" style={{ bottom: `${(t / top) * 100}%`, transform: "translateY(50%)" }}>
            {t}
            {unit && t === ticks[ticks.length - 1] ? <span className="sr-only"> {unit}</span> : null}
          </span>
        ))}
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: PLOT_H }} aria-hidden>
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t" style={{ bottom: `${(t / top) * 100}%`, borderColor: t === 0 ? "var(--viz-axis)" : "var(--viz-grid)" }} />
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}

function Tooltip({ children, align }: { children: React.ReactNode; align: "left" | "center" | "right" }) {
  return (
    <div
      role="tooltip"
      className={cx(
        "pointer-events-none absolute bottom-full z-20 mb-2 hidden w-max min-w-[11rem] max-w-[15rem] rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm shadow-lift group-hover:block group-focus:block",
        align === "center" && "left-1/2 -translate-x-1/2",
        align === "left" && "left-0",
        align === "right" && "right-0",
      )}
    >
      {children}
    </div>
  );
}

const alignFor = (i: number, n: number) => (i < 2 ? "left" : i >= n - 2 ? "right" : "center");

function ViewToggle({ table, onChange }: { table: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!table)} className="text-sm font-medium text-forest underline-offset-2 hover:underline">
      {table ? "Show as chart" : "Show as table"}
    </button>
  );
}

/* ───────── Screened per week (stacked by outcome) ───────── */

export function WeeklyChart({ weeks }: { weeks: DashboardWeek[] }) {
  const [table, setTable] = useState(false);
  const max = Math.max(...weeks.map((w) => w.total), 0);
  const { top, ticks } = niceScale(max);
  const summary = `Candidates screened per week, last ${weeks.length} weeks: ${weeks.map((w) => `${w.label}: ${w.total}`).join(", ")}.`;

  return (
    <div className="viz">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-soft" aria-label="Legend">
          {OUTCOMES.map((o) => (
            <li key={o.key} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: o.color }} />
              {o.label}
            </li>
          ))}
        </ul>
        <ViewToggle table={table} onChange={setTable} />
      </div>

      {table ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="eyebrow !text-[0.66rem]">
                <th className="py-2 pr-4 font-medium">Week of</th>
                {OUTCOMES.map((o) => <th key={o.key} className="py-2 pr-4 text-right font-medium">{o.label}</th>)}
                <th className="py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {weeks.map((w) => (
                <tr key={w.start}>
                  <td className="py-2 pr-4">{w.label}</td>
                  {OUTCOMES.map((o) => <td key={o.key} className="py-2 pr-4 text-right tabular-nums">{w[o.key]}</td>)}
                  <td className="py-2 text-right font-semibold tabular-nums">{w.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Frame ticks={ticks} top={top}>
          <div role="img" aria-label={summary} className="relative flex" style={{ height: PLOT_H }}>
            {weeks.map((w, i) => (
              <div
                key={w.start}
                tabIndex={0}
                aria-label={`Week of ${w.label}: ${w.total} screened. ${OUTCOMES.map((o) => `${w[o.key]} ${o.label}`).join(", ")}`}
                className="group relative flex h-full flex-1 flex-col items-center justify-end rounded-md outline-none transition-colors hover:bg-paper-2/70 focus-visible:bg-paper-2/70"
              >
                {w.total > 0 && (
                  <>
                    <span className="mb-1 font-mono text-[0.68rem] leading-none text-ink-soft">{w.total}</span>
                    {/* bottom → top: accepted, talk, pending, rejected; a 2px gap of surface colour between segments */}
                    <div className="flex w-full max-w-[24px] flex-col-reverse gap-[2px]" style={{ height: `${(w.total / top) * PLOT_H - 14}px` }}>
                      {OUTCOMES.map((o, k) => {
                        const v = w[o.key];
                        if (!v) return null;
                        const isTop = OUTCOMES.slice(k + 1).every((n) => !w[n.key]);
                        return <div key={o.key} className={cx("w-full", isTop && "rounded-t-[4px]")} style={{ flex: v, background: o.color, minHeight: 3 }} />;
                      })}
                    </div>
                  </>
                )}
                <Tooltip align={alignFor(i, weeks.length)}>
                  <p className="text-xs text-ink-soft">Week of {w.label}</p>
                  <p className="mt-0.5 font-semibold">{w.total} screened</p>
                  {w.total > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {OUTCOMES.map((o) => (
                        <li key={o.key} className="flex items-center gap-2">
                          <span className="h-0.5 w-3 shrink-0 rounded" style={{ background: o.color }} />
                          <span className="font-semibold tabular-nums">{w[o.key]}</span>
                          <span className="text-ink-soft">{o.label}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Tooltip>
              </div>
            ))}
          </div>
          <div className="mt-2 flex" aria-hidden>
            {weeks.map((w) => (
              <span key={w.start} className="flex-1 text-center text-[0.68rem] text-[color:var(--viz-muted)]">{w.label}</span>
            ))}
          </div>
        </Frame>
      )}
    </div>
  );
}

/* ───────── Average time to decision, by week screened ───────── */

export function HoursChart({ weeks }: { weeks: DashboardWeek[] }) {
  const [table, setTable] = useState(false);
  const maxH = Math.max(...weeks.map((w) => w.avgHours ?? 0), 0);
  // Pick the unit that reads best for the biggest bar, and draw the axis in it.
  const unit = maxH >= 48 ? { name: "days", div: 24 } : maxH >= 1 ? { name: "hours", div: 1 } : { name: "minutes", div: 1 / 60 };
  const { top, ticks } = niceScale(maxH / unit.div);
  const val = (w: DashboardWeek) => (w.avgHours == null ? null : w.avgHours / unit.div);
  const summary = `Average time from screening to decision, by week screened (${unit.name}): ${weeks.map((w) => `${w.label}: ${fmtDuration(w.avgHours)}`).join(", ")}.`;

  return (
    <div className="viz">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">Axis in {unit.name} · weeks with no decisions yet are empty</p>
        <ViewToggle table={table} onChange={setTable} />
      </div>
      {table ? (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="eyebrow !text-[0.66rem]">
              <th className="py-2 pr-4 font-medium">Screened in week of</th>
              <th className="py-2 pr-4 text-right font-medium">Decided</th>
              <th className="py-2 text-right font-medium">Average time to decision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {weeks.map((w) => (
              <tr key={w.start}>
                <td className="py-2 pr-4">{w.label}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{w.decided}</td>
                <td className="py-2 text-right tabular-nums">{fmtDuration(w.avgHours)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Frame ticks={ticks} top={top}>
          <div role="img" aria-label={summary} className="relative flex" style={{ height: PLOT_H }}>
            {weeks.map((w, i) => {
              const v = val(w);
              return (
                <div
                  key={w.start}
                  tabIndex={0}
                  aria-label={`Week of ${w.label}: ${w.decided ? `${fmtDuration(w.avgHours)} on average, ${w.decided} decided` : "no decisions yet"}`}
                  className="group relative flex h-full flex-1 flex-col items-center justify-end rounded-md outline-none transition-colors hover:bg-paper-2/70 focus-visible:bg-paper-2/70"
                >
                  {v != null && <div className="w-full max-w-[24px] rounded-t-[4px]" style={{ height: `${Math.max((v / top) * PLOT_H, 3)}px`, background: "var(--viz-single)" }} />}
                  <Tooltip align={alignFor(i, weeks.length)}>
                    <p className="text-xs text-ink-soft">Screened in week of {w.label}</p>
                    {w.decided ? (
                      <>
                        <p className="mt-0.5 font-semibold">{fmtDuration(w.avgHours)} on average</p>
                        <p className="text-ink-soft">{w.decided} decided of {w.total} screened</p>
                      </>
                    ) : (
                      <p className="mt-0.5 text-ink-soft">No decisions yet</p>
                    )}
                  </Tooltip>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex" aria-hidden>
            {weeks.map((w) => (
              <span key={w.start} className="flex-1 text-center text-[0.68rem] text-[color:var(--viz-muted)]">{w.label}</span>
            ))}
          </div>
        </Frame>
      )}
    </div>
  );
}

/* ───────── Where everyone stands (horizontal bars) ───────── */

export function OutcomeBars({ counts }: { counts: Record<(typeof OUTCOMES)[number]["key"], number> }) {
  const total = OUTCOMES.reduce((s, o) => s + counts[o.key], 0);
  const max = Math.max(...OUTCOMES.map((o) => counts[o.key]), 1);
  return (
    <ul className="viz space-y-4" aria-label="Candidates by outcome">
      {OUTCOMES.map((o) => (
        <li key={o.key} className="group" title={`${counts[o.key]} of ${total}`}>
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <span className="text-ink-soft">{o.label}</span>
            <span className="font-semibold tabular-nums">
              {counts[o.key]}
              <span className="ml-1.5 font-normal text-ink-faint">{total ? `${Math.round((counts[o.key] / total) * 100)}%` : ""}</span>
            </span>
          </div>
          {/* bar grows from the baseline; 4px rounded data-end, square at the start */}
          <div className="h-2.5 rounded-r-[4px] bg-paper-2/70">
            <div className="h-full rounded-r-[4px] transition-[width] duration-500" style={{ width: `${(counts[o.key] / max) * 100}%`, background: o.color, minWidth: counts[o.key] ? 4 : 0 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
