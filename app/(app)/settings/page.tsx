"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, CheckCircle2, HardDrive, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Card, PageHeader, btn, cx } from "@/components/ui";
import type { Provider } from "@/lib/types";

interface Form {
  provider: Provider;
  geminiKey: string;
  hasGeminiKey: boolean;
  geminiModel: string;
  ollamaUrl: string;
  ollamaModel: string;
  acceptThreshold: number;
  talkThreshold: number;
}

const field =
  "w-full rounded-xl border border-line-strong bg-paper/50 px-4 py-2.5 outline-none transition focus:border-forest focus:bg-card focus:ring-4 focus:ring-forest/10";

export default function SettingsPage() {
  const [f, setF] = useState<Form | null>(null);
  const [models, setModels] = useState<Record<Provider, string[]>>({ gemini: [], ollama: [] });
  const [modelsMsg, setModelsMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [fetching, setFetching] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setF);
  }, []);

  // Auto-load the model list for the selected provider when possible
  useEffect(() => {
    if (!f) return;
    if (f.provider === "ollama" && models.ollama.length === 0) void fetchModels(f);
    if (f.provider === "gemini" && f.hasGeminiKey && models.gemini.length === 0) void fetchModels(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f?.provider, f?.hasGeminiKey]);

  if (!f) return <div className="skeleton h-96 rounded-2xl" />;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF({ ...f, [k]: v });
    setSaved(null);
    setTest(null);
  };

  async function fetchModels(form: Form = f!) {
    setFetching(true);
    setModelsMsg(null);
    const res = await fetch("/api/settings/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    setFetching(false);
    if (!res.ok) return setModelsMsg({ ok: false, text: d.error });
    setModels((m) => ({ ...m, [form.provider]: d.models }));
    setModelsMsg({ ok: true, text: d.models.length ? `${d.models.length} models found` : "Connected, but no models are installed yet." });
    if (form.provider === "ollama" && !form.ollamaModel && d.models.length) {
      const pick = d.models.find((m: string) => /qwen/i.test(m)) ?? d.models[0];
      setF((cur) => (cur ? { ...cur, ollamaModel: pick } : cur));
    }
  }

  async function runTest() {
    setTesting(true);
    setTest(null);
    const res = await fetch("/api/settings/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const d = await res.json();
    setTesting(false);
    setTest(res.ok ? { ok: true, text: `Connected — the model replied in ${(d.ms / 1000).toFixed(1)}s.` } : { ok: false, text: d.error });
  }

  async function save() {
    const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const d = await res.json();
    if (!res.ok) return setSaved({ ok: false, text: d.error });
    setF(d);
    setSaved({ ok: true, text: "Settings saved." });
    // refresh the engine pill in the sidebar
    window.location.reload();
  }

  const options = (p: Provider) => {
    const cur = p === "gemini" ? f.geminiModel : f.ollamaModel;
    const list = models[p];
    return cur && !list.includes(cur) ? [cur, ...list] : list;
  };

  const providers: { key: Provider; icon: React.ElementType; title: string; desc: string }[] = [
    { key: "gemini", icon: Sparkles, title: "Google Gemini", desc: "Cloud model. Needs an API key and internet." },
    { key: "ollama", icon: HardDrive, title: "Ollama (local)", desc: "Runs on this laptop. Nothing leaves the machine." },
  ];

  return (
    <>
      <PageHeader eyebrow="Settings" title="AI engine" />
      <div className="max-w-3xl space-y-6">
        <Card className="p-7">
          <h2 className="font-display text-2xl font-semibold">Which engine should do the analysis?</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label="AI provider">
            {providers.map((p) => {
              const on = f.provider === p.key;
              return (
                <button key={p.key} role="radio" aria-checked={on} onClick={() => set("provider", p.key)} className={cx("relative rounded-2xl border-2 p-5 text-left transition-all", on ? "border-forest bg-moss/40 shadow-soft" : "border-line bg-paper/40 hover:border-line-strong")}>
                  {on && <span className="absolute right-4 top-4 grid h-6 w-6 place-items-center rounded-full bg-forest text-paper"><Check size={14} /></span>}
                  <p.icon className="text-forest" size={24} />
                  <p className="font-display mt-3 text-xl font-semibold">{p.title}</p>
                  <p className="mt-1 text-sm text-ink-soft">{p.desc}</p>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-7">
          {f.provider === "gemini" ? (
            <div className="space-y-5">
              <h2 className="font-display text-2xl font-semibold">Gemini</h2>
              <div>
                <label htmlFor="key" className="mb-1.5 block text-sm font-medium">API key</label>
                <input id="key" type="password" autoComplete="off" className={field} value={f.geminiKey} onChange={(e) => set("geminiKey", e.target.value)} placeholder={f.hasGeminiKey ? "•••••••• saved — type to replace" : "Paste your Gemini API key"} />
                <p className="mt-1.5 text-xs text-ink-soft">Stored in the local database on this machine only.</p>
              </div>
              <ModelPicker label="Model" value={f.geminiModel} options={options("gemini")} onChange={(v) => set("geminiModel", v)} onRefresh={() => fetchModels()} fetching={fetching} msg={modelsMsg} />
            </div>
          ) : (
            <div className="space-y-5">
              <h2 className="font-display text-2xl font-semibold">Ollama</h2>
              <div>
                <label htmlFor="url" className="mb-1.5 block text-sm font-medium">Ollama address</label>
                <input id="url" className={field} value={f.ollamaUrl} onChange={(e) => set("ollamaUrl", e.target.value)} />
              </div>
              <ModelPicker label="Model" value={f.ollamaModel} options={options("ollama")} onChange={(v) => set("ollamaModel", v)} onRefresh={() => fetchModels()} fetching={fetching} msg={modelsMsg} placeholder="e.g. qwen3:8b" />
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-6">
            <button onClick={runTest} disabled={testing} className={btn.ghost}>
              {testing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Test connection
            </button>
            {test && (
              <p role="status" className={cx("flex items-center gap-2 text-sm", test.ok ? "text-accept" : "text-reject")}>
                {test.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {test.text}
              </p>
            )}
          </div>
        </Card>

        <Card className="p-7">
          <h2 className="font-display text-2xl font-semibold">Recommendation levels</h2>
          <p className="mt-1 text-sm text-ink-soft">The match score decides the AI recommendation. HR can always override it.</p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="acc" className="mb-1.5 block text-sm font-medium">Accept at or above</label>
              <input id="acc" type="number" min={2} max={100} className={field} value={f.acceptThreshold} onChange={(e) => set("acceptThreshold", Number(e.target.value))} />
            </div>
            <div>
              <label htmlFor="tk" className="mb-1.5 block text-sm font-medium">Talk to candidate at or above</label>
              <input id="tk" type="number" min={1} max={99} className={field} value={f.talkThreshold} onChange={(e) => set("talkThreshold", Number(e.target.value))} />
            </div>
          </div>
          <p className="mt-3 text-sm text-ink-soft">Below {f.talkThreshold} → Reject · {f.talkThreshold}–{f.acceptThreshold - 1} → Talk to candidate · {f.acceptThreshold}+ → Accept</p>
        </Card>

        <div className="flex items-center gap-4">
          <button onClick={save} className={cx(btn.primary, "!px-8")}>Save settings</button>
          {saved && <p role="status" className={cx("text-sm", saved.ok ? "text-accept" : "text-reject")}>{saved.text}</p>}
        </div>
      </div>
    </>
  );
}

function ModelPicker({
  label,
  value,
  options,
  onChange,
  onRefresh,
  fetching,
  msg,
  placeholder,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  onRefresh: () => void;
  fetching: boolean;
  msg: { ok: boolean; text: string } | null;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor="model" className="mb-1.5 block text-sm font-medium">{label}</label>
      <div className="flex gap-2">
        {options.length > 0 ? (
          <select id="model" value={value} onChange={(e) => onChange(e.target.value)} className={field}>
            {!value && <option value="">Select a model…</option>}
            {options.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        ) : (
          <input id="model" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "Model name"} className={field} />
        )}
        <button type="button" onClick={onRefresh} disabled={fetching} className={cx(btn.ghost, "shrink-0")} title="Fetch the list of available models">
          {fetching ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Fetch models
        </button>
      </div>
      {msg && <p className={cx("mt-1.5 text-xs", msg.ok ? "text-ink-soft" : "text-reject")}>{msg.text}</p>}
    </div>
  );
}
