"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Database, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Card, PageHeader, btn, cx } from "@/components/ui";
import type { DbType, Provider } from "@/lib/types";
import { sameDbTarget, type PublicSettings } from "@/lib/settings-public";

type Form = PublicSettings;
type Msg = { ok: boolean; text: string } | null;

const field =
  "w-full rounded-xl border border-line-strong bg-paper/50 px-4 py-2.5 outline-none transition focus:border-forest focus:bg-card focus:ring-4 focus:ring-forest/10";

const PROVIDERS: { key: Provider; label: string; desc: string }[] = [
  { key: "openai", label: "OpenAI", desc: "GPT models. Needs an API key and internet." },
  { key: "anthropic", label: "Anthropic", desc: "Claude models. Needs an API key and internet." },
  { key: "gemini", label: "Google Gemini", desc: "Gemini models. Needs an API key and internet." },
  { key: "ollama", label: "Ollama (local)", desc: "Runs on this laptop. Nothing leaves the machine." },
];

const DATABASES: { key: DbType; label: string; desc: string; port: number }[] = [
  { key: "sqlite", label: "SQLite (built in)", desc: "A single file on this computer. No setup needed — a good starting point.", port: 0 },
  { key: "postgres", label: "PostgreSQL", desc: "Use your company's PostgreSQL server.", port: 5432 },
  { key: "mysql", label: "MySQL / MariaDB", desc: "Use your company's MySQL or MariaDB server.", port: 3306 },
  { key: "mssql", label: "SQL Server", desc: "Use your company's Microsoft SQL Server.", port: 1433 },
];

const KEY = { openai: "openaiKey", anthropic: "anthropicKey", gemini: "geminiKey" } as const;
const HAS = { openai: "hasOpenaiKey", anthropic: "hasAnthropicKey", gemini: "hasGeminiKey" } as const;
const MODEL = { openai: "openaiModel", anthropic: "anthropicModel", gemini: "geminiModel", ollama: "ollamaModel" } as const;
const URL_FIELD = { openai: "openaiUrl", anthropic: "anthropicUrl" } as const;

