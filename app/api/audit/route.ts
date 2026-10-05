import { fail } from "@/lib/api";
import { guard } from "@/lib/auth";
import { listAudit } from "@/lib/db";

const esc = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[=+\-@]/.test(s)) s = "'" + s; // avoid spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The activity log, newest first. ?format=csv downloads all of it (for compliance). */
export async function GET(req: Request) {
  const g = await guard();
  if (g) return g;
  const u = new URL(req.url);
  const action = u.searchParams.get("action") || undefined;
  const q = u.searchParams.get("q") || undefined;
  try {
    if (u.searchParams.get("format") === "csv") {
      const { rows } = await listAudit({ action, q, limit: 5000 });
      const lines = [["When", "Who", "What happened", "Details"].join(",")];
      for (const r of rows) lines.push([r.at, r.actor, r.action, r.summary].map(esc).join(","));
      return new Response("\ufeff" + lines.join("\r\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="activity-log-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }
    return Response.json(await listAudit({ action, q, limit: Number(u.searchParams.get("limit")) || 50, offset: Number(u.searchParams.get("offset")) || 0 }));
  } catch (e) {
    return fail(e);
  }
}
