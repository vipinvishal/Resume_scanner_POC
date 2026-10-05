import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { gateMissing } from "./gate";
import {
  STATUS_LABEL,
  VERDICT_LABEL,
  type AuditAction,
  type AuditRow,
  type CandidateDetail,
  type CandidateRow,
  type DashboardData,
  type DbConfig,
  type DbType,
  type DupRef,
  type HrStatus,
  type JobRequirements,
  type JobRow,
  type Report,
} from "./types";
import { DATA_DIR, getSettings } from "./settings";
import { openMssql } from "./store/mssql";
import { openMysql } from "./store/mysql";
import { openPostgres } from "./store/postgres";
import { openSqlite } from "./store/sqlite";
import { FriendlyDbError, createDatabase, isMissingDatabase } from "./store/create";
import { TABLES, type Driver } from "./store/types";

export { DEFAULT_SETTINGS, getSettings, saveSettings } from "./settings";

const { jobs: JOBS, candidates: CANDS, history: HIST, audit: AUDIT } = TABLES;

/* ───────── connecting ───────── */

export const DB_LABEL: Record<DbType, string> = {
  sqlite: "SQLite",
  postgres: "PostgreSQL",
  mysql: "MySQL / MariaDB",
  mssql: "SQL Server",
};

const OPENERS: Record<DbType, (c: DbConfig) => Promise<Driver>> = {
  sqlite: openSqlite,
  postgres: openPostgres,
  mysql: openMysql,
  mssql: openMssql,
};

/**
 * Open a connection and make sure our tables exist. If the database named in the settings doesn't
 * exist yet, it is created first (`state.created` is set so the caller can say so).
 * Throws an error HR can act on.
 */
export async function connect(cfg: DbConfig, state?: { created: boolean }): Promise<Driver> {
  const attempt = async () => {
    const d = await OPENERS[cfg.type](cfg);
    try {
      await d.migrate();
      return d;
    } catch (e) {
      await d.close().catch(() => {});
      throw e;
    }
  };
  try {
    try {
      return await attempt();
    } catch (e) {
      if (!isMissingDatabase(cfg.type, e)) throw e;
      await createDatabase(cfg);
      if (state) state.created = true;
      return await attempt();
    }
  } catch (e) {
    if (e instanceof FriendlyDbError) throw e;
    const raw = (e as { message?: string; code?: string }).message || (e as { code?: string }).code || String(e);
    const where = cfg.type === "sqlite" ? cfg.file : `${cfg.host}${cfg.port ? `:${cfg.port}` : ""}/${cfg.database}`;
    const hint = /ERR_UNKNOWN_BUILTIN_MODULE|node:sqlite/.test(raw) ? " SQLite needs Node.js 22.13 or newer." : "";
    throw new Error(`Can't use the ${DB_LABEL[cfg.type]} database (${where}): ${raw}.${hint}`.replace(/\.\./g, "."));
  }
}

/** Connect (creating the database and tables if needed) and disconnect — used by "Test connection" and before saving. */
export async function testDatabase(cfg: DbConfig): Promise<{ created: boolean }> {
  const state = { created: false };
  const d = await connect(cfg, state);
  await d.close();
  return state;
}

declare global {
  var __tlDb: { key: string; ready: Promise<Driver> } | undefined;
}

/** Bump when the tables change, so a running server reconnects and upgrades them. */
const SCHEMA_VERSION = 2;

async function db(): Promise<Driver> {
  const cfg = getSettings().db;
  const key = `${SCHEMA_VERSION}:${JSON.stringify(cfg)}`;
  const cur = globalThis.__tlDb;
  if (cur?.key === key) return cur.ready;

  // The settings changed: let the old connection go.
  cur?.ready.then((d) => d.close()).catch(() => {});
  const ready = connect(cfg).then(async (d) => {
    await importLegacyJson(d);
    await backfill(d);
    return d;
  });
  const entry = { key, ready };
  globalThis.__tlDb = entry;
  // A failed connection must not be cached: try again on the next request.
  ready.catch(() => {
    if (globalThis.__tlDb === entry) globalThis.__tlDb = undefined;
  });
  return ready;
}

