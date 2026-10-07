"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AlertCircle, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { cx } from "./ui";

type Msg = { role: "user" | "assistant" | "error"; content: string };

const STORE = "talentlens.chat"; // this browser session only: nothing about the chat is saved on the server
const JOB_KEY = "talentlens.job"; // the job open on Home (set by the Home page)
const MAX = 1000;

/* ───────── what the chat is "looking at" ───────── */
const subscribeJob = (cb: () => void) => {
  window.addEventListener("talentlens:job", cb);
  return () => window.removeEventListener("talentlens:job", cb);
};
const readJob = () => {
  try {
    return sessionStorage.getItem(JOB_KEY) ?? "";
  } catch {
    return "";
  }
};

function load(): Msg[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(STORE) ?? "[]");
    return Array.isArray(v) ? v.filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant")) : [];
  } catch {
    return [];
  }
}
const save = (m: Msg[]) => {
  try {
    sessionStorage.setItem(STORE, JSON.stringify(m.filter((x) => x.role !== "error").slice(-40)));
  } catch {}
};

/* ───────── tiny, safe markdown: **bold**, [links](/internal), bullets ───────── */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(\/[^)\s]*\))/g);
  return (
    <>
      {parts.map((p, i) => {
        const link = p.match(/^\[([^\]]+)\]\((\/[^)\s]*)\)$/);
        if (link)
          return (
            <Link key={i} href={link[2]} className="font-medium text-forest underline underline-offset-2 hover:opacity-80">
              {link[1]}
            </Link>
          );
        if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

function Rich({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim());
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length)
      out.push(
        <ul key={`u${out.length}`} className="my-1.5 list-disc space-y-1 pl-5">
          {bullets.map((b, i) => (
            <li key={i}>
              <Inline text={b} />
            </li>
          ))}
        </ul>,
      );
    bullets = [];
  };
  for (const l of lines) {
    const m = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (m) bullets.push(m[1]);
    else {
      flush();
      out.push(
        <p key={`p${out.length}`} className="my-1.5 first:mt-0 last:mb-0">
          <Inline text={l} />
        </p>,
      );
    }
  }
  flush();
  return <>{out}</>;
}

