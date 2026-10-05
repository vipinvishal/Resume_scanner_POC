import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  FileSearch,
  Database,
  MessageCircleQuestion,
  Sparkles,
  UploadCloud,
  BadgeCheck,
  XCircle,
  Zap,
} from "lucide-react";
import { Logo, ScoreRing, btn, cx } from "@/components/ui";

const delay = (ms: number) => ({ animationDelay: `${ms}ms` });

export default function Landing() {
  return (
    <div className="overflow-x-clip">
      {/* ═════════════ PAGE 1 — Hero ═════════════ */}
      <section className="relative flex min-h-screen flex-col">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 top-0 h-[560px] w-[560px] rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(closest-side, #dfe9d6, transparent)" }}
        />

        <nav className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
          <Logo />
          <div className="flex items-center gap-6">
            <a href="#more" className="hidden text-sm text-ink-soft hover:text-ink sm:block">
              How it works
            </a>
            <Link href="/signin" className={btn.primary}>
              Sign in <ArrowRight size={16} />
            </Link>
          </div>
        </nav>

        <div className="relative mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 pb-6 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="eyebrow animate-rise mb-6 inline-flex items-center gap-2 rounded-full border border-line-strong bg-card/70 px-3 py-1.5">
              <Sparkles size={13} style={{ color: "#d9482b" }} /> Resume screening for HR &amp; talent teams
            </p>
            <h1 className="font-display animate-rise text-[2.6rem] font-semibold leading-[1.04] sm:text-5xl lg:text-[3.4rem]" style={delay(80)}>
              Read every resume.
              <br />
              <span className="font-normal italic text-forest">Keep the right ones.</span>
            </h1>
            <p className="animate-rise mt-6 max-w-xl text-lg leading-relaxed text-ink-soft" style={delay(180)}>
              Add the job description and a stack of resumes. TalentLens compares skill by skill, explains the match in plain English, and
              suggests whether to <b className="text-ink">accept</b>, <b className="text-ink">talk to the candidate</b>, or <b className="text-ink">reject</b>.
              You always make the final call.
            </p>
            <div className="animate-rise mt-8 flex flex-wrap items-center gap-3" style={delay(280)}>
              <Link href="/signin" className={cx(btn.primary, "!px-7 !py-3.5 text-base")}>
                Try the demo <ArrowRight size={18} />
              </Link>
              <a href="#more" className={cx(btn.ghost, "!px-6 !py-3.5 text-base")}>
                See how it works
              </a>
            </div>
            <dl className="animate-rise mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-line pt-6" style={delay(380)}>
              {[
                ["1 JD", "many resumes"],
                ["1 page", "to do it all"],
                ["0", "manual matching"],
              ].map(([a, b]) => (
                <div key={a}>
                  <dt className="font-display text-3xl font-semibold">{a}</dt>
                  <dd className="text-sm text-ink-soft">{b}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Mock report */}
          <div className="relative mx-auto w-full max-w-[460px] pb-10 lg:mx-0 lg:justify-self-end">
            <div className="animate-float rounded-3xl border border-line bg-card p-6 shadow-lift [--r:1.6deg]" style={{ transform: "rotate(1.6deg)" }}>
              <div className="flex items-center gap-5">
                <ScoreRing score={82} verdict="accept" size={104} />
                <div>
                  <p className="eyebrow">Sample report</p>
                  <p className="font-display text-2xl font-semibold leading-tight">Candidate A</p>
                  <p className="text-sm text-ink-soft">Senior Backend Engineer · 7 yrs</p>
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accept-bg px-2.5 py-1 text-xs font-semibold text-accept">
                    <CheckCircle2 size={14} /> Accept for L1
                  </span>
                </div>
              </div>
              <div className="mt-6 space-y-2.5">
                {[
                  ["Java & Spring Boot", "present"],
                  ["REST API design", "present"],
                  ["Kafka / messaging", "partial"],
                  ["AWS (EKS, S3)", "present"],
                  ["Kubernetes", "missing"],
                ].map(([skill, st]) => (
                  <div key={skill} className="flex items-center justify-between rounded-xl border border-line bg-paper/60 px-3.5 py-2.5 text-sm">
                    <span>{skill}</span>
                    <span
                      className={cx(
                        "rounded-full px-2 py-0.5 text-[0.7rem] font-semibold",
                        st === "present" && "bg-accept-bg text-accept",
                        st === "partial" && "bg-talk-bg text-talk",
                        st === "missing" && "bg-reject-bg text-reject",
                      )}
                    >
                      {st === "present" ? "Present" : st === "partial" ? "Partial" : "Missing"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="animate-rise absolute -bottom-2 -left-4 flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 shadow-lift sm:-left-10" style={delay(700)}>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-talk-bg text-talk">
                <MessageCircleQuestion size={18} />
              </span>
              <div className="text-sm leading-tight">
                <b>Candidate B</b>
                <br />
                <span className="text-ink-soft">Talk to candidate · 64</span>
              </div>
            </div>
            <div className="animate-rise absolute -right-2 -top-4 hidden items-center gap-2 rounded-full border border-line bg-card px-3.5 py-2 text-xs font-semibold shadow-lift sm:flex" style={delay(900)}>
              <Zap size={14} className="text-forest" /> Report ready in seconds
            </div>
          </div>
        </div>

        <a href="#more" className="relative mx-auto mb-6 flex items-center gap-2 text-sm text-ink-soft hover:text-ink">
          How it works <ArrowDown size={15} className="animate-bounce" />
        </a>
      </section>

      {/* ═════════════ PAGE 2 — Everything else ═════════════ */}
      <section id="more" className="flex min-h-screen scroll-mt-0 flex-col border-t border-line bg-paper-2/50">
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-6 px-6 py-8">
          {/* Steps */}
          <div>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="eyebrow mb-1.5">How it works</p>
                <h2 className="font-display text-3xl font-semibold leading-tight">From job description to decision in three steps.</h2>
              </div>
              <p className="max-w-xs text-sm text-ink-soft">Everything happens on one screen. Every candidate is saved to a dashboard.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { n: "01", icon: UploadCloud, t: "Add", d: "Paste the job description and drop in one resume or a whole folder. PDF, Word or text." },
                { n: "02", icon: FileSearch, t: "Screen", d: "Every resume is checked against the same requirements, with evidence for each skill." },
                { n: "03", icon: BadgeCheck, t: "Decide", d: "Read the ranked shortlist, then accept, talk to the candidate, or reject — in one click." },
              ].map((s) => (
                <article key={s.n} className="group relative flex gap-4 rounded-2xl border border-line bg-card p-5 shadow-soft transition-transform duration-300 hover:-translate-y-1">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-forest text-paper">
                    <s.icon size={19} />
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-semibold">
                      <span className="mr-2 font-mono text-xs font-normal text-ink-faint">{s.n}</span>
                      {s.t}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">{s.d}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Outcomes */}
          <div className="rounded-[1.75rem] bg-ink px-6 py-6 text-paper shadow-lift sm:px-8">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <h2 className="font-display text-2xl font-semibold leading-tight">Three outcomes. No guesswork.</h2>
              <p className="max-w-md text-sm text-paper/65">The score sets the suggestion using thresholds your team controls, so the same resume always gets the same answer.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { icon: CheckCircle2, c: "text-[#7fd1a4]", t: "Accept", d: "Strong match. Move straight to L1 and L2 interviews.", b: "Score 75+" },
                { icon: MessageCircleQuestion, c: "text-[#f0c36a]", t: "Talk to candidate", d: "Promising but unclear. A short HR call decides.", b: "Score 50–74" },
                { icon: XCircle, c: "text-[#f19a86]", t: "Reject", d: "Key requirements are missing. Closed with a clear reason on file.", b: "Below 50" },
              ].map((o) => (
                <article key={o.t} className="rounded-2xl border border-paper/10 bg-paper/[0.05] p-4 transition-colors hover:bg-paper/[0.09]">
                  <div className="flex items-center justify-between">
                    <o.icon size={26} className={o.c} />
                    <span className="rounded-full border border-paper/15 px-2.5 py-0.5 font-mono text-xs text-paper/70">{o.b}</span>
                  </div>
                  <h3 className="font-display mt-3 text-xl font-semibold">{o.t}</h3>
                  <p className="mt-1 text-sm text-paper/70">{o.d}</p>
                </article>
              ))}
            </div>
          </div>

          {/* Data + CTA */}
          <div className="grid items-stretch gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-2xl border border-line bg-card p-5 shadow-soft">
              <h3 className="font-display text-lg font-semibold">Use the tools you already have</h3>
              <dl className="mt-3 space-y-3 text-sm">
                {[
                  { icon: Sparkles, k: "AI model", v: ["OpenAI", "Anthropic", "Google Gemini", "Ollama (local)"] },
                  { icon: Database, k: "Database", v: ["SQLite", "PostgreSQL", "MySQL / MariaDB", "SQL Server"] },
                ].map((r) => (
                  <div key={r.k} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <dt className="flex w-28 shrink-0 items-center gap-2 font-medium text-ink-soft">
                      <r.icon size={16} className="text-forest" /> {r.k}
                    </dt>
                    <dd className="flex flex-wrap gap-1.5">
                      {r.v.map((x) => (
                        <span key={x} className="rounded-full border border-line-strong bg-paper/60 px-2.5 py-0.5 text-xs font-medium">
                          {x}
                        </span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 border-t border-line pt-3 text-sm text-ink-soft">
                Pick both from a dropdown in Settings. Run Ollama and your own database and nothing leaves your network.
              </p>
            </div>

            <div className="relative flex flex-col justify-center overflow-hidden rounded-2xl bg-forest px-7 py-6 text-paper shadow-lift">
              <div aria-hidden className="absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-[#d9482b]/25 blur-3xl" />
              <h2 className="font-display relative text-2xl font-semibold leading-tight">See it on a real job description.</h2>
              <p className="relative mt-1 text-sm text-paper/75">Sign in with the demo account and screen your first candidate in under a minute.</p>
              <Link href="/signin" className={cx(btn.ghost, "relative mt-4 w-fit !border-0 !bg-paper !px-6 !py-3 !text-forest-deep hover:!bg-white")}>
                Sign in to the demo <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </div>

        <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-5 text-sm text-ink-soft">
          <Logo />
          <p>Proof of concept · You choose where your data is stored</p>
        </footer>
      </section>
    </div>
  );
}
