import fs from "node:fs";
import path from "node:path";
import { sameDbTarget } from "./settings-public";
import type { DbConfig, DbType, Provider, Settings } from "./types";

/**
 * Settings live in a small JSON file (data/settings.json), not in the database:
 * the database connection itself has to be stored somewhere we can read before connecting.
 * Candidates, jobs and decisions are stored in whichever database is chosen here.
 */

export const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "settings.json");
const LEGACY_FILE = path.join(DATA_DIR, "screening.json"); // older versions kept everything in here

export const DEFAULT_DB: DbConfig = {
  type: "sqlite",
  file: "data/talentlens.db",
  host: "localhost",
  port: 0,
  database: "talentlens",
  user: "",
  password: "",
  ssl: false,
};

export const DEFAULT_SETTINGS: Settings = {
  provider: "gemini",
  openaiKey: "",
  openaiModel: "gpt-4o-mini",
  openaiUrl: "https://api.openai.com/v1",
  anthropicKey: "",
  anthropicModel: "claude-sonnet-5-5",
  anthropicUrl: "https://api.anthropic.com",
  geminiKey: "",
  geminiModel: "gemini-flash-latest",
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "",
  acceptThreshold: 75,
  talkThreshold: 50,
  db: DEFAULT_DB,
};

declare global {
  var __tlSettings: Settings | undefined;
}

const merge = (saved: Partial<Settings> | undefined): Settings => ({
  ...DEFAULT_SETTINGS,
  ...saved,
  db: { ...DEFAULT_DB, ...saved?.db },
});

function load(): Settings {
  const read = (f: string) => {
    try {
      return JSON.parse(fs.readFileSync(f, "utf8"));
    } catch {
      return null;
    }
  };
  if (fs.existsSync(FILE)) {
    const saved = read(FILE);
    if (saved) return merge(saved);
    // Don't silently reset a damaged file (it would drop the API keys) — keep a copy and start from defaults.
    fs.copyFileSync(FILE, `${FILE}.corrupt-${Date.now()}`);
    return merge(undefined);
  }
  // First run after upgrading: carry the old settings (API key, thresholds) over from the JSON store.
  return merge(read(LEGACY_FILE)?.settings);
}

export function getSettings(): Settings {
  if (!globalThis.__tlSettings) globalThis.__tlSettings = load();
  return globalThis.__tlSettings;
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = merge({ ...getSettings(), ...patch, db: { ...getSettings().db, ...patch.db } });
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
  globalThis.__tlSettings = next;
  return next;
}

const PROVIDERS: Provider[] = ["openai", "anthropic", "gemini", "ollama"];
const DB_TYPES: DbType[] = ["sqlite", "postgres", "mysql", "mssql"];
const str = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);

/**
 * Merge what the Settings form sent over the saved settings. A blank API key or password means
 * "keep the one already saved" (the form never receives them back).
 */
export function applyForm(saved: Settings, b: Partial<Omit<Settings, "db">> & { db?: Partial<DbConfig> }): Settings {
  const next: Settings = { ...saved, db: { ...saved.db } };
  if (PROVIDERS.includes(b.provider as Provider)) next.provider = b.provider as Provider;

  for (const k of ["openaiKey", "anthropicKey", "geminiKey"] as const) next[k] = str(b[k]) || saved[k];
  for (const k of ["openaiUrl", "anthropicUrl", "ollamaUrl"] as const) next[k] = str(b[k]) || saved[k];
  for (const k of ["openaiModel", "anthropicModel", "geminiModel"] as const) next[k] = str(b[k]) || saved[k];
  next.ollamaModel = str(b.ollamaModel) ?? saved.ollamaModel; // may be cleared

  const acc = Number(b.acceptThreshold);
  const talk = Number(b.talkThreshold);
  if (Number.isFinite(acc) && Number.isFinite(talk)) {
    next.acceptThreshold = Math.round(acc);
    next.talkThreshold = Math.round(talk);
  }

  const d = b.db;
  if (d) {
    if (DB_TYPES.includes(d.type as DbType)) next.db.type = d.type as DbType;
    next.db.file = str(d.file) || saved.db.file;
    next.db.host = str(d.host) ?? saved.db.host;
    next.db.database = str(d.database) ?? saved.db.database;
    next.db.user = str(d.user) ?? saved.db.user;
    if (d.port !== undefined) {
      const port = Math.round(Number(d.port));
      next.db.port = Number.isFinite(port) && port >= 0 && port <= 65535 ? port : saved.db.port;
    }
    if (typeof d.ssl === "boolean") next.db.ssl = d.ssl;
    // A blank password keeps the saved one only while we're still talking to the same server and user —
    // otherwise an old password would silently follow HR to a different database.
    next.db.password = typeof d.password === "string" && d.password ? d.password : sameDbTarget(saved.db, next.db) ? saved.db.password : "";
  }
  return next;
}

/** Why the settings can't be saved, or "" if they're fine. */
export function validate(s: Settings): string {
  if (!(s.talkThreshold >= 1 && s.acceptThreshold <= 100 && s.talkThreshold < s.acceptThreshold))
    return "Recommendation levels must satisfy: reject level < accept level, within 1–100.";
  const d = s.db;
  if (d.type === "sqlite") {
    if (!d.file.trim()) return "Enter a file name for the SQLite database.";
  } else {
    if (!d.host.trim()) return "Enter the database server address.";
    if (!d.database.trim()) return "Enter the database name.";
    if (!d.user.trim()) return "Enter the database user name.";
  }
  return "";
}
