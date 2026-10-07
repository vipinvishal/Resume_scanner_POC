import Link from "next/link";
import {
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
  Scale,
  Quote,
  CopyCheck,
  History,
} from "lucide-react";
import { Logo, ScoreRing, btn, cx } from "@/components/ui";
import ThemeToggle from "@/components/theme-toggle";

const delay = (ms: number) => ({ animationDelay: `${ms}ms` });

export default function Landing() {
  return (
    <div className="overflow-x-clip">
      {/* ═════════════ PAGE 1 — Hero ═════════════ */}
      <section className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 top-0 h-[560px] w-[560px] rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(closest-side, var(--color-moss), transparent)" }}
        />

        <nav className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
          <Logo />
          <div className="flex items-center gap-3 sm:gap-5">
            <a href="#more" className="hidden text-sm text-ink-soft hover:text-ink sm:block">
              How it works
            </a>
            <ThemeToggle />
            <Link href="/signin" className={btn.primary}>
              Sign in <ArrowRight size={16} />
            </Link>
          </div>
        </nav>

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-20 pt-8 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-14">
          <div>
            <p className="eyebrow animate-rise mb-6 inline-flex items-center gap-2 rounded-full border border-line-strong bg-card/70 px-3 py-1.5">
              <Sparkles size={13} style={{ color: "#d9482b" }} /> AI-powered candidate screening for HR &amp; talent teams
            </p>
            <h1 className="font-display animate-rise text-[2.6rem] font-semibold leading-[1.04] sm:text-5xl lg:text-[3.4rem]" style={delay(80)}>
              Read every resume.
              <br />
              <span className="font-normal italic text-forest">Keep the right ones.</span>
            </h1>
            <p className="animate-rise mt-6 max-w-xl text-lg leading-relaxed text-ink-soft" style={delay(180)}>
              Drop in a job description and a stack of resumes. TalentLens scores every candidate against every requirement, shows the evidence, and
              recommends whether to <b className="text-ink">accept</b>, <b className="text-ink">talk</b>, or <b className="text-ink">reject</b>. Faster
              shortlists, fairer decisions, and the final call stays with you.
            </p>
            <div className="animate-rise mt-8 flex flex-wrap items-center gap-3" style={delay(280)}>
              <Link href="/signin" className={cx(btn.primary, "!px-7 !py-3.5 text-base")}>
                Try the demo <ArrowRight size={18} />
              </Link>
              <a href="#more" className={cx(btn.ghost, "!px-6 !py-3.5 text-base")}>
                See how it works
              </a>
            </div>
            <dl className="animate-rise mt-10 grid max-w-xl grid-cols-3 gap-6 border-t border-line pt-6" style={delay(380)}>
              {[
                ["1 JD", "many resumes, one standard"],
                ["Consistent", "same resume, same verdict"],
                ["Auditable", "every decision on record"],
              ].map(([a, b]) => (
                <div key={a}>
                  <dt className="font-display text-2xl font-semibold">{a}</dt>
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
              <Zap size={14} className="text-forest" /> Reports in seconds
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════ PAGE 2 — Everything else ═════════════ */}
      <section id="more" className="scroll-mt-0 border-t border-line bg-paper-2/50">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 py-16 lg:py-20">
          {/* Steps */}
          <div>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow mb-2">How it works</p>
                <h2 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">From job description to shortlist in three steps.</h2>
              </div>
              <p className="max-w-xs text-sm text-ink-soft">One screen. One standard. Every candidate saved to your dashboard.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { n: "01", icon: UploadCloud, t: "Add", d: "Upload or paste the job description, then add one resume or many. PDF, DOCX and TXT are supported." },
                { n: "02", icon: FileSearch, t: "Screen", d: "Each resume is evaluated against the same requirements, with supporting evidence for every skill." },
                { n: "03", icon: BadgeCheck, t: "Decide", d: "Review the ranked shortlist, then accept, talk to the candidate, or reject in a single click." },
              ].map((s) => (
                <article key={s.n} className="group relative flex gap-4 rounded-2xl border border-line bg-card p-6 shadow-soft transition-transform duration-300 hover:-translate-y-1">
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

          {/* Capabilities */}
          <div>
            <div className="mb-8">
              <p className="eyebrow mb-2">Why teams choose TalentLens</p>
              <h2 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">Fast to run. Fair by design.</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: Scale, t: "Same resume, same verdict", d: "The AI reads and compares. The score and recommendation are calculated in code, so the same resume gets the same verdict every time." },
                { icon: Quote, t: "Proof, not hunches", d: "Every requirement is marked present, partial or missing, with the supporting detail pulled straight from the resume." },
                { icon: CopyCheck, t: "No double screening", d: "Repeat resumes are caught automatically, and returning candidates are flagged with links to their earlier records." },
                { icon: History, t: "A trail for every call", d: "Every screening, decision and settings change is logged, searchable and exportable." },
              ].map((f) => (
                <article key={f.t} className="rounded-2xl border border-line bg-card p-6 shadow-soft">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-moss text-forest">
                    <f.icon size={19} />
                  </span>
                  <h3 className="font-display mt-4 text-xl font-semibold">{f.t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{f.d}</p>
                </article>
              ))}
            </div>
          </div>

          {/* Outcomes */}
          <div className="rounded-[1.75rem] bg-panel-deep px-6 py-8 text-on-panel shadow-lift sm:px-10 sm:py-10">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-display text-3xl font-semibold leading-tight">Three outcomes. No ambiguity.</h2>
              <p className="max-w-md text-sm text-on-panel/65">Every score maps to a clear recommendation. Thresholds are configurable; these are the defaults.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { icon: CheckCircle2, c: "text-[#7fd1a4]", t: "Accept", d: "Strong match. Proceed directly to the L1 and L2 interviews.", b: "Score 75+" },
                { icon: MessageCircleQuestion, c: "text-[#f0c36a]", t: "Talk to candidate", d: "Promising, but some requirements are unclear. A short HR conversation decides.", b: "Score 50–74" },
                { icon: XCircle, c: "text-[#f19a86]", t: "Reject", d: "Key requirements are missing. The entry is closed with a clear reason on file.", b: "Below 50" },
              ].map((o) => (
                <article key={o.t} className="rounded-2xl border border-on-panel/10 bg-on-panel/5 p-5 transition-colors hover:bg-on-panel/10">
                  <div className="flex items-center justify-between">
                    <o.icon size={26} className={o.c} />
                    <span className="rounded-full border border-on-panel/15 px-2.5 py-0.5 font-mono text-xs text-on-panel/70">{o.b}</span>
                  </div>
                  <h3 className="font-display mt-3 text-xl font-semibold">{o.t}</h3>
                  <p className="mt-1 text-sm text-on-panel/70">{o.d}</p>
                </article>
              ))}
            </div>
          </div>

          {/* Data + CTA */}
          <div className="grid items-stretch gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-2xl border border-line bg-card p-7 shadow-soft">
              <h3 className="font-display text-2xl font-semibold">Plugs into your stack</h3>
              <dl className="mt-5 space-y-4 text-sm">
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
              <p className="mt-5 border-t border-line pt-4 text-sm text-ink-soft">
                Choose both in Settings. Pair Ollama with your own database and candidate data never leaves your network.
              </p>
            </div>

            <div className="relative flex flex-col justify-center overflow-hidden rounded-2xl bg-panel px-8 py-8 text-on-panel shadow-lift">
              <div aria-hidden className="absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-[#d9482b]/25 blur-3xl" />
              <h2 className="font-display relative text-3xl font-semibold leading-tight">See it work on a real job description.</h2>
              <p className="relative mt-2 text-sm text-on-panel/75">Sign in to the demo and screen your first candidate today.</p>
              <Link href="/signin" className={cx(btn.ghost, "relative mt-6 w-fit !border-0 !bg-on-panel !px-6 !py-3 !text-panel hover:!bg-mint")}>
                Sign in to the demo <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </div>

        <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-5 text-sm text-ink-soft">
          <Logo />
          <p>Proof of concept · Your data stays where you choose to store it</p>
        </footer>
      </section>
    </div>
  );
}
