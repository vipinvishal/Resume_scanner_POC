import { fail } from "@/lib/api";
import { guard } from "@/lib/auth";
import { getCandidate } from "@/lib/db";
import { candidatePdf, pdfFileName } from "@/lib/pdf";

/** The detailed PDF report for one candidate. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (g) return g;
  try {
    const c = await getCandidate(Number((await ctx.params).id));
    if (!c) return Response.json({ error: "Not found" }, { status: 404 });
    return new Response(Buffer.from(await candidatePdf(c)), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${pdfFileName(c)}"` },
    });
  } catch (e) {
    return fail(e);
  }
}
