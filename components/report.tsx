import { AlertTriangle, ArrowRight, Briefcase, CircleHelp, GraduationCap, Mail, MapPin, Phone, ThumbsUp, Target } from "lucide-react";
import type { FitBlock, Report, SkillStatus } from "@/lib/types";
import { Card, ScoreRing, VerdictBadge, cx, verdictColor } from "./ui";

const SKILL_STYLE: Record<SkillStatus, { label: string; cls: string; dot: string }> = {
  present: { label: "Present", cls: "bg-accept-bg text-accept", dot: "bg-accept" },
  partial: { label: "Partial", cls: "bg-talk-bg text-talk", dot: "bg-talk" },
  missing: { label: "Missing", cls: "bg-reject-bg text-reject", dot: "bg-reject" },
};

const FIT_STYLE: Record<FitBlock["fit"], { label: string; cls: string }> = {
  exceeds: { label: "Exceeds", cls: "bg-accept-bg text-accept" },
  meets: { label: "Meets", cls: "bg-accept-bg text-accept" },
  partial: { label: "Partly meets", cls: "bg-talk-bg text-talk" },
  below: { label: "Below", cls: "bg-reject-bg text-reject" },
  unknown: { label: "Not stated", cls: "bg-pending-bg text-pending" },
};

const verdictHeadline = {
  accept: "Recommended: move to L1 / L2 interviews",
  talk: "Recommended: have a short call with the candidate first",
  reject: "Recommended: do not proceed",
};

function Bar({ label, value, weight }: { label: string; value: number; weight: string }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-mono text-ink-soft">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-paper-2">
        <div className="h-full rounded-full bg-forest" style={{ width: `${value}%`, transition: "width 1s cubic-bezier(.2,.7,.2,1)" }} />
      </div>
      <p className="mt-1.5 text-xs text-ink-faint">Worth {weight} of the final score</p>
    </div>
  );
}

function SectionTitle({ icon: Icon, children, sub }: { icon: React.ElementType; children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-display flex items-center gap-2.5 text-2xl font-semibold">
        <Icon size={22} className="text-forest" /> {children}
      </h2>
      {sub && <p className="mt-1 text-sm text-ink-soft">{sub}</p>}
    </div>
  );
}

function FitCard({ icon: Icon, title, b }: { icon: React.ElementType; title: string; b: FitBlock }) {
  const f = FIT_STYLE[b.fit];
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display flex items-center gap-2 text-xl font-semibold">
          <Icon size={19} className="text-forest" /> {title}
        </h3>
        <span className={cx("rounded-full px-2.5 py-1 text-xs font-semibold", f.cls)}>{f.label}</span>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="eyebrow mb-1">Job expects</dt>
          <dd>{b.required}</dd>
        </div>
        <div>
          <dt className="eyebrow mb-1">Candidate has</dt>
          <dd>{b.candidate}</dd>
        </div>
      </dl>
      {b.comment && <p className="mt-4 border-t border-line pt-4 text-sm text-ink-soft">{b.comment}</p>}
    </Card>
  );
}

