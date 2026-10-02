import Link from "next/link";
import { ArrowUpRight, Files, Users, Zap } from "lucide-react";
import { getStats } from "@/lib/db";
import { PageHeader, cx } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Home — TalentLens" };

export default function Home() {
  const stats = getStats();
  const cards = [
    {
      href: "/analyze",
      icon: Zap,
      title: "Instant analysis",
      body: "One job description, one resume. Get a full report in seconds — ideal for a walk-in or a referral.",
      cta: "Analyse a resume",
      tone: "bg-forest text-paper",
      sub: "text-paper/75",
    },
    {
      href: "/bulk",
      icon: Files,
      title: "Bulk upload",
      body: "One job description, many resumes. Get a ranked shortlist and decide candidate by candidate.",
      cta: "Upload a batch",
      tone: "bg-card text-ink border border-line",
      sub: "text-ink-soft",
    },
  ];
  return (
    <>
      <PageHeader eyebrow="Welcome" title="What would you like to do?" />
      <div className="grid gap-6 md:grid-cols-2">
        {cards.map((c, i) => (
          <Link
            key={c.href}
            href={c.href}
            style={{ animationDelay: `${i * 90}ms` }}
            className={cx(
              "group animate-rise relative flex min-h-[270px] flex-col justify-between overflow-hidden rounded-3xl p-8 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift",
              c.tone,
            )}
          >
            <span aria-hidden className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-current opacity-[0.06] transition-transform duration-500 group-hover:scale-125" />
            <c.icon size={34} strokeWidth={1.6} />
            <div>
              <h2 className="font-display text-3xl font-semibold">{c.title}</h2>
              <p className={cx("mt-2 max-w-sm leading-relaxed", c.sub)}>{c.body}</p>
              <p className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold">
                {c.cta} <ArrowUpRight size={16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </p>
            </div>
          </Link>
        ))}
      </div>

      <Link
        href="/candidates"
        className="group animate-rise mt-6 flex flex-wrap items-center justify-between gap-6 rounded-3xl border border-line bg-card p-7 shadow-soft transition-all hover:shadow-lift"
        style={{ animationDelay: "200ms" }}
      >
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-moss text-forest">
            <Users size={22} />
          </span>
          <div>
            <h2 className="font-display text-2xl font-semibold">Candidates dashboard</h2>
            <p className="text-ink-soft">Everyone screened so far, with their final HR status.</p>
          </div>
        </div>
        <dl className="flex gap-8">
          {[
            ["Screened", stats.total],
            ["Accepted", stats.accepted],
            ["To call", stats.talk],
            ["Pending", stats.pending],
          ].map(([k, v]) => (
            <div key={k as string}>
              <dd className="font-display text-3xl font-semibold leading-none">{v}</dd>
              <dt className="eyebrow mt-1.5 !text-[0.65rem]">{k}</dt>
            </div>
          ))}
        </dl>
      </Link>
    </>
  );
}
