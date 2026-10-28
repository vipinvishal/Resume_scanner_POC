import { z } from "zod";
import { generateJson } from "./llm";
import { quickFacts } from "./prescreen";
import { getSettings } from "./settings";
import type { FitBlock, JobRequirements, Report, Settings, Verdict } from "./types";

const MAX_JD_CHARS = 12_000;
const MAX_RESUME_CHARS = 12_000;

// Local models are sloppier than Gemini: null for "", "Present" for "present", a string where a list belongs.
// Accept those and clean them up instead of failing the whole analysis.
const text = z.preprocess((v) => (v == null ? "" : typeof v === "string" ? v : String(v)), z.string());
const lower = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase().replace(/[\s-]+/g, "_") : v);
const FIT = z.preprocess(
  (v) => {
    const t = lower(v);
    if (t === "exceed" || t === "exceeds_expectations") return "exceeds";
    if (t === "meet" || t === "match" || t === "matches") return "meets";
    if (t === "partially" || t === "partially_meets" || t === "partly_meets") return "partial";
    if (t === "not_stated" || t === "n/a" || t === "") return "unknown";
    return t;
  },
  z.enum(["exceeds", "meets", "partial", "below", "unknown"]),
);
const SKILL_STATUS = z.preprocess(
  (v) => {
    const t = lower(v);
    if (t === "partially" || t === "partially_present" || t === "partly") return "partial";
    if (t === "absent" || t === "not_present" || t === "not_found") return "missing";
    if (t === "yes" || t === "found") return "present";
    return t;
  },
  z.enum(["present", "partial", "missing"]),
);
const listOfText = (max: number) =>
  z.preprocess(
    (v) => (v == null ? [] : (Array.isArray(v) ? v : [v]).map((x) => (typeof x === "string" ? x : String(x))).slice(0, max)),
    z.array(z.string()),
  );
const yearsOrNull = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}, z.number().nullable());

/* ───────────── Step 1: read the JD once ───────────── */

const JdSchema = z.object({
  title: text,
  summary: text,
  mustHave: listOfText(12),
  niceToHave: listOfText(8),
  minYearsExperience: yearsOrNull,
  experienceNote: text,
  education: text,
});

const SYSTEM_BASE = `You are a careful recruiting assistant that helps HR screen candidates.
Be factual and only use information that is actually in the text you are given.
Write in plain, simple English that a non-technical HR person can read quickly. Avoid jargon and buzzwords.
Never judge people on name, gender, age, nationality, religion, or anything unrelated to the job.
Reply with a single JSON object and nothing else.`;

export async function extractJobRequirements(jdText: string, s: Settings = getSettings()): Promise<JobRequirements> {
  const jd = jdText.slice(0, MAX_JD_CHARS);
  const out = await generateJson(
    JdSchema,
    {
      system: SYSTEM_BASE,
      prompt: `Read this job description and extract what the hiring team is looking for.

Rules:
- "title": the job title (short).
- "summary": one sentence describing the role in plain English.
- "mustHave": the essential, specific requirements (skills, tools, technologies, certifications, domain knowledge). Each item is a short phrase (max 8 words). Max 10 items. Do NOT include years of experience or education here.
- "niceToHave": preferred / bonus items only. Max 6 items. Empty array if none.
- "minYearsExperience": minimum years of experience required as a number, or null if not stated.
- "experienceNote": a short sentence about the experience expected (e.g. "5+ years in backend development"), or "Not specified".
- "education": the education requirement as a short phrase, or "Not specified".

JOB DESCRIPTION:
"""
${jd}
"""`,
    },
    s,
  );

  const clean = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
  const must = clean(out.mustHave);
  const nice = clean(out.niceToHave).filter((x) => !must.includes(x));
  if (must.length + nice.length === 0) throw new Error("Couldn't find any requirements in this job description. Is it the right file?");

  return {
    title: out.title.trim() || "Untitled role",
    summary: out.summary.trim(),
    requirements: [
      ...must.map((text, i) => ({ id: `m${i + 1}`, text, type: "must" as const })),
      ...nice.map((text, i) => ({ id: `n${i + 1}`, text, type: "nice" as const })),
    ],
    minYearsExperience: out.minYearsExperience,
    experienceNote: out.experienceNote.trim() || "Not specified",
    education: out.education.trim() || "Not specified",
  };
}