function BulletCard({ title, items, tone, icon: Icon, empty }: { title: string; items: string[]; tone: string; icon: React.ElementType; empty: string }) {
  return (
    <Card className="p-6">
      <h3 className={cx("font-display flex items-center gap-2 text-xl font-semibold", tone)}>
        <Icon size={19} /> {title}
      </h3>
      {items.length ? (
        <ul className="mt-4 space-y-2.5 text-sm leading-relaxed">
          {items.map((t, i) => (
            <li key={i} className="flex gap-2.5">
              <span className={cx("mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current", tone)} />
              <span className="text-ink">{t}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-ink-faint">{empty}</p>
      )}
    </Card>
  );
}

export default function ReportView({ report: r, jobTitle, fileName }: { report: Report; jobTitle: string; fileName?: string }) {
  const must = r.skills.filter((s) => s.type === "must");
  const nice = r.skills.filter((s) => s.type === "nice");
  const count = (list: typeof must, st: SkillStatus) => list.filter((s) => s.status === st).length;

  return (
    <div className="space-y-8">
      {/* ───── Summary ───── */}
      <Card className="overflow-hidden">
        <div className="h-1.5" style={{ background: verdictColor[r.verdict] }} />
        <div className="grid gap-8 p-7 sm:p-9 md:grid-cols-[auto_1fr] md:items-center">
          <ScoreRing score={r.score} verdict={r.verdict} size={148} />
          <div className="min-w-0">
            <p className="eyebrow mb-2">Screening report · {jobTitle}</p>
            <h1 className="font-display text-4xl font-semibold leading-tight">{r.candidate.name}</h1>
            <p className="mt-1 text-ink-soft">
              {[r.candidate.currentRole, r.candidate.totalYears != null ? `${r.candidate.totalYears} yrs experience` : ""].filter(Boolean).join(" · ") || fileName}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-soft">
              {r.candidate.email && <span className="inline-flex items-center gap-1.5"><Mail size={14} />{r.candidate.email}</span>}
              {r.candidate.phone && <span className="inline-flex items-center gap-1.5"><Phone size={14} />{r.candidate.phone}</span>}
              {r.candidate.location && <span className="inline-flex items-center gap-1.5"><MapPin size={14} />{r.candidate.location}</span>}
            </div>
          </div>
        </div>
        <div className="border-t border-line bg-paper/60 px-7 py-6 sm:px-9">
          <div className="flex flex-wrap items-center gap-3">
            <VerdictBadge verdict={r.verdict} />
            <p className="font-medium">{verdictHeadline[r.verdict]}</p>
          </div>
          <p className="mt-3 max-w-3xl leading-relaxed text-ink-soft">{r.summary}</p>
          <p className="mt-2 max-w-3xl text-sm text-ink-faint">{r.verdictReason}</p>
        </div>
      </Card>

      {/* ───── Score breakdown ───── */}
      <Card className="p-7">
        <SectionTitle icon={Target} sub="The score is calculated the same way for every candidate, so results are comparable.">
          How the score was worked out
        </SectionTitle>
        <div className="grid gap-6 md:grid-cols-3">
          <Bar label="Skills match" value={r.scoreBreakdown.skills} weight="70%" />
          <Bar label="Experience" value={r.scoreBreakdown.experience} weight="20%" />
          <Bar label="Education" value={r.scoreBreakdown.education} weight="10%" />
        </div>
      </Card>

      {/* ───── Skills matrix ───── */}
      <Card className="p-7">
        <SectionTitle icon={Briefcase} sub="What the job description asks for, compared with what the resume shows.">
          Job description vs resume
        </SectionTitle>
        <div className="mb-5 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-accept-bg px-3 py-1 font-medium text-accept">{count(must, "present")} of {must.length} must-haves present</span>
          {count(must, "partial") > 0 && <span className="rounded-full bg-talk-bg px-3 py-1 font-medium text-talk">{count(must, "partial")} partial</span>}
          {count(must, "missing") > 0 && <span className="rounded-full bg-reject-bg px-3 py-1 font-medium text-reject">{count(must, "missing")} missing</span>}
        </div>
        {[
          ["Must-have skills", must],
          ["Nice-to-have skills", nice],
        ].map(([label, list]) =>
          (list as typeof must).length ? (
            <div key={label as string} className="mb-6 last:mb-0">
              <h3 className="eyebrow mb-3">{label as string}</h3>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                {(list as typeof must).map((s) => {
                  const st = SKILL_STYLE[s.status];
                  return (
                    <li key={s.id} className="grid gap-x-6 gap-y-1 bg-paper/40 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_110px_minmax(0,1.4fr)] sm:items-center">
                      <span className="font-medium">{s.requirement}</span>
                      <span className={cx("w-fit rounded-full px-2.5 py-1 text-xs font-semibold", st.cls)}>
                        <span className={cx("mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle", st.dot)} />
                        {st.label}
                      </span>
                      <span className="text-sm text-ink-soft">{s.evidence}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null,
        )}
      </Card>

      {/* ───── Experience & education ───── */}
      <div className="grid gap-6 md:grid-cols-2">
        <FitCard icon={Briefcase} title="Experience" b={r.experience} />
        <FitCard icon={GraduationCap} title="Education" b={r.education} />
      </div>

      {/* ───── Strengths / gaps / risks ───── */}
      <div className="grid gap-6 md:grid-cols-3">
        <BulletCard title="Strengths" items={r.strengths} tone="text-accept" icon={ThumbsUp} empty="Nothing notable stood out." />
        <BulletCard title="Gaps" items={r.gaps} tone="text-talk" icon={AlertTriangle} empty="No major gaps found." />
        <BulletCard title="Double-check" items={r.risks} tone="text-reject" icon={CircleHelp} empty="No red flags spotted." />
      </div>

      {/* ───── Questions ───── */}
      {r.screeningQuestions.length > 0 && (
        <Card className="p-7">
          <SectionTitle icon={ArrowRight} sub="Handy for a quick screening call — especially for ‘talk to candidate’.">
            Questions to ask the candidate
          </SectionTitle>
          <ol className="space-y-3">
            {r.screeningQuestions.map((q, i) => (
              <li key={i} className="flex gap-4 rounded-2xl border border-line bg-paper/50 px-5 py-3.5">
                <span className="font-display text-xl font-semibold text-forest">{i + 1}</span>
                <span className="leading-relaxed">{q}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