export default function SettingsPage() {
  const [f, setF] = useState<Form | null>(null);
  const [savedDb, setSavedDb] = useState<Form["db"] | null>(null); // the database settings as last saved
  const [models, setModels] = useState<Record<Provider, string[]>>({ openai: [], anthropic: [], gemini: [], ollama: [] });
  const [modelsMsg, setModelsMsg] = useState<Msg>(null);
  const [fetching, setFetching] = useState(false);
  const [test, setTest] = useState<Msg>(null);
  const [testing, setTesting] = useState(false);
  const [dbTest, setDbTest] = useState<Msg>(null);
  const [dbTesting, setDbTesting] = useState(false);
  const [saved, setSaved] = useState<Msg>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d: Form) => (setF(d), setSavedDb(d.db)));
  }, []);

  // Load the model list for the selected provider when we can (Ollama needs no key; the others need a saved one).
  const provider = f?.provider;
  const canList = !!f && (f.provider === "ollama" || f[HAS[f.provider as keyof typeof HAS]]);
  useEffect(() => {
    if (f && provider && canList && models[provider].length === 0) void fetchModels(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, canList]);

  if (!f) return <div className="skeleton h-96 rounded-2xl" />;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF({ ...f, [k]: v });
    setSaved(null);
    setTest(null);
    if (k === "provider") setModelsMsg(null);
  };
  const setDb = <K extends keyof Form["db"]>(k: K, v: Form["db"][K]) => {
    setF({ ...f, db: { ...f.db, [k]: v } });
    setSaved(null);
    setDbTest(null);
  };
  const post = async (url: string, body: unknown) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, data: await res.json() };
  };

  async function fetchModels(form: Form = f!) {
    setFetching(true);
    setModelsMsg(null);
    const { ok, data } = await post("/api/settings/models", form);
    setFetching(false);
    if (!ok) return setModelsMsg({ ok: false, text: data.error });
    setModels((m) => ({ ...m, [form.provider]: data.models }));
    setModelsMsg({ ok: true, text: data.models.length ? `${data.models.length} models found` : "Connected, but no models are installed yet." });
    if (form.provider === "ollama" && !form.ollamaModel && data.models.length) {
      const pick = data.models.find((m: string) => /qwen/i.test(m)) ?? data.models[0];
      setF((cur) => (cur ? { ...cur, ollamaModel: pick } : cur));
    }
  }

  async function runTest() {
    setTesting(true);
    setTest(null);
    const { ok, data } = await post("/api/settings/test", f);
    setTesting(false);
    setTest(ok ? { ok: true, text: `Connected — the model replied in ${(data.ms / 1000).toFixed(1)}s.` } : { ok: false, text: data.error });
  }

  async function runDbTest() {
    setDbTesting(true);
    setDbTest(null);
    const { ok, data } = await post("/api/settings/db", { db: f!.db });
    setDbTesting(false);
    setDbTest(ok ? { ok: true, text: data.created ? `Created the new database "${data.database}" and set it up — ready to use.` : "Connected — the database is ready to use." } : { ok: false, text: data.error });
  }

  async function save() {
    setSaving(true);
    setSaved(null);
    const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const d = await res.json();
    setSaving(false);
    if (!res.ok) return setSaved({ ok: false, text: d.error });
    setF(d);
    setSaved({ ok: true, text: "Settings saved." });
    // refresh the engine pill in the top bar
    window.location.reload();
  }

  const modelOptions = (p: Provider) => {
    const cur = f[MODEL[p]];
    const list = models[p];
    // Before models are fetched this stays empty, so the field is a plain text box and any model name can be typed.
    return list.length && cur && !list.includes(cur) ? [cur, ...list] : list;
  };

  const p = PROVIDERS.find((x) => x.key === f.provider)!;
  const dbInfo = DATABASES.find((x) => x.key === f.db.type)!;
  const keyed = f.provider !== "ollama" ? (f.provider as keyof typeof KEY) : null;

  return (
    <>
      <PageHeader eyebrow="Settings" title="Set it up your way" />
      <div className="max-w-3xl space-y-6">
        {/* ───── AI model ───── */}
        <Card className="p-7">
          <h2 className="font-display flex items-center gap-2.5 text-2xl font-semibold">
            <Sparkles size={22} className="text-forest" /> AI model
          </h2>
          <p className="mt-1 text-sm text-ink-soft">The model that reads the job description and the resumes.</p>

          <div className="mt-5 space-y-5">
            <div>
              <label htmlFor="provider" className="mb-1.5 block text-sm font-medium">Provider</label>
              <Select id="provider" value={f.provider} onChange={(v) => set("provider", v as Provider)}>
                {PROVIDERS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </Select>
              <p className="mt-1.5 text-xs text-ink-soft">{p.desc}</p>
            </div>

            {keyed && (
              <div>
                <label htmlFor="key" className="mb-1.5 block text-sm font-medium">API key</label>
                <input
                  id="key"
                  type="password"
                  autoComplete="off"
                  className={field}
                  value={f[KEY[keyed]]}
                  onChange={(e) => set(KEY[keyed], e.target.value)}
                  placeholder={f[HAS[keyed]] ? "•••••••• saved — type to replace" : `Paste your ${p.label} API key`}
                />
                <p className="mt-1.5 text-xs text-ink-soft">Kept in a settings file on this machine only.</p>
              </div>
            )}

            {f.provider === "ollama" && (
              <div>
                <label htmlFor="url" className="mb-1.5 block text-sm font-medium">Ollama address</label>
                <input id="url" className={field} value={f.ollamaUrl} onChange={(e) => set("ollamaUrl", e.target.value)} />
              </div>
            )}

            <ModelPicker
              value={f[MODEL[f.provider]]}
              options={modelOptions(f.provider)}
              onChange={(v) => set(MODEL[f.provider], v)}
              onRefresh={() => fetchModels()}
              fetching={fetching}
              msg={modelsMsg}
              placeholder={f.provider === "ollama" ? "e.g. qwen3:8b" : "Model name"}
            />

            {(f.provider === "openai" || f.provider === "anthropic") && (
              <details className="group rounded-xl border border-line bg-paper/40 px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
                  Advanced: use a different API address
                  <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-3">
                  <input aria-label="API address" className={field} value={f[URL_FIELD[f.provider]]} onChange={(e) => set(URL_FIELD[f.provider as "openai"], e.target.value)} />
                  <p className="mt-1.5 text-xs text-ink-soft">
                    Only change this if your company routes AI traffic through its own gateway
                    {f.provider === "openai" ? " (any OpenAI-compatible service works)" : ""}.
                  </p>
                </div>
              </details>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-6">
            <button onClick={runTest} disabled={testing} className={btn.ghost}>
              {testing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Test connection
            </button>
            <Result msg={test} />
          </div>
        </Card>

        {/* ───── Database ───── */}
        <Card className="p-7">
          <h2 className="font-display flex items-center gap-2.5 text-2xl font-semibold">
            <Database size={22} className="text-forest" /> Database
          </h2>
          <p className="mt-1 text-sm text-ink-soft">Where candidates, job descriptions and your decisions are saved.</p>

          <div className="mt-5 space-y-5">
            <div>
              <label htmlFor="dbtype" className="mb-1.5 block text-sm font-medium">Database type</label>
              <Select
                id="dbtype"
                value={f.db.type}
                onChange={(v) => {
                  setDb("type", v as DbType);
                }}
              >
                {DATABASES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </Select>
              <p className="mt-1.5 text-xs text-ink-soft">{dbInfo.desc}</p>
            </div>

            {f.db.type === "sqlite" ? (
              <div>
                <label htmlFor="dbfile" className="mb-1.5 block text-sm font-medium">File location</label>
                <input id="dbfile" className={field} value={f.db.file} onChange={(e) => setDb("file", e.target.value)} />
                <p className="mt-1.5 text-xs text-ink-soft">Relative to the app folder, or a full path such as /Users/you/talentlens.db.</p>
              </div>
            ) : (
              <>
                <div className="grid gap-5 sm:grid-cols-[1fr_9rem]">
                  <div>
                    <label htmlFor="dbhost" className="mb-1.5 block text-sm font-medium">Server address</label>
                    <input id="dbhost" className={field} value={f.db.host} onChange={(e) => setDb("host", e.target.value)} placeholder="e.g. localhost or db.company.com" />
                  </div>
                  <div>
                    <label htmlFor="dbport" className="mb-1.5 block text-sm font-medium">Port</label>
                    <input id="dbport" type="number" min={0} max={65535} className={field} value={f.db.port || ""} onChange={(e) => setDb("port", Number(e.target.value))} placeholder={String(dbInfo.port)} />
                  </div>
                </div>
                <div>
                  <label htmlFor="dbname" className="mb-1.5 block text-sm font-medium">Database name</label>
                  <input id="dbname" className={field} value={f.db.database} onChange={(e) => setDb("database", e.target.value)} />
                  <p className="mt-1.5 text-xs text-ink-soft">Don&apos;t worry if it doesn&apos;t exist yet — TalentLens creates it for you (the login needs permission to create databases) and sets up its own tables inside it (names start with <code className="font-mono">tl_</code>).</p>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="dbuser" className="mb-1.5 block text-sm font-medium">User name</label>
                    <input id="dbuser" autoComplete="off" className={field} value={f.db.user} onChange={(e) => setDb("user", e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="dbpass" className="mb-1.5 block text-sm font-medium">Password</label>
                    <input id="dbpass" type="password" autoComplete="new-password" className={field} value={f.db.password} onChange={(e) => setDb("password", e.target.value)} placeholder={f.db.hasPassword && savedDb && sameDbTarget(savedDb, f.db) ? "•••••••• saved — type to replace" : ""} />
                  </div>
                </div>
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--color-forest)]" checked={f.db.ssl} onChange={(e) => setDb("ssl", e.target.checked)} />
                  Use an encrypted connection (SSL)
                </label>
              </>
            )}

            <p className="rounded-xl bg-paper-2/60 px-4 py-3 text-sm text-ink-soft">
              Switching to a different database starts with an empty list — records already saved stay in the old one.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-6">
            <button onClick={runDbTest} disabled={dbTesting} className={btn.ghost}>
              {dbTesting ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Test connection
            </button>
            <Result msg={dbTest} />
          </div>
        </Card>

        {/* ───── Recommendation levels ───── */}
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

        <div className="flex flex-wrap items-center gap-4">
          <button onClick={save} disabled={saving} className={cx(btn.primary, "!px-8")}>
            {saving && <Loader2 size={16} className="animate-spin" />} Save settings
          </button>
          {saved && <p role="status" className={cx("text-sm", saved.ok ? "text-accept" : "text-reject")}>{saved.text}</p>}
        </div>
      </div>
    </>
  );
}

function Select({ id, value, onChange, children }: { id: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cx(field, "cursor-pointer appearance-none pr-10")}>
        {children}
      </select>
      <ChevronDown size={18} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-soft" />
    </div>
  );
}

function Result({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p role="status" className={cx("flex items-start gap-2 text-sm", msg.ok ? "text-accept" : "text-reject")}>
      {msg.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />} {msg.text}
    </p>
  );
}

function ModelPicker({
  value,
  options,
  onChange,
  onRefresh,
  fetching,
  msg,
  placeholder,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  onRefresh: () => void;
  fetching: boolean;
  msg: Msg;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor="model" className="mb-1.5 block text-sm font-medium">Model</label>
      <div className="flex gap-2">
        {options.length > 0 ? (
          <div className="relative flex-1">
            <select id="model" value={value} onChange={(e) => onChange(e.target.value)} className={cx(field, "cursor-pointer appearance-none pr-10")}>
              {!value && <option value="">Select a model…</option>}
              {options.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <ChevronDown size={18} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-soft" />
          </div>
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