/* ───────────── Step 2: compare one resume ───────────── */

const ResumeSchema = z.object({
  candidate: z.object({
    name: text,
    email: text,
    phone: text,
    currentRole: text,
    location: text,
    totalYears: yearsOrNull,
  }),
  summary: text,
  skills: z.array(
    z.object({
      id: text,
      status: SKILL_STATUS,
      evidence: text,
    }),
  ),
  experience: z.object({ candidate: text, fit: FIT, comment: text }),
  education: z.object({ candidate: text, fit: FIT, comment: text }),
  strengths: listOfText(6),
  gaps: listOfText(6),
  risks: listOfText(5),
});

/** Instant first pass: text matching only, no AI. Takes milliseconds. */
export function quickReport(req: JobRequirements, resumeText: string, fileName: string, s: Settings = getSettings()): Report {
  const q = quickFacts(req, resumeText.slice(0, MAX_RESUME_CHARS));
  const report = buildReport(req, { ...q, risks: [], skills: q.skills.map((k) => ({ id: k.id, status: k.status, evidence: k.evidence })) }, fileName, s);
  return { ...report, quick: true };
}

/**
 * The AI review. The instant pass already settled every requirement it found in the text, so the AI only
 * judges the rest and writes the assessment — far fewer tokens to write, which is what a local model is slow at.
 * Everything that is the same for every resume of this job comes first, so Ollama can reuse its work between resumes.
 */
export async function reviewResume(
  req: JobRequirements,
  resumeText: string,
  fileName: string,
  s: Settings = getSettings(),
): Promise<Report> {
  const resume = resumeText.slice(0, MAX_RESUME_CHARS);
  const q = quickFacts(req, resume);
  const open = q.skills.filter((k) => k.status !== "present");
  const reqList = req.requirements.map((r) => `- id "${r.id}" (${r.type === "must" ? "must-have" : "nice-to-have"}): ${r.text}`).join("\n");

  const out = await generateJson(
    ResumeSchema,
    {
      system: SYSTEM_BASE,
      prompt: `You compare one candidate's resume with a job and write a short screening assessment for HR.

JOB: ${req.title}
${req.summary}
Experience expected: ${req.experienceNote}${req.minYearsExperience != null ? ` (minimum ${req.minYearsExperience} years)` : ""}
Education expected: ${req.education}

REQUIREMENTS:
${reqList}

Instructions (keep every text short):
- "candidate": details from the resume ("" when not found). "totalYears" is a number or null.
- "summary": 2 sentences for HR about how well this person fits THIS role.
- "skills": ONLY for the ids under "STILL TO CHECK" at the end. "status" is "present" (clearly shown), "partial" (related or only indirectly shown) or "missing" (no evidence). Do not assume skills that are not written. "evidence": max 8 words, or "Not mentioned" for missing.
- "experience" and "education": "candidate" = a few words; "fit" = exceeds / meets / partial / below / unknown versus what the job expects; "comment" = max 12 words.
- "strengths": up to 3 short points. "gaps": up to 3 short points. "risks": up to 2 things to double-check, or an empty array.

RESUME (file: ${fileName}):
"""
${resume}
"""

STILL TO CHECK (the other requirements were already found in the resume):
${open.length ? open.map((k) => `- id "${k.id}": ${k.requirement}`).join("\n") : "(none — return an empty skills array)"}`,
    },
    s,
  );

  const asked = new Set(open.map((k) => k.id.toLowerCase()));
  const judged = out.skills.filter((k) => asked.has(k.id.trim().toLowerCase()));
  const kept = q.skills.filter((k) => k.status === "present").map((k) => ({ id: k.id, status: k.status, evidence: k.evidence }));
  const pick = <T extends string | number | null>(ai: T, rule: T) => (ai === "" || ai == null ? rule : ai);
  return buildReport(
    req,
    {
      ...out,
      candidate: {
        name: pick(out.candidate.name.trim(), q.candidate.name),
        email: pick(out.candidate.email.trim(), q.candidate.email),
        phone: pick(out.candidate.phone.trim(), q.candidate.phone),
        currentRole: out.candidate.currentRole,
        location: out.candidate.location,
        totalYears: pick(out.candidate.totalYears, q.candidate.totalYears),
      },
      skills: [...kept, ...judged],
    },
    fileName,
    s,
  );
}

