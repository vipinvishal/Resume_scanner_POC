import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  FileSearch,
  Files,
  HardDrive,
  ListChecks,
  MessageCircleQuestion,
  Sparkles,
  UploadCloud,
  XCircle,
  Zap,
} from "lucide-react";
import { Logo, ScoreRing, btn, cx } from "@/components/ui";

const delay = (ms: number) => ({ animationDelay: `${ms}ms` });

export default function Landing() {
  return (
    <div className="overflow-x-clip">
      {/* ───── Nav ───── */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <div className="hidden items-center gap-8 text-sm text-ink-soft md:flex">
          <a href="#how" className="hover:text-ink">How it works</a>
          <a href="#outcomes" className="hover:text-ink">Outcomes</a>
          <a href="#modes" className="hover:text-ink">Two ways to screen</a>
          <a href="#private" className="hover:text-ink">Your data</a>
        </div>
        <Link href="/signin" className={btn.primary}>
          Sign in <ArrowRight size={16} />
        </Link>
      </nav>

      {/* ───── Hero ───── */}
      <header className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 pb-24 pt-10 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-24 h-[520px] w-[520px] rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(closest-side, #dfe9d6, transparent)" }}
        />
        <div className="relative">
          <p className="eyebrow animate-rise mb-6 inline-flex items-center gap-2 rounded-full border border-line-strong bg-card/70 px-3 py-1.5">
            <Sparkles size={13} className="text-vermilion" style={{ color: "#d9482b" }} /> Resume screening for HR &amp; talent teams
          </p>
          <h1 className="font-display animate-rise text-[2.9rem] font-semibold leading-[1.02] sm:text-6xl lg:text-[4.3rem]" style={delay(80)}>
            Read every resume.
            <br />
            <span className="italic font-normal text-forest">Keep the right ones.</span>
          </h1>
          <p className="animate-rise mt-7 max-w-xl text-lg leading-relaxed text-ink-soft" style={delay(180)}>
            Drop in the job description and the resumes. TalentLens compares skill by skill, explains the match in plain English,
            and tells you whether to <b className="text-ink">accept</b>, <b className="text-ink">talk to the candidate</b>, or <b className="text-ink">reject</b>.
          </p>
          <div className="animate-rise mt-9 flex flex-wrap items-center gap-3" style={delay(280)}>
            <Link href="/signin" className={cx(btn.primary, "!px-7 !py-3.5 text-base")}>
              Try the demo <ArrowRight size={18} />
            </Link>
            <a href="#how" className={cx(btn.ghost, "!px-6 !py-3.5 text-base")}>
              See how it works
            </a>
          </div>
          <dl className="animate-rise mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-line pt-6" style={delay(380)}>
            {[
              ["1 JD", "many resumes"],
              ["3", "clear outcomes"],
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
        <div className="relative mx-auto w-full max-w-[460px] pb-10 lg:mx-0">
          <div className="animate-float rounded-3xl border border-line bg-card p-6 shadow-lift [--r:1.6deg]" style={{ transform: "rotate(1.6deg)" }}>
            <div className="flex items-center gap-5">
              <ScoreRing score={82} verdict="accept" size={104} />
              <div>
                <p className="eyebrow">Candidate report</p>
                <p className="font-display text-2xl font-semibold leading-tight">Aarav Mehta</p>
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
          <div
            className="animate-rise absolute -bottom-2 -left-4 flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 shadow-lift sm:-left-10"
            style={delay(700)}
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-talk-bg text-talk">
              <MessageCircleQuestion size={18} />
            </span>
            <div className="text-sm leading-tight">
              <b>Priya S.</b>
              <br />
              <span className="text-ink-soft">Talk to candidate · 64</span>
            </div>
          </div>
          <div
            className="animate-rise absolute -right-2 -top-4 hidden items-center gap-2 rounded-full border border-line bg-card px-3.5 py-2 text-xs font-semibold shadow-lift sm:flex"
            style={delay(900)}
          >
            <Zap size={14} className="text-forest" /> Report ready in seconds
          </div>
        </div>
      </header>

      {/* ───── Before / After ───── */}
      <section className="border-y border-line bg-paper-2/50">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-2">
          <div>
            <p className="eyebrow mb-3">Today</p>
            <h2 className="font-display text-3xl font-semibold leading-tight">Screening by hand is slow and uneven.</h2>
            <ul className="mt-6 space-y-3 text-ink-soft">
              {[
                "Pull resumes from groups and the internet, one by one",
                "Keep the technical team's JD open in another window",
                "Match skills by eye, resume after resume",
                "Every reviewer judges a little differently",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <XCircle size={18} className="mt-0.5 shrink-0 text-reject/70" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-forest/20 bg-forest p-8 text-paper shadow-lift">
            <p className="eyebrow !text-moss/80 mb-3">With TalentLens</p>
            <h2 className="font-display text-3xl font-semibold leading-tight">Same JD. Every resume. One consistent standard.</h2>
            <ul className="mt-6 space-y-3 text-paper/85">
              {[
                "Upload the JD once, drop in a batch of resumes",
                "Each resume checked against the same requirement list",
                "A readable report: what matches, what's missing, what to ask",
                "HR keeps the final say — always",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-moss" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ───── How it works ───── */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-8 px-6 py-24">
        <p className="eyebrow mb-3">How it works</p>
        <h2 className="font-display max-w-2xl text-4xl font-semibold leading-tight">From job description to decision in three steps.</h2>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            { n: "01", icon: UploadCloud, t: "Upload", d: "Add the JD from the technical team and one resume or a whole folder of them. PDF, Word, or plain text." },
            { n: "02", icon: FileSearch, t: "Analyse", d: "Requirements are pulled out of the JD, then every resume is checked against them with evidence for each skill." },
            { n: "03", icon: BadgeCheck, t: "Decide", d: "Read the report, then accept, reject, or mark ‘talk to candidate’. Everything is saved to the dashboard." },
          ].map((s, i) => (
            <article key={s.n} className="group relative rounded-3xl border border-line bg-card p-7 shadow-soft transition-transform duration-300 hover:-translate-y-1">
              <span className="font-display absolute right-6 top-4 text-6xl font-semibold text-paper-2 transition-colors group-hover:text-moss">{s.n}</span>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-forest text-paper">
                <s.icon size={20} />
              </span>
              <h3 className="font-display mt-6 text-2xl font-semibold">{s.t}</h3>
              <p className="mt-2 leading-relaxed text-ink-soft">{s.d}</p>
              {i < 2 && <ArrowRight className="absolute -right-5 top-1/2 hidden text-line-strong md:block" size={22} />}
            </article>
          ))}
        </div>
      </section>

      {/* ───── Outcomes ───── */}
      <section id="outcomes" className="scroll-mt-8 bg-ink py-24 text-paper">
        <div className="mx-auto max-w-6xl px-6">
          <p className="eyebrow !text-paper/60 mb-3">Outcomes</p>
          <h2 className="font-display max-w-2xl text-4xl font-semibold leading-tight">Three outcomes. No guesswork.</h2>
          <p className="mt-4 max-w-2xl text-paper/70">
            The match score decides the recommendation using thresholds your team controls — so the same resume always gets the same answer.
          </p>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              { icon: CheckCircle2, c: "text-[#7fd1a4]", t: "Accept", d: "Strong match. Move straight to L1 and L2 interviews.", b: "Score 75+" },
              { icon: MessageCircleQuestion, c: "text-[#f0c36a]", t: "Talk to candidate", d: "Promising but unclear. A short HR call decides, with suggested questions ready.", b: "Score 50–74" },
              { icon: XCircle, c: "text-[#f19a86]", t: "Reject", d: "Key requirements are missing. Close it out with a clear reason on file.", b: "Below 50" },
            ].map((o) => (
              <article key={o.t} className="rounded-3xl border border-paper/10 bg-paper/[0.04] p-7 backdrop-blur transition-colors hover:bg-paper/[0.08]">
                <o.icon size={30} className={o.c} />
                <h3 className="font-display mt-5 text-2xl font-semibold">{o.t}</h3>
                <p className="mt-2 text-paper/70">{o.d}</p>
                <p className="mt-6 inline-block rounded-full border border-paper/15 px-3 py-1 font-mono text-xs text-paper/70">{o.b}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Modes ───── */}
      <section id="modes" className="mx-auto max-w-6xl scroll-mt-8 px-6 py-24">
        <p className="eyebrow mb-3">Two ways to screen</p>
        <h2 className="font-display max-w-2xl text-4xl font-semibold leading-tight">One candidate in a hurry, or a hundred in one go.</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <article className="rounded-3xl border border-line bg-card p-8 shadow-soft">
            <Zap className="text-forest" size={28} />
            <h3 className="font-display mt-5 text-2xl font-semibold">Instant analysis</h3>
            <p className="mt-2 text-ink-soft">A walk-in or a referral? Upload one JD and one resume and get the full report right away.</p>
          </article>
          <article className="rounded-3xl border border-line bg-card p-8 shadow-soft">
            <Files className="text-forest" size={28} />
            <h3 className="font-display mt-5 text-2xl font-semibold">Bulk upload</h3>
            <p className="mt-2 text-ink-soft">Upload one JD and a stack of resumes. Get a ranked shortlist and open any candidate for the detail.</p>
          </article>
        </div>
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-paper-2/40 px-6 py-4 text-ink-soft">
          <ListChecks size={20} className="shrink-0 text-forest" />
          Every candidate and every decision lands on one dashboard, so at the end of the day you can see exactly who was screened and where they stand.
        </div>
      </section>

      {/* ───── Private ───── */}
      <section id="private" className="scroll-mt-8 border-t border-line bg-paper-2/50">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 md:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="eyebrow mb-3">Your data</p>
            <h2 className="font-display text-4xl font-semibold leading-tight">Cloud AI or fully on your own machine.</h2>
            <p className="mt-4 text-ink-soft">
              Choose the engine that fits your environment. Candidate records are stored in a local database file — nothing is uploaded to any service of ours.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-card p-6 shadow-soft">
              <Sparkles className="text-forest" />
              <h3 className="font-display mt-4 text-xl font-semibold">Google Gemini</h3>
              <p className="mt-1 text-sm text-ink-soft">Fast and sharp. Bring your own API key.</p>
            </div>
            <div className="rounded-2xl border border-line bg-card p-6 shadow-soft">
              <HardDrive className="text-forest" />
              <h3 className="font-display mt-4 text-xl font-semibold">Local Ollama</h3>
              <p className="mt-1 text-sm text-ink-soft">Run models such as Qwen on your own laptop. Nothing leaves the building.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ───── CTA ───── */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="relative overflow-hidden rounded-[2rem] bg-forest px-8 py-16 text-center text-paper shadow-lift sm:px-16">
          <div aria-hidden className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-moss/10 blur-2xl" />
          <div aria-hidden className="absolute -bottom-24 -right-10 h-80 w-80 rounded-full bg-[#d9482b]/20 blur-3xl" />
          <h2 className="font-display relative mx-auto max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
            See it on a real job description.
          </h2>
          <p className="relative mx-auto mt-4 max-w-lg text-paper/75">Sign in with the demo account and screen your first candidate in under a minute.</p>
          <Link href="/signin" className={cx(btn.ghost, "relative mt-8 !border-0 !bg-paper !px-8 !py-3.5 text-base !text-forest-deep hover:!bg-white")}>
            Sign in to the demo <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-line px-6 py-8 text-sm text-ink-soft">
        <Logo />
        <p>Proof of concept · Candidate data stays on this machine</p>
      </footer>
    </div>
  );
}
