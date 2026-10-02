import Database from "better-sqlite3";
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

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "screening.db");

declare global {
  var __tlDb: Database.Database | undefined;
}

function open(): Database.Database {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new Database(DB_FILE);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      jd_text TEXT NOT NULL,
      requirements TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      current_role TEXT NOT NULL DEFAULT '',
      file_name TEXT NOT NULL DEFAULT '',
      resume_text TEXT NOT NULL,
      score INTEGER NOT NULL,
      ai_verdict TEXT NOT NULL,
      hr_status TEXT NOT NULL DEFAULT 'pending',
      note TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'instant',
      provider TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      report TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      decided_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_cand_status ON candidates(hr_status);
    CREATE INDEX IF NOT EXISTS idx_cand_job ON candidates(job_id);
    CREATE TABLE IF NOT EXISTS status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
      from_status TEXT,
      to_status TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

export function db(): Database.Database {
  if (!globalThis.__tlDb) globalThis.__tlDb = open();
  return globalThis.__tlDb;
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
  const rows = db().prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.value);
    } catch {
      /* ignore corrupt value */
    }
  }
  return out as unknown as Settings;
}

export function saveSettings(patch: Partial<Settings>) {
  const stmt = db().prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  );
  const tx = db().transaction((entries: [string, unknown][]) => {
    for (const [k, v] of entries) if (k in DEFAULT_SETTINGS) stmt.run(k, JSON.stringify(v));
  });
  tx(Object.entries(patch));
}

/* ───────── jobs ───────── */

export function createJob(title: string, jdText: string, requirements: JobRequirements): JobRow {
  const info = db()
    .prepare("INSERT INTO jobs (title, jd_text, requirements) VALUES (?, ?, ?)")
    .run(title, jdText, JSON.stringify(requirements));
  return getJob(Number(info.lastInsertRowid))!;
}

export function getJob(id: number): JobRow | null {
  const r = db().prepare("SELECT * FROM jobs WHERE id = ?").get(id) as
    | (Omit<JobRow, "requirements"> & { requirements: string })
    | undefined;
  return r ? { ...r, requirements: JSON.parse(r.requirements) } : null;
}

export function listJobs(): { id: number; title: string; created_at: string; candidates: number }[] {
  return db()
    .prepare(
      `SELECT j.id, j.title, j.created_at, COUNT(c.id) AS candidates
       FROM jobs j LEFT JOIN candidates c ON c.job_id = j.id
       GROUP BY j.id ORDER BY j.id DESC`,
    )
    .all() as { id: number; title: string; created_at: string; candidates: number }[];
}

/* ───────── candidates ───────── */

const LIST_COLS = `c.id, c.job_id, j.title AS job_title, c.name, c.email, c.current_role, c.file_name,
  c.score, c.ai_verdict, c.hr_status, c.note, c.source, c.provider, c.model, c.created_at, c.decided_at`;

export function insertCandidate(input: {
  jobId: number;
  fileName: string;
  resumeText: string;
  report: Report;
  source: "instant" | "bulk";
  provider: string;
  model: string;
}): number {
  const { report } = input;
  const info = db()
    .prepare(
      `INSERT INTO candidates
       (job_id, name, email, current_role, file_name, resume_text, score, ai_verdict, source, provider, model, report)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.jobId,
      report.candidate.name || input.fileName,
      report.candidate.email,
      report.candidate.currentRole,
      input.fileName,
      input.resumeText,
      report.score,
      report.verdict,
      input.source,
      input.provider,
      input.model,
      JSON.stringify(report),
    );
  return Number(info.lastInsertRowid);
}

export interface CandidateFilter {
  status?: HrStatus | "all";
  jobId?: number;
  q?: string;
  from?: string; // YYYY-MM-DD (local day)
  to?: string;
}

export function listCandidates(f: CandidateFilter = {}): CandidateRow[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (f.status && f.status !== "all") {
    where.push("c.hr_status = ?");
    args.push(f.status);
  }
  if (f.jobId) {
    where.push("c.job_id = ?");
    args.push(f.jobId);
  }
  if (f.q) {
    where.push("(c.name LIKE ? OR c.email LIKE ? OR c.current_role LIKE ? OR c.report LIKE ?)");
    const like = `%${f.q}%`;
    args.push(like, like, like, like);
  }
  if (f.from) {
    where.push("date(c.created_at, 'localtime') >= ?");
    args.push(f.from);
  }
  if (f.to) {
    where.push("date(c.created_at, 'localtime') <= ?");
    args.push(f.to);
  }
  const sql = `SELECT ${LIST_COLS} FROM candidates c JOIN jobs j ON j.id = c.job_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY c.id DESC`;
  return db().prepare(sql).all(...args) as CandidateRow[];
}

export function getCandidate(id: number): CandidateDetail | null {
  const r = db()
    .prepare(`SELECT ${LIST_COLS}, c.report, j.jd_text FROM candidates c JOIN jobs j ON j.id = c.job_id WHERE c.id = ?`)
    .get(id) as (CandidateRow & { report: string; jd_text: string }) | undefined;
  if (!r) return null;
  const history = db()
    .prepare("SELECT id, from_status, to_status, note, created_at FROM status_history WHERE candidate_id = ? ORDER BY id DESC")
    .all(id) as CandidateDetail["history"];
  return { ...r, report: JSON.parse(r.report) as Report, history };
}

export function updateCandidateStatus(id: number, status: HrStatus, note?: string): boolean {
  const cur = db().prepare("SELECT hr_status, note FROM candidates WHERE id = ?").get(id) as
    | { hr_status: HrStatus; note: string }
    | undefined;
  if (!cur) return false;
  const nextNote = note === undefined ? cur.note : note;
  const tx = db().transaction(() => {
    db()
      .prepare(
        `UPDATE candidates SET hr_status = ?, note = ?,
         decided_at = CASE WHEN ? = 'pending' THEN NULL ELSE datetime('now') END WHERE id = ?`,
      )
      .run(status, nextNote, status, id);
    if (cur.hr_status !== status || nextNote !== cur.note) {
      db()
        .prepare("INSERT INTO status_history (candidate_id, from_status, to_status, note) VALUES (?, ?, ?, ?)")
        .run(id, cur.hr_status, status, nextNote);
    }
  });
  tx();
  return true;
}

export function deleteCandidate(id: number) {
  db().prepare("DELETE FROM candidates WHERE id = ?").run(id);
}

export function getStats(opts: { from?: string; to?: string } = {}) {
  const where: string[] = [];
  const args: string[] = [];
  if (opts.from) {
    where.push("date(created_at, 'localtime') >= ?");
    args.push(opts.from);
  }
  if (opts.to) {
    where.push("date(created_at, 'localtime') <= ?");
    args.push(opts.to);
  }
  const w = where.length ? "WHERE " + where.join(" AND ") : "";
  const rows = db()
    .prepare(`SELECT hr_status AS status, COUNT(*) AS n FROM candidates ${w} GROUP BY hr_status`)
    .all(...args) as { status: HrStatus; n: number }[];
  const by: Record<HrStatus, number> = { pending: 0, accepted: 0, rejected: 0, talk: 0 };
  for (const r of rows) by[r.status] = r.n;
  const avg = db().prepare(`SELECT AVG(score) AS a FROM candidates ${w}`).get(...args) as { a: number | null };
  return {
    total: by.pending + by.accepted + by.rejected + by.talk,
    ...by,
    avgScore: avg.a == null ? 0 : Math.round(avg.a),
  };
}

export type { Verdict };