/* ───────────── Scoring: done in code so it's consistent & explainable ───────────── */

type ReportInput = z.infer<typeof ResumeSchema>;

const FIT_POINTS: Record<FitBlock["fit"], number> = { exceeds: 100, meets: 100, partial: 60, below: 20, unknown: 50 };
export const WEIGHTS = { skills: 0.7, experience: 0.2, education: 0.1 };

export function verdictFor(score: number, s: Settings): Verdict {
  if (score >= s.acceptThreshold) return "accept";
  if (score >= s.talkThreshold) return "talk";
  return "reject";
}

function buildReport(req: JobRequirements, out: ReportInput, fileName: string, s: Settings): Report {
  const byId = new Map(out.skills.map((x) => [x.id.trim().toLowerCase(), x]));
  const skills = req.requirements.map((r) => {
    const m = byId.get(r.id.toLowerCase());
    return {
      id: r.id,
      requirement: r.text,
      type: r.type,
      status: m?.status ?? ("missing" as const),
      evidence: m?.evidence?.trim() || "Not mentioned in the resume.",
    };
  });

  let num = 0;
  let den = 0;
  for (const k of skills) {
    const w = k.type === "must" ? 3 : 1;
    den += w;
    num += w * (k.status === "present" ? 1 : k.status === "partial" ? 0.5 : 0);
  }
  const skillsPct = den ? Math.round((num / den) * 100) : 50;
  const expPct = FIT_POINTS[out.experience.fit];
  const eduPct = FIT_POINTS[out.education.fit];
  const score = Math.round(skillsPct * WEIGHTS.skills + expPct * WEIGHTS.experience + eduPct * WEIGHTS.education);
  const verdict = verdictFor(score, s);

  const must = skills.filter((k) => k.type === "must");
  const mustHit = must.filter((k) => k.status === "present").length;
  const mustPartial = must.filter((k) => k.status === "partial").length;
  const band =
    verdict === "accept"
      ? `at or above the accept level (${s.acceptThreshold})`
      : verdict === "talk"
        ? `between the reject level (${s.talkThreshold}) and the accept level (${s.acceptThreshold})`
        : `below the minimum level (${s.talkThreshold})`;
  const verdictReason =
    `Match score ${score}/100 is ${band}. ` +
    `The candidate clearly shows ${mustHit} of ${must.length} must-have skills` +
    (mustPartial ? ` and partly shows ${mustPartial} more` : "") +
    ".";

  const nonEmpty = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);
  const fit = (b: z.infer<typeof ResumeSchema>["experience"], required: string): FitBlock => ({
    required,
    candidate: b.candidate.trim() || "Not stated",
    fit: b.fit,
    comment: b.comment.trim(),
  });

  return {
    candidate: {
      name: out.candidate.name.trim() || fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
      email: out.candidate.email.trim(),
      phone: out.candidate.phone.trim(),
      currentRole: out.candidate.currentRole.trim(),
      location: out.candidate.location.trim(),
      totalYears: out.candidate.totalYears,
    },
    summary: out.summary.trim(),
    score,
    scoreBreakdown: { skills: skillsPct, experience: expPct, education: eduPct },
    verdict,
    verdictReason,
    skills,
    experience: fit(out.experience, req.experienceNote),
    education: fit(out.education, req.education),
    strengths: nonEmpty(out.strengths),
    gaps: nonEmpty(out.gaps),
    risks: nonEmpty(out.risks),
  };
}
