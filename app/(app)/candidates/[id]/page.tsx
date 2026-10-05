import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Copy, ShieldAlert } from "lucide-react";
import { getCandidate } from "@/lib/db";
import ReportView from "@/components/report";
import DecisionPanel, { PrintButton } from "@/components/decision";
import { StatusBadge, formatDate } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CandidatePage(props: PageProps<"/candidates/[id]">) {
  const { id } = await props.params;
  let c;
  try {
    c = await getCandidate(Number(id));
  } catch (e) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-reject/30 bg-reject-bg/70 p-6 text-reject">
        <p className="font-semibold">Can&apos;t open this report</p>
        <p className="mt-1 text-sm">{(e as Error).message}</p>
        <Link href="/settings" className="mt-3 inline-block text-sm font-medium underline">Open Settings</Link>
      </div>
    );
  }
  if (!c) notFound();

  return (
    <>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/candidates" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
          <ArrowLeft size={16} /> All candidates
        </Link>
        <PrintButton />
      </div>
      {c.gate_missing.length > 0 && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-reject/30 bg-reject-bg/70 px-5 py-4 text-reject">
          <ShieldAlert size={22} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Not eligible — missing a mandatory skill</p>
            <p className="text-sm">
              {c.gate_missing.join(", ")}. The match score is {c.score}, but this role requires {c.gate_missing.length === 1 ? "that skill" : "those skills"}.
            </p>
          </div>
        </div>
      )}
      {c.duplicates.length > 0 && (
        <div className="mb-6 rounded-2xl border border-talk/30 bg-talk-bg/60 px-5 py-4 text-talk">
          <p className="flex items-center gap-2 font-semibold">
            <Copy size={18} /> Seen before — {c.duplicates.length === 1 ? "1 other record looks" : `${c.duplicates.length} other records look`} like this person
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {c.duplicates.map((d) => (
              <li key={d.id}>
                <Link href={`/candidates/${d.id}`} className="font-medium underline">{d.name}</Link>
                {" — "}
                {d.basis === "file" ? "the same resume file" : d.basis === "email" ? "same email address" : "same name (could be a different person)"}
                {" · "}
                {d.same_job ? "this job" : `"${d.job_title}"`} · {formatDate(d.created_at)} · match {d.score}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid items-start gap-8 xl:grid-cols-[1fr_330px]">
        <div className="min-w-0">
          <ReportView report={c.report} jobTitle={c.job_title} fileName={c.file_name} mandatoryIds={c.mandatory_ids} />
          <p className="mt-6 font-mono text-xs text-ink-faint">
            Analysed {formatDate(c.created_at)} · {c.provider} {c.model} · {c.file_name}
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
