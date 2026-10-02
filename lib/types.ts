export type Verdict = "accept" | "talk" | "reject";
export type HrStatus = "pending" | "accepted" | "rejected" | "talk";
export type SkillStatus = "present" | "partial" | "missing";
export type Provider = "gemini" | "ollama";

export interface Requirement {
  id: string;
  text: string;
  type: "must" | "nice";
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
  screeningQuestions: string[];
}

export interface Settings {
  provider: Provider;
  geminiKey: string;
  geminiModel: string;
  ollamaUrl: string;
  ollamaModel: string;
  acceptThreshold: number;
  talkThreshold: number;
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
}

export interface CandidateDetail extends CandidateRow {
  report: Report;
  jd_text: string;
  history: { id: number; from_status: string | null; to_status: string; note: string; created_at: string }[];
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
