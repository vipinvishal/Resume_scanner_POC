import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCandidate } from "@/lib/db";
import ReportView from "@/components/report";
import DecisionPanel, { PrintButton } from "@/components/decision";
import { StatusBadge, formatDate } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CandidatePage(props: PageProps<"/candidates/[id]">) {
  const { id } = await props.params;
  const c = getCandidate(Number(id));
  if (!c) notFound();

  return (
    <>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/candidates" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
          <ArrowLeft size={16} /> All candidates
        </Link>
        <PrintButton />
      </div>
      <div className="grid items-start gap-8 xl:grid-cols-[1fr_330px]">
        <div className="min-w-0">
          <ReportView report={c.report} jobTitle={c.job_title} fileName={c.file_name} />
          <p className="mt-6 font-mono text-xs text-ink-faint">
            Analysed {formatDate(c.created_at)} · {c.provider === "gemini" ? "Gemini" : "Ollama"} {c.model} · {c.file_name}
          </p>
          <p className="mt-1 hidden text-sm print:block">HR status: <StatusBadge status={c.hr_status} /></p>
        </div>
        <aside className="xl:sticky xl:top-8">
          <DecisionPanel id={c.id} status={c.hr_status} note={c.note} aiVerdict={c.ai_verdict} history={c.history} />
        </aside>
      </div>
    </>
  );
}