/**
 * Older versions kept everything in data/screening.json. The first time an empty database is
 * connected, bring those jobs, candidates and decisions across, then set the file aside.
 */
async function importLegacyJson(d: Driver) {
  const file = path.join(DATA_DIR, "screening.json");
  if (!fs.existsSync(file)) return;
  const n = async (t: string) => Number((await d.all<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`))[0].n);
  if ((await n(JOBS)) || (await n(CANDS))) return;

  let old: { jobs?: JobRow[]; candidates?: (Record<string, unknown> & { id: number; job_id: number })[]; history?: Record<string, unknown>[] };
  try {
    old = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return; // unreadable: leave it where it is for someone to look at
  }
  const jobIds = new Map<number, number>();
  for (const j of [...(old.jobs ?? [])].sort((a, b) => a.id - b.id))
    jobIds.set(j.id, await d.insert(JOBS, { title: j.title, jd_text: j.jd_text, requirements: JSON.stringify(j.requirements), created_at: j.created_at }));

  const candIds = new Map<number, number>();
  for (const c of [...(old.candidates ?? [])].sort((a, b) => a.id - b.id)) {
    if (!jobIds.has(c.job_id)) continue;
    candIds.set(
      c.id,
      await d.insert(CANDS, {
        job_id: jobIds.get(c.job_id),
        name: c.name,
        email: c.email ?? "",
        candidate_role: c.current_role ?? "",
        file_name: c.file_name ?? "",
        resume_text: c.resume_text ?? "",
        score: c.score,
        ai_verdict: c.ai_verdict,
        hr_status: c.hr_status,
        note: c.note ?? "",
        source: c.source ?? "bulk",
        provider: c.provider ?? "",
        model: c.model ?? "",
        report: JSON.stringify(c.report),
        created_at: c.created_at,
        decided_at: c.decided_at ?? null,
      }),
    );
  }
  for (const h of old.history ?? []) {
    const cid = candIds.get(h.candidate_id as number);
    if (cid) await d.insert(HIST, { candidate_id: cid, from_status: h.from_status ?? null, to_status: h.to_status, note: h.note ?? "", created_at: h.created_at });
  }
  fs.renameSync(file, `${file}.migrated`);
}

const now = () => new Date().toISOString();

/** Same text, same hash — ignoring case and spacing, so a re-saved copy of a resume still matches. */
export const textHash = (t: string) => createHash("sha256").update(t.replace(/\s+/g, " ").trim().toLowerCase()).digest("hex");

/** Rows saved by an older version have no hashes yet; fill them in once. */
async function backfill(d: Driver) {
  for (const r of await d.all<{ id: number; resume_text: string }>(`SELECT id, resume_text FROM ${CANDS} WHERE resume_hash IS NULL`))
    await d.run(`UPDATE ${CANDS} SET resume_hash = ? WHERE id = ?`, [textHash(r.resume_text ?? ""), r.id]);
  for (const r of await d.all<{ id: number; jd_text: string }>(`SELECT id, jd_text FROM ${JOBS} WHERE jd_hash IS NULL`))
    await d.run(`UPDATE ${JOBS} SET jd_hash = ? WHERE id = ?`, [textHash(r.jd_text ?? ""), r.id]);
}

/** Local calendar days (YYYY-MM-DD) → the ISO timestamps that bound them, for the date filters. */
function dayRange(from?: string, to?: string): { sql: string[]; params: string[] } {
  const sql: string[] = [];
  const params: string[] = [];
  if (from) {
    sql.push("c.created_at >= ?");
    params.push(new Date(`${from}T00:00:00`).toISOString());
  }
  if (to) {
    const end = new Date(`${to}T00:00:00`);
    end.setDate(end.getDate() + 1);
    sql.push("c.created_at < ?");
    params.push(end.toISOString());
  }
  return { sql, params };
}

/* ───────── audit trail ───────── */

interface AuditInput {
  actor: string;
  action: AuditAction;
  summary: string;
  candidateId?: number | null;
  jobId?: number | null;
  detail?: unknown;
}

async function writeAudit(d: Driver, e: AuditInput) {
  // The log is a record of what happened; a problem writing it must never undo or block the action itself.
  try {
    await d.insert(AUDIT, {
      at: now(),
      actor: e.actor.slice(0, 100),
      action: e.action,
      candidate_id: e.candidateId ?? null,
      job_id: e.jobId ?? null,
      summary: e.summary.slice(0, 500),
      detail: e.detail === undefined ? null : JSON.stringify(e.detail),
    });
  } catch (err) {
    console.error("Could not write the audit log:", (err as Error).message);
  }
}

export async function logAudit(e: AuditInput) {
  await writeAudit(await db(), e);
}

export async function listAudit(f: { action?: string; q?: string; limit?: number; offset?: number } = {}): Promise<{ rows: AuditRow[]; more: boolean }> {
  const d = await db();
  const limit = Math.min(Math.max(f.limit ?? 50, 1), 5000);
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.action && f.action !== "all") {
    where.push("action = ?");
    params.push(f.action);
  }
  if (f.q?.trim()) {
    where.push("(LOWER(summary) LIKE ? OR LOWER(actor) LIKE ?)");
    const like = `%${f.q.trim().toLowerCase()}%`;
    params.push(like, like);
  }
  const rows = await d.all<AuditRow>(
    `SELECT id, at, actor, action, candidate_id, job_id, summary FROM ${AUDIT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY id DESC${d.limit(limit + 1, f.offset ?? 0)}`,
    params,
  );
  return {
    rows: rows.slice(0, limit).map((r) => ({ ...r, id: Number(r.id), candidate_id: r.candidate_id == null ? null : Number(r.candidate_id), job_id: r.job_id == null ? null : Number(r.job_id) })),
    more: rows.length > limit,
  };
}

/* ───────── jobs ───────── */

interface JobDbRow {
  id: number;
  title: string;
  jd_text: string;
  requirements: string;
  created_at: string;
}

const toJob = (r: JobDbRow): JobRow => ({ id: Number(r.id), title: r.title, jd_text: r.jd_text, requirements: JSON.parse(r.requirements), created_at: r.created_at });

export async function createJob(title: string, jdText: string, requirements: JobRequirements, actor = "system"): Promise<JobRow> {
  const d = await db();
  const created_at = now();
  const id = await d.insert(JOBS, { title, jd_text: jdText, requirements: JSON.stringify(requirements), created_at, jd_hash: textHash(jdText) });
  await writeAudit(d, { actor, action: "job_created", jobId: id, summary: `Saved job description "${title}" with ${requirements.requirements.length} requirements` });
  return { id, title, jd_text: jdText, requirements, created_at };
}

/** The same job description pasted twice should be one saved job, not two. */
export async function findJobByText(jdText: string): Promise<JobRow | null> {
  const rows = await (await db()).all<JobDbRow>(`SELECT * FROM ${JOBS} WHERE jd_hash = ? ORDER BY id`, [textHash(jdText)]);
  return rows[0] ? toJob(rows[0]) : null;
}

export async function getJob(id: number): Promise<JobRow | null> {
  const rows = await (await db()).all<JobDbRow>(`SELECT * FROM ${JOBS} WHERE id = ?`, [id]);
  return rows[0] ? toJob(rows[0]) : null;
}

export async function listJobs(): Promise<{ id: number; title: string; created_at: string; candidates: number }[]> {
  const rows = await (await db()).all<{ id: number; title: string; created_at: string; candidates: number }>(
    `SELECT j.id, j.title, j.created_at, COUNT(c.id) AS candidates
       FROM ${JOBS} j LEFT JOIN ${CANDS} c ON c.job_id = j.id
      GROUP BY j.id, j.title, j.created_at
      ORDER BY j.id DESC`,
  );
  return rows.map((r) => ({ ...r, id: Number(r.id), candidates: Number(r.candidates) }));
}

/** Set which skills of a job are mandatory, and re-check everyone already screened for it. */
export async function setMandatory(jobId: number, ids: string[], actor: string): Promise<JobRow | null> {
  const d = await db();
  const job = await getJob(jobId);
  if (!job) return null;
  const before = job.requirements.requirements.filter((r) => r.mandatory).map((r) => r.id).sort().join(",");
  job.requirements.requirements = job.requirements.requirements.map((r) => ({ ...r, mandatory: ids.includes(r.id) }));
  await d.run(`UPDATE ${JOBS} SET requirements = ? WHERE id = ?`, [JSON.stringify(job.requirements), jobId]);

  for (const c of await d.all<{ id: number; report: string; gate_missing: string | null }>(`SELECT id, report, gate_missing FROM ${CANDS} WHERE job_id = ?`, [jobId])) {
    const next = JSON.stringify(gateMissing(job.requirements.requirements, (JSON.parse(c.report) as Report).skills));
    if (next !== (c.gate_missing ?? "[]")) await d.run(`UPDATE ${CANDS} SET gate_missing = ? WHERE id = ?`, [next, c.id]);
  }
  const after = job.requirements.requirements.filter((r) => r.mandatory);
  if (after.map((r) => r.id).sort().join(",") !== before)
    await writeAudit(d, {
      actor,
      action: "gate_changed",
      jobId,
      summary: after.length ? `Mandatory skills for "${job.title}": ${after.map((r) => r.text).join(", ")}` : `No mandatory skills for "${job.title}"`,
    });
  return job;
}

/* ───────── candidates ───────── */

const LIST_COLS = `c.id, c.job_id, j.title AS job_title, c.name, c.email, c.candidate_role, c.file_name, c.score,
  c.ai_verdict, c.hr_status, c.note, c.source, c.provider, c.model, c.created_at, c.decided_at, c.gate_missing`;

type CandDbRow = Omit<CandidateRow, "current_role" | "gate_missing" | "dup_count" | "report"> & {
  candidate_role: string;
  gate_missing: string | null;
  report?: string;
};

function toRow(r: CandDbRow, dupCount = 0): CandidateRow {
  const { candidate_role, report, gate_missing, ...rest } = r;
  return {
    ...rest,
    id: Number(r.id),
    job_id: Number(r.job_id),
    score: Number(r.score),
    job_title: r.job_title ?? "",
    current_role: candidate_role,
    decided_at: r.decided_at ?? null,
    gate_missing: gate_missing ? JSON.parse(gate_missing) : [],
    dup_count: dupCount,
    ...(report ? { report: JSON.parse(report) as Report } : {}),
  };
}

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
/** A name is only a usable "same person" signal when it's a real name, not a file name or a single word. */
const usableName = (n: string) => n.length >= 5 && n.includes(" ") && !/\.(pdf|docx?|txt|md)$/.test(n);

/**
 * Other records that look like the same person: the identical file, the same email, or the same full name.
 * Email and file matches are strong; a name match is only a hint (two people can share a name).
 */
export async function findDuplicates(input: { name: string; email: string; hash: string; jobId: number; excludeId?: number }): Promise<DupRef[]> {
  const name = norm(input.name);
  const email = norm(input.email);
  const rows = await (await db()).all<{ id: number; job_id: number; job_title: string | null; name: string; email: string; score: number; created_at: string; resume_hash: string | null }>(
    `SELECT c.id, c.job_id, j.title AS job_title, c.name, c.email, c.score, c.created_at, c.resume_hash
       FROM ${CANDS} c LEFT JOIN ${JOBS} j ON j.id = c.job_id
      WHERE c.id <> ? AND (c.resume_hash = ? OR LOWER(c.email) = ? OR LOWER(c.name) = ?)
      ORDER BY c.id DESC`,
    [input.excludeId ?? 0, input.hash, email || null, usableName(name) ? name : null],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    name: r.name,
    job_id: Number(r.job_id),
    job_title: r.job_title ?? "",
    score: Number(r.score),
    created_at: r.created_at,
    same_job: Number(r.job_id) === input.jobId,
    basis: r.resume_hash === input.hash ? ("file" as const) : email && norm(r.email) === email ? ("email" as const) : ("name" as const),
  }));
}

/** The earlier result for this exact resume file on this job, if any. */
export async function findSameFile(jobId: number, hash: string): Promise<number | null> {
  const rows = await (await db()).all<{ id: number }>(`SELECT id FROM ${CANDS} WHERE job_id = ? AND resume_hash = ? ORDER BY id`, [jobId, hash]);
  return rows[0] ? Number(rows[0].id) : null;
}

export async function insertCandidate(input: {
  jobId: number;
  fileName: string;
  resumeText: string;
  report: Report;
  source: "instant" | "bulk";
  provider: string;
  model: string;
  gateMissing?: string[];
  actor?: string;
}): Promise<number> {
  const d = await db();
  const { report } = input;
  const name = (report.candidate.name || input.fileName).slice(0, 255);
  const gate = input.gateMissing ?? [];
  const id = await d.insert(CANDS, {
    job_id: input.jobId,
    name,
    email: (report.candidate.email ?? "").slice(0, 255),
    candidate_role: (report.candidate.currentRole ?? "").slice(0, 255),
    file_name: input.fileName.slice(0, 500),
    resume_text: input.resumeText,
    score: report.score,
    ai_verdict: report.verdict,
    hr_status: "pending",
    note: "",
    source: input.source,
    provider: input.provider.slice(0, 30),
    model: input.model.slice(0, 120),
    report: JSON.stringify(report),
    created_at: now(),
    decided_at: null,
    resume_hash: textHash(input.resumeText),
    gate_missing: JSON.stringify(gate),
  });
  const job = await getJob(input.jobId);
  await writeAudit(d, {
    actor: input.actor ?? "system",
    action: "screened",
    candidateId: id,
    jobId: input.jobId,
    summary: `Screened ${name} for "${job?.title ?? "a job"}" — match ${report.score}, AI suggests ${VERDICT_LABEL[report.verdict]}${gate.length ? `, NOT ELIGIBLE (missing ${gate.join(", ")})` : ""}`,
  });
  return id;
}

export interface CandidateFilter {
  status?: HrStatus | "all";
  jobId?: number;
  q?: string;
  from?: string; // YYYY-MM-DD (local day)
  to?: string;
  /** Include each candidate's full report (large — only for one job's shortlist). */
  withReport?: boolean;
}

export async function listCandidates(f: CandidateFilter = {}): Promise<CandidateRow[]> {
  const d = await db();
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.status && f.status !== "all") {
    where.push("c.hr_status = ?");
    params.push(f.status);
  }
  if (f.jobId) {
    where.push("c.job_id = ?");
    params.push(f.jobId);
  }
  const range = dayRange(f.from, f.to);
  where.push(...range.sql);
  params.push(...range.params);

  const q = f.q?.toLowerCase();
  const rows = await d.all<CandDbRow>(
    `SELECT ${LIST_COLS}${q || f.withReport ? ", c.report" : ""}
       FROM ${CANDS} c LEFT JOIN ${JOBS} j ON j.id = c.job_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY c.id DESC`,
    params,
  );

  // "Seen before" — group everyone by email and by full name, then count the others in each person's group.
  const people = await d.all<{ id: number; name: string; email: string }>(`SELECT id, name, email FROM ${CANDS}`);
  const byEmail = new Map<string, number[]>();
  const byName = new Map<string, number[]>();
  const push = (m: Map<string, number[]>, k: string, id: number) => k && m.set(k, [...(m.get(k) ?? []), id]);
  for (const p of people) {
    push(byEmail, norm(p.email), Number(p.id));
    const n = norm(p.name);
    if (usableName(n)) push(byName, n, Number(p.id));
  }
  const dupCount = (id: number, name: string, email: string) => {
    const others = new Set([...(byEmail.get(norm(email)) ?? []), ...(usableName(norm(name)) ? (byName.get(norm(name)) ?? []) : [])]);
    others.delete(id);
    return others.size;
  };

  // Search covers the whole report (skills, summary…), which is easiest to match in code so every database behaves the same.
  return rows
    .filter((r) => !q || `${r.name}\n${r.email}\n${r.candidate_role}\n${r.report ?? ""}`.toLowerCase().includes(q))
    .map((r) => {
      const row = toRow(r, dupCount(Number(r.id), r.name, r.email));
      if (!f.withReport) delete row.report; // it was only fetched for searching
      return row;
    });
}

export async function getCandidate(id: number): Promise<CandidateDetail | null> {
  const d = await db();
  const rows = await d.all<CandDbRow & { report: string; jd_text: string | null; requirements: string | null; resume_hash: string | null }>(
    `SELECT ${LIST_COLS}, c.report, c.resume_hash, j.jd_text, j.requirements FROM ${CANDS} c LEFT JOIN ${JOBS} j ON j.id = c.job_id WHERE c.id = ?`,
    [id],
  );
  const r = rows[0];
  if (!r) return null;
  const history = await d.all<{ id: number; from_status: string | null; to_status: string; note: string; created_at: string }>(
    `SELECT id, from_status, to_status, note, created_at FROM ${HIST} WHERE candidate_id = ? ORDER BY id DESC`,
    [id],
  );
  const duplicates = await findDuplicates({ name: r.name, email: r.email, hash: r.resume_hash ?? "", jobId: Number(r.job_id), excludeId: id });
  const reqs = (r.requirements ? (JSON.parse(r.requirements) as JobRequirements).requirements : []);
  const { report, ...row } = toRow(r, duplicates.length);
  void report;
  return {
    ...row,
    report: JSON.parse(r.report),
    jd_text: r.jd_text ?? "",
    history: history.map((h) => ({ ...h, id: Number(h.id) })),
    duplicates,
    mandatory_ids: reqs.filter((x) => x.mandatory).map((x) => x.id),
  };
}

export async function updateCandidateStatus(id: number, status: HrStatus, note?: string, actor = "system"): Promise<boolean> {
  const d = await db();
  const cur = (await d.all<{ hr_status: HrStatus; note: string; name: string; job_id: number }>(`SELECT hr_status, note, name, job_id FROM ${CANDS} WHERE id = ?`, [id]))[0];
  if (!cur) return false;
  const nextNote = note === undefined ? cur.note : note;
  if (cur.hr_status !== status || nextNote !== cur.note) {
    await d.insert(HIST, { candidate_id: id, from_status: cur.hr_status, to_status: status, note: nextNote, created_at: now() });
    const moved = cur.hr_status !== status;
    await writeAudit(d, {
      actor,
      action: "decision",
      candidateId: id,
      jobId: Number(cur.job_id),
      summary: moved
        ? `${cur.name}: ${STATUS_LABEL[cur.hr_status]} → ${STATUS_LABEL[status]}${nextNote ? ` — "${nextNote.slice(0, 120)}"` : ""}`
        : `${cur.name}: note updated — "${nextNote.slice(0, 160)}"`,
    });
  }
  await d.run(`UPDATE ${CANDS} SET hr_status = ?, note = ?, decided_at = ? WHERE id = ?`, [status, nextNote, status === "pending" ? null : now(), id]);
  return true;
}

export async function deleteCandidate(id: number, actor = "system") {
  const d = await db();
  const cur = (await d.all<{ name: string; job_id: number }>(`SELECT name, job_id FROM ${CANDS} WHERE id = ?`, [id]))[0];
  await d.run(`DELETE FROM ${HIST} WHERE candidate_id = ?`, [id]);
  await d.run(`DELETE FROM ${CANDS} WHERE id = ?`, [id]);
  if (cur) await writeAudit(d, { actor, action: "deleted", candidateId: id, jobId: Number(cur.job_id), summary: `Deleted the record of ${cur.name}` });
}

export async function getStats(opts: { from?: string; to?: string } = {}) {
  const range = dayRange(opts.from, opts.to);
  const rows = await (await db()).all<{ hr_status: HrStatus; n: number; total: number }>(
    `SELECT c.hr_status, COUNT(*) AS n, SUM(c.score) AS total FROM ${CANDS} c ${range.sql.length ? `WHERE ${range.sql.join(" AND ")}` : ""} GROUP BY c.hr_status`,
    range.params,
  );
  const by: Record<HrStatus, number> = { pending: 0, accepted: 0, rejected: 0, talk: 0 };
  let count = 0;
  let sum = 0;
  for (const r of rows) {
    by[r.hr_status] = Number(r.n);
    count += Number(r.n);
    sum += Number(r.total);
  }
  return { total: count, ...by, avgScore: count ? Math.round(sum / count) : 0 };
}

/* ───────── dashboard ───────── */

const WEEKS = 8;
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Monday 00:00 (server's local time) of the week containing `d`. */
const weekStart = (d: Date) => {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
};

export async function getDashboard(opts: { jobId?: number } = {}): Promise<DashboardData> {
  const rows = await (await db()).all<{ created_at: string; decided_at: string | null; hr_status: HrStatus; gate_missing: string | null }>(
    `SELECT c.created_at, c.decided_at, c.hr_status, c.gate_missing FROM ${CANDS} c ${opts.jobId ? "WHERE c.job_id = ?" : ""}`,
    opts.jobId ? [opts.jobId] : [],
  );

  const first = weekStart(new Date());
  first.setDate(first.getDate() - 7 * (WEEKS - 1));
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date(first);
    start.setDate(start.getDate() + 7 * i);
    return {
      start: dayKey(start),
      label: start.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
      accepted: 0,
      talk: 0,
      rejected: 0,
      pending: 0,
      total: 0,
      avgHours: null as number | null,
      decided: 0,
      hours: 0,
    };
  });

  const out = { screened: rows.length, decided: 0, accepted: 0, talk: 0, rejected: 0, pending: 0, notEligible: 0 };
  let hoursSum = 0;
  for (const r of rows) {
    out[r.hr_status]++;
    if (r.hr_status !== "pending") out.decided++;
    if (r.gate_missing && r.gate_missing !== "[]") out.notEligible++;
    const hours = r.decided_at && r.hr_status !== "pending" ? Math.max(0, (new Date(r.decided_at).getTime() - new Date(r.created_at).getTime()) / 3_600_000) : null;
    if (hours !== null) hoursSum += hours;
    const w = weeks[Math.floor((weekStart(new Date(r.created_at)).getTime() - first.getTime()) / (7 * 86_400_000) + 0.5)];
    if (!w) continue; // older than the chart window
    w[r.hr_status]++;
    w.total++;
    if (hours !== null) {
      w.decided++;
      w.hours += hours;
    }
  }
  const thisWeek = weeks[WEEKS - 1].total;
  return {
    weeks: weeks.map(({ hours, ...w }) => ({ ...w, avgHours: w.decided ? hours / w.decided : null })),
    ...out,
    thisWeek,
    lastWeek: weeks[WEEKS - 2].total,
    acceptRate: out.decided ? Math.round((out.accepted / out.decided) * 100) : null,
    avgHours: out.decided ? hoursSum / out.decided : null,
  };
}
