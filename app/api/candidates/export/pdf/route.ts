import { zipSync } from "fflate";
import { fail } from "@/lib/api";
import { guard } from "@/lib/auth";
import { getCandidate, listCandidates } from "@/lib/db";
import { candidatePdf, pdfFileName } from "@/lib/pdf";
import type { HrStatus } from "@/lib/types";

export const maxDuration = 300;

/** One detailed PDF per ticked candidate (or per candidate in the current list), bundled in a ZIP; a single one comes back as a plain PDF. */
export async function GET(req: Request) {
  const g = await guard();
  if (g) return g;
  const u = new URL(req.url);
  try {
    // Specific candidates ticked by HR win over the filters.
    const ids = (u.searchParams.get("ids") ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
    const rows = ids.length ? ids.map((id) => ({ id })) : await listCandidates({
      status: (u.searchParams.get("status") as HrStatus | "all") || "all",
      jobId: Number(u.searchParams.get("jobId")) || undefined,
      q: u.searchParams.get("q")?.trim() || undefined,
      from: u.searchParams.get("from") || undefined,
      to: u.searchParams.get("to") || undefined,
    });
    if (!rows.length) return Response.json({ error: "There are no candidates in this list to export." }, { status: 404 });
    if (rows.length === 1) {
      const one = await getCandidate(rows[0].id);
      if (!one) return Response.json({ error: "Not found" }, { status: 404 });
      return new Response(Buffer.from(await candidatePdf(one)), {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${pdfFileName(one)}"` },
      });
    }

    const files: Record<string, Uint8Array> = {};
    for (const r of rows) {
      const c = await getCandidate(r.id);
      if (!c) continue;
      let name = pdfFileName(c);
      if (files[name]) name = name.replace(/\.pdf$/, `_${c.id}.pdf`);
      files[name] = await candidatePdf(c);
    }
    // PDFs are already compressed, so store them as they are.
    const zip = zipSync(files, { level: 0 });
    return new Response(Buffer.from(zip), {
      headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="candidate-reports-${new Date().toISOString().slice(0, 10)}.zip"` },
    });
  } catch (e) {
    return fail(e);
  }
}
