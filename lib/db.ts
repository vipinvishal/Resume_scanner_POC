import fs from "node:fs";
import path from "node:path";
import type {
  CandidateDetail,
  CandidateRow,
  HrStatus,
  JobRequirements,
  JobRow,
  Report,
  Settings,
  Verdict,
} from "./types";

/**
 * Storage is a single JSON file (data/screening.json) — no native modules, nothing to compile.
 * Every function here is synchronous, so a read-modify-write never interleaves with another request.
 * Writes go to a temp file first and are renamed into place, so a crash can't leave half a file.
 */

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "screening.json");

interface CandidateRecord extends Omit<CandidateRow, "job_title"> {
  resume_text: string;
  report: Report;
}

interface HistoryRecord {
  id: number;
  candidate_id: number;
  from_status: string | null;
  to_status: string;
  note: string;
  created_at: string;
}

interface Store {
  nextId: { job: number; candidate: number; history: number };
  settings: Partial<Settings>;
  jobs: JobRow[];
  candidates: CandidateRecord[];
  history: HistoryRecord[];
}

declare global {
  var __tlStore: Store | undefined;
}

const emptyStore = (): Store => ({
  nextId: { job: 1, candidate: 1, history: 1 },
  settings: {},
  jobs: [],
  candidates: [],
  history: [],
});

function load(): Store {
  fs.mkdirSync(DB_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) return emptyStore();
  const raw = fs.readFileSync(DB_FILE, "utf8");
  try {
    return { ...emptyStore(), ...JSON.parse(raw) };
  } catch {
    // Don't silently start empty (the next save would overwrite the data) — keep a copy and stop.
    const backup = `${DB_FILE}.corrupt-${Date.now()}`;
    fs.copyFileSync(DB_FILE, backup);
    throw new Error(`data/screening.json is not valid JSON. A copy was saved as ${path.basename(backup)}. Fix or delete the file.`);
  }
}

function store(): Store {
  if (!globalThis.__tlStore) globalThis.__tlStore = load();
  return globalThis.__tlStore;
}

function persist() {
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store(), null, 2));
  fs.renameSync(tmp, DB_FILE);
}

const now = () => new Date().toISOString();

/** Local calendar day (YYYY-MM-DD) of a stored timestamp, for the date filters. */
function localDay(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ───────── settings ───────── */

export const DEFAULT_SETTINGS: Settings = {
  provider: "gemini",
  geminiKey: "",
  geminiModel: "gemini-flash-latest",
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "",
  acceptThreshold: 75,
  talkThreshold: 50,
};

export function getSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...store().settings };
}

export function saveSettings(patch: Partial<Settings>) {
  const s = store();
  for (const [k, v] of Object.entries(patch)) {
    if (k in DEFAULT_SETTINGS) (s.settings as Record<string, unknown>)[k] = v;
  }
  persist();
}

/* ───────── jobs ───────── */

export function createJob(title: string, jdText: string, requirements: JobRequirements): JobRow {
  const s = store();
  const job: JobRow = { id: s.nextId.job++, title, jd_text: jdText, requirements, created_at: now() };
  s.jobs.push(job);
  persist();
  return job;
}

export function getJob(id: number): JobRow | null {
  return store().jobs.find((j) => j.id === id) ?? null;
}

export function listJobs(): { id: number; title: string; created_at: string; candidates: number }[] {
  const s = store();
  return [...s.jobs]
    .sort((a, b) => b.id - a.id)
    .map((j) => ({
      id: j.id,
      title: j.title,
      created_at: j.created_at,
      candidates: s.candidates.filter((c) => c.job_id === j.id).length,
    }));
}

/* ───────── candidates ───────── */

function toRow(c: CandidateRecord, jobTitle: string): CandidateRow {
  // Leave out the heavy fields (resume text, full report) for list views.
  const { resume_text: _resume, report: _report, ...row } = c;
  void _resume;
  void _report;
  return { ...row, job_title: jobTitle };
}

export function insertCandidate(input: {
  jobId: number;
  fileName: string;
  resumeText: string;
  report: Report;
  source: "instant" | "bulk";
  provider: string;
  model: string;
}): number {
  const s = store();
  const { report } = input;
  const id = s.nextId.candidate++;
  s.candidates.push({
    id,
    job_id: input.jobId,
    name: report.candidate.name || input.fileName,
    email: report.candidate.email,
    current_role: report.candidate.currentRole,
    file_name: input.fileName,
    resume_text: input.resumeText,
    score: report.score,
    ai_verdict: report.verdict,
    hr_status: "pending",
    note: "",
    source: input.source,
    provider: input.provider,
    model: input.model,
    report,
    created_at: now(),
    decided_at: null,
  });
  persist();
  return id;
}

export interface CandidateFilter {
  status?: HrStatus | "all";
  jobId?: number;
  q?: string;
  from?: string; // YYYY-MM-DD (local day)
  to?: string;
}

export function listCandidates(f: CandidateFilter = {}): CandidateRow[] {
  const s = store();
  const q = f.q?.toLowerCase();
  return s.candidates
    .filter((c) => {
      if (f.status && f.status !== "all" && c.hr_status !== f.status) return false;
      if (f.jobId && c.job_id !== f.jobId) return false;
      if (q) {
        const hay = `${c.name}\n${c.email}\n${c.current_role}\n${JSON.stringify(c.report)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const day = localDay(c.created_at);
      if (f.from && day < f.from) return false;
      if (f.to && day > f.to) return false;
      return true;
    })
    .sort((a, b) => b.id - a.id)
    .map((c) => toRow(c, getJob(c.job_id)?.title ?? ""));
}

export function getCandidate(id: number): CandidateDetail | null {
  const c = store().candidates.find((x) => x.id === id);
  if (!c) return null;
  const job = getJob(c.job_id);
  const history = store()
    .history.filter((h) => h.candidate_id === id)
    .sort((a, b) => b.id - a.id)
    .map(({ id: hid, from_status, to_status, note, created_at }) => ({ id: hid, from_status, to_status, note, created_at }));
  return { ...toRow(c, job?.title ?? ""), report: c.report, jd_text: job?.jd_text ?? "", history };
}

export function updateCandidateStatus(id: number, status: HrStatus, note?: string): boolean {
  const s = store();
  const c = s.candidates.find((x) => x.id === id);
  if (!c) return false;
  const nextNote = note === undefined ? c.note : note;
  if (c.hr_status !== status || nextNote !== c.note) {
    s.history.push({
      id: s.nextId.history++,
      candidate_id: id,
      from_status: c.hr_status,
      to_status: status,
      note: nextNote,
      created_at: now(),
    });
  }
  c.hr_status = status;
  c.note = nextNote;
  c.decided_at = status === "pending" ? null : now();
  persist();
  return true;
}

export function deleteCandidate(id: number) {
  const s = store();
  s.candidates = s.candidates.filter((c) => c.id !== id);
  s.history = s.history.filter((h) => h.candidate_id !== id);
  persist();
}

export function getStats(opts: { from?: string; to?: string } = {}) {
  const rows = store().candidates.filter((c) => {
    const day = localDay(c.created_at);
    return !(opts.from && day < opts.from) && !(opts.to && day > opts.to);
  });
  const by: Record<HrStatus, number> = { pending: 0, accepted: 0, rejected: 0, talk: 0 };
  for (const c of rows) by[c.hr_status]++;
  const avg = rows.length ? rows.reduce((sum, c) => sum + c.score, 0) / rows.length : 0;
  return {
    total: rows.length,
    ...by,
    avgScore: Math.round(avg),
  };
}

export type { Verdict };
