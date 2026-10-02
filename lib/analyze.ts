import { z } from "zod";
import { generateJson } from "./llm";
import { getSettings } from "./db";
import type { FitBlock, JobRequirements, Report, Settings, Verdict } from "./types";

const MAX_JD_CHARS = 12_000;
const MAX_RESUME_CHARS = 18_000;

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
  screeningQuestions: listOfText(6),
});

export async function analyzeResume(
  req: JobRequirements,
  resumeText: string,
  fileName: string,
  s: Settings = getSettings(),
): Promise<Report> {
  const resume = resumeText.slice(0, MAX_RESUME_CHARS);
  const reqList = req.requirements
    .map((r) => `- id "${r.id}" (${r.type === "must" ? "must-have" : "nice-to-have"}): ${r.text}`)
    .join("\n");

  const out = await generateJson(
    ResumeSchema,
    {
      system: SYSTEM_BASE,
      prompt: `Compare this candidate's resume against the job requirements and produce a screening assessment for HR.

JOB: ${req.title}
${req.summary}
Experience expected: ${req.experienceNote}${req.minYearsExperience != null ? ` (minimum ${req.minYearsExperience} years)` : ""}
Education expected: ${req.education}

REQUIREMENTS TO CHECK:
${reqList}

Instructions:
- "candidate": details from the resume. Use "" when not found. "totalYears" is total professional experience as a number, or null if unclear.
- "summary": 2-3 sentences for HR about how well this person fits THIS role, in plain English.
- "skills": return exactly one entry for EVERY requirement id listed above. "status" is "present" if the resume clearly shows it, "partial" if it is related or only briefly/indirectly shown, "missing" if there is no evidence. Do not assume skills that are not written in the resume. "evidence": a short note (max 20 words) pointing to where in the resume you saw it (project, role or skill list). For missing, write "Not mentioned in the resume."
- "experience": "candidate" = short description of their experience level; "fit" = exceeds / meets / partial / below / unknown versus what the job expects; "comment" = one plain sentence.
- "education": same structure, compared with the education expected. Use "unknown" if the resume doesn't say.
- "strengths": 3-5 short bullet points on what stands out positively for THIS role.
- "gaps": up to 5 short bullet points on important things from the job that the resume lacks.
- "risks": up to 4 things HR should double-check (e.g. frequent job changes, unexplained career gaps, vague claims, very short stints). Empty array if none.
- "screeningQuestions": 4-5 specific questions HR can ask on a quick call to clear up gaps or verify claims.

RESUME (file: ${fileName}):
"""
${resume}
"""`,
    },
    s,
  );

  return buildReport(req, out, fileName, s);
}

/* ───────────── Scoring: done in code so it's consistent & explainable ───────────── */

const FIT_POINTS: Record<FitBlock["fit"], number> = { exceeds: 100, meets: 100, partial: 60, below: 20, unknown: 50 };
export const WEIGHTS = { skills: 0.7, experience: 0.2, education: 0.1 };

export function verdictFor(score: number, s: Settings): Verdict {
  if (score >= s.acceptThreshold) return "accept";
  if (score >= s.talkThreshold) return "talk";
  return "reject";
}

function buildReport(req: JobRequirements, out: z.infer<typeof ResumeSchema>, fileName: string, s: Settings): Report {
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
    screeningQuestions: nonEmpty(out.screeningQuestions),
  };
}
