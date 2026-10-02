import { guard } from "@/lib/auth";
import { listCandidates } from "@/lib/db";
import { STATUS_LABEL, VERDICT_LABEL, type HrStatus } from "@/lib/types";

const esc = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[=+\-@]/.test(s)) s = "'" + s; // avoid spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: Request) {
  const g = await guard();
  if (g) return g;
  const u = new URL(req.url);
  const rows = listCandidates({
    status: (u.searchParams.get("status") as HrStatus | "all") || "all",
    jobId: Number(u.searchParams.get("jobId")) || undefined,
    q: u.searchParams.get("q")?.trim() || undefined,
    from: u.searchParams.get("from") || undefined,
    to: u.searchParams.get("to") || undefined,
  });
  const head = ["Candidate", "Email", "Current role", "Job", "Match score", "AI recommendation", "HR status", "HR note", "Screened on", "Decided on"];
  const lines = [head.join(",")];
  for (const r of rows)
    lines.push(
      [r.name, r.email, r.current_role, r.job_title, r.score, VERDICT_LABEL[r.ai_verdict], STATUS_LABEL[r.hr_status], r.note, r.created_at, r.decided_at ?? ""]
        .map(esc)
        .join(","),
    );
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="candidates-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
