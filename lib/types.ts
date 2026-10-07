export type Verdict = "accept" | "talk" | "reject";
export type HrStatus = "pending" | "accepted" | "rejected" | "talk";
export type SkillStatus = "present" | "partial" | "missing";
export type Provider = "openai" | "anthropic" | "gemini" | "ollama";
export type DbType = "sqlite" | "postgres" | "mysql" | "mssql";

/** How to reach the database. SQLite only uses `file`; the others use host/port/database/user/password. */
export interface DbConfig {
  type: DbType;
  file: string;
  host: string;
  port: number; // 0 = the default port for the database type
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}

export interface Requirement {
  id: string;
  text: string;
  type: "must" | "nice";
  /** Hard gate: a candidate who lacks this skill is "Not eligible", whatever their score. */
  mandatory?: boolean;
}

export interface JobRequirements {
  title: string;
  summary: string;
  requirements: Requirement[];
  minYearsExperience: number | null;
  experienceNote: string;
  education: string;
}

export interface SkillMatch {
  id: string;
  requirement: string;
  type: "must" | "nice";
  status: SkillStatus;
  evidence: string;
}

export interface FitBlock {
  required: string;
  candidate: string;
  fit: "exceeds" | "meets" | "partial" | "below" | "unknown";
  comment: string;
}

export interface Report {
  candidate: {
    name: string;
    email: string;
    phone: string;
    currentRole: string;
    location: string;
    totalYears: number | null;
  };
  summary: string;
  score: number;
  scoreBreakdown: { skills: number; experience: number; education: number };
  verdict: Verdict;
  verdictReason: string;
  skills: SkillMatch[];
  experience: FitBlock;
  education: FitBlock;
  strengths: string[];
  gaps: string[];
  risks: string[];
}

export interface Settings {
  provider: Provider;
  openaiKey: string;
  openaiModel: string;
  openaiUrl: string;
  anthropicKey: string;
  anthropicModel: string;
  anthropicUrl: string;
  geminiKey: string;
  geminiModel: string;
  ollamaUrl: string;
  ollamaModel: string;
  acceptThreshold: number;
  talkThreshold: number;
  db: DbConfig;
}

export interface JobRow {
  id: number;
  title: string;
  jd_text: string;
  requirements: JobRequirements;
  created_at: string;
}

export interface CandidateRow {
  id: number;
  job_id: number;
  job_title: string;
  name: string;
  email: string;
  current_role: string;
  file_name: string;
  score: number;
  ai_verdict: Verdict;
  hr_status: HrStatus;
  note: string;
  source: "instant" | "bulk";
  provider: string;
  model: string;
  created_at: string;
  decided_at: string | null;
  /** Mandatory skills this candidate lacks (empty = eligible). */
  gate_missing: string[];
  /** How many other records look like the same person. */
  dup_count: number;
  /** Only included when asked for (it is large). */
  report?: Report;
}

/** Another record that looks like the same person (or the very same file). */
export interface DupRef {
  id: number;
  name: string;
  job_id: number;
  job_title: string;
  score: number;
  hr_status: HrStatus;
  created_at: string;
  same_job: boolean;
  basis: "file" | "email" | "name";
}

export interface CandidateDetail extends CandidateRow {
  report: Report;
  jd_text: string;
  history: { id: number; from_status: string | null; to_status: string; note: string; created_at: string }[];
  duplicates: DupRef[];
  mandatory_ids: string[];
}

export type AuditAction = "screened" | "decision" | "deleted" | "merged" | "job_created" | "gate_changed" | "settings_changed";

export interface AuditRow {
  id: number;
  at: string;
  actor: string;
  action: AuditAction;
  candidate_id: number | null;
  job_id: number | null;
  summary: string;
}

export interface DashboardWeek {
  start: string; // Monday, YYYY-MM-DD
  label: string;
  accepted: number;
  talk: number;
  rejected: number;
  pending: number;
  total: number;
  /** Average hours from screening to HR decision, for the candidates screened this week who have been decided. */
  avgHours: number | null;
  decided: number;
}

export interface DashboardData {
  weeks: DashboardWeek[];
  screened: number;
  decided: number;
  accepted: number;
  talk: number;
  rejected: number;
  pending: number;
  notEligible: number;
  thisWeek: number;
  lastWeek: number;
  /** Accepted ÷ decided, as a percentage (null until someone has been decided). */
  acceptRate: number | null;
  avgHours: number | null;
}

export const STATUS_LABEL: Record<HrStatus, string> = {
  pending: "Pending review",
  accepted: "Accepted for L1/L2",
  rejected: "Rejected",
  talk: "Talk to candidate",
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  accept: "Accept",
  talk: "Talk to candidate",
  reject: "Reject",
};