export default function Chatbot() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false); // once opened, the panel stays mounted so an answer in flight isn't lost
  const [messages, setMessages] = useState<Msg[]>(load);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const abort = useRef<AbortController | null>(null);

  const candidateId = Number(path.match(/^\/candidates\/(\d+)/)?.[1]) || undefined;
  const homeJob = useSyncExternalStore(subscribeJob, readJob, () => "");
  const jobId = !candidateId && path.startsWith("/home") ? Number(homeJob) || undefined : undefined;
  const focus = candidateId ? "this candidate" : jobId ? "the selected job" : "all candidates";

  const suggestions = candidateId
    ? ["Summarize this candidate", "What are the main gaps?", "Why did the AI suggest this?", "What should I check in an interview?"]
    : jobId
      ? ["Who are the top 3 for this job?", "Who is not eligible, and why?", "How many are waiting for a decision?", "Which skill do most candidates lack?"]
      : ["How many candidates are waiting for a decision?", "Who are the top 3 across all jobs?", "Who is not eligible?", "How do I make a skill mandatory?"];

  useEffect(() => {
    if (open) {
      bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, busy, open]);
  useEffect(() => {
    if (open) field.current?.focus();
  }, [open]);

  function toggle() {
    setOpened(true);
    setOpen((o) => !o);
  }

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: text.slice(0, MAX) }];
    setMessages(next);
    save(next);
    setInput("");
    setBusy(true);
    abort.current = new AbortController();
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.current.signal,
        body: JSON.stringify({
          messages: next.filter((m) => m.role !== "error").slice(-20),
          context: { ...(candidateId ? { candidateId } : {}), ...(jobId ? { jobId } : {}) },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "The assistant couldn't answer. Please try again.");
      const done: Msg[] = [...next, { role: "assistant", content: String(data.answer) }];
      setMessages(done);
      save(done);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setMessages([...next, { role: "error", content: (e as Error).message }]);
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    abort.current?.abort();
    setMessages([]);
    save([]);
    setBusy(false);
    field.current?.focus();
  }

  return (
    <>
      {/* The launcher: a ring that keeps turning, a soft pulse, a gentle float and a twinkling icon, so it's easy to spot. It calms down while the chat is open. */}
      <div className={cx("no-print fixed bottom-5 right-5 z-40", !open && "animate-bob")}>
        {!open && (
          <span
            aria-hidden
            className="animate-fade pointer-events-none absolute right-full top-1/2 mr-4 hidden -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-card px-3.5 py-2 text-sm font-semibold shadow-lift sm:flex"
          >
            <Sparkles size={14} className="text-[#d9482b]" /> Ask AI
          </span>
        )}
        {!open && <span aria-hidden className="animate-halo absolute inset-0 rounded-full bg-[#d9482b]" />}
        <span
          aria-hidden
          className={cx("absolute -inset-[3px] rounded-full", !open && "animate-spin-slow")}
          style={{ background: "conic-gradient(from 0deg, #d9482b, #f0b35a, #f3b49f, transparent 55%, #d9482b)" }}
        />
        <button
          type="button"
          onClick={toggle}
          aria-label={open ? "Close the assistant" : "Open the assistant"}
          aria-expanded={open}
          title="Ask TalentLens"
          className="relative grid h-14 w-14 place-items-center rounded-full bg-forest text-paper shadow-lift transition-transform hover:scale-105 active:scale-95"
        >
          {open ? <X size={22} /> : <Sparkles size={24} className="animate-twinkle" />}
        </button>
      </div>

      {opened && (
        <section
          aria-label="TalentLens assistant"
          aria-hidden={!open}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          className={cx(
            "no-print animate-pop fixed bottom-24 right-5 z-40 flex h-[min(620px,calc(100dvh-8rem))] w-[400px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-lift",
            !open && "hidden",
          )}
        >
          <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3.5">
            <div className="min-w-0">
              <p className="font-display flex items-center gap-2 text-lg font-semibold leading-tight">
                <Sparkles size={16} className="text-forest" /> TalentLens assistant
              </p>
              <p className="mt-0.5 text-xs text-ink-soft">
                Answers from your screened candidates · read-only · looking at <b className="font-medium text-ink">{focus}</b>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {messages.length > 0 && (
                <button onClick={clear} title="Clear chat" aria-label="Clear chat" className="grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-paper-2 hover:text-ink">
                  <RotateCcw size={15} />
                </button>
              )}
              <button onClick={() => setOpen(false)} title="Close" aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-paper-2 hover:text-ink">
                <X size={17} />
              </button>
            </div>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {messages.length === 0 && (
              <div className="animate-tab">
                <p className="text-sm text-ink-soft">Ask about your candidates, scores and decisions, or how to use TalentLens. I can&apos;t change anything. Decisions stay with you.</p>
                <div className="mt-3 flex flex-col items-start gap-2">
                  {suggestions.map((s) => (
                    <button key={s} onClick={() => send(s)} className="rounded-full border border-line-strong bg-paper/60 px-3.5 py-1.5 text-left text-sm hover:border-forest/60 hover:bg-moss/40">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="animate-row flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-forest px-3.5 py-2 text-sm text-paper">{m.content}</p>
                </div>
              ) : m.role === "assistant" ? (
                <div key={i} className="animate-row flex">
                  <div className="max-w-[92%] break-words rounded-2xl rounded-bl-md bg-paper-2 px-3.5 py-2.5 text-sm leading-relaxed">
                    <Rich text={m.content} />
                  </div>
                </div>
              ) : (
                <div key={i} role="alert" className="animate-row flex items-start gap-2 rounded-xl border border-reject/30 bg-reject-bg/70 px-3.5 py-2.5 text-sm text-reject">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <p>
                    {m.content}
                    {/settings/i.test(m.content) && (
                      <>
                        {" "}
                        <Link href="/settings" className="font-medium underline">
                          Open Settings
                        </Link>
                      </>
                    )}
                  </p>
                </div>
              ),
            )}

            {busy && (
              <div className="flex" aria-label="The assistant is typing">
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-paper-2 px-4 py-3">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-faint" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottom} />
          </div>

          <form
            onSubmit={(e) => (e.preventDefault(), send(input))}
            className="flex items-end gap-2 border-t border-line bg-card px-3 py-3"
          >
            <label htmlFor="chat-input" className="sr-only">
              Ask a question
            </label>
            <textarea
              id="chat-input"
              ref={field}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Ask a question…"
              className="max-h-28 min-h-[2.6rem] flex-1 resize-none rounded-2xl border border-line-strong bg-paper/50 px-3.5 py-2.5 text-sm outline-none transition focus:border-forest focus:bg-card focus:ring-4 focus:ring-forest/10"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-forest text-paper transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
