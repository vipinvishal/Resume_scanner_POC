import type { FitBlock, JobRequirements, Requirement, SkillMatch } from "./types";

/**
 * The instant first pass: plain text matching, no AI. Reads a resume in milliseconds and gives HR a
 * ranked list straight away; the AI then only has to judge what this pass could not settle.
 */

const STOP = new Set(
  `a an and or of the in on at to for with from by as is are be been this that these those your our their into using use used
  experience experienced years year strong good excellent solid proven proficiency proficient knowledge understanding familiarity familiar
  ability able skills skill working work hands practical exposure expertise expert deep relevant related including etc such like plus
  development developing design designing building build create creating management managing based preferred required minimum least more technologies tools applications systems software`
    .split(/\s+/),
);

// Short forms and spellings that mean the same thing.
const SYNONYMS: Record<string, string[]> = {
  javascript: ["js"],
  typescript: ["ts"],
  kubernetes: ["k8s"],
  nodejs: ["node", "node.js"],
  "node.js": ["nodejs", "node"],
  postgresql: ["postgres"],
  postgres: ["postgresql"],
  mongodb: ["mongo"],
  "machine learning": ["ml"],
  "continuous integration": ["ci"],
  golang: ["go"],
  reactjs: ["react"],
  "react.js": ["react"],
  angularjs: ["angular"],
  vuejs: ["vue"],
  amazon: ["aws"],
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// "c++" or ".net" are not words to \b, so check the neighbours by hand.
const wordRe = (w: string) => new RegExp(`(?<![a-z0-9])${escape(w)}(?![a-z0-9])`, "i");

function tokens(requirement: string): string[] {
  const t = requirement
    .toLowerCase()
    .replace(/[(),;:/\\|"'–—-]+/g, " ")
    .split(/\s+/)
    .map((x) => x.replace(/^[.]+|[.]+$/g, ""))
    .filter((x) => x.length > 1 && !STOP.has(x));
  return [...new Set(t)];
}

function find(text: string, word: string): number {
  const forms = [word, ...(word.endsWith("s") ? [word.slice(0, -1)] : [word + "s"]), ...(SYNONYMS[word] ?? [])];
  let best = -1;
  for (const f of forms) {
    const m = wordRe(f).exec(text);
    if (m && (best === -1 || m.index < best)) best = m.index;
  }
  return best;
}

export function matchSkill(r: Requirement, text: string): SkillMatch {
  const t = tokens(r.text);
  const lower = text.toLowerCase();
  const hits = t.map((w) => ({ w, at: find(lower, w) })).filter((h) => h.at >= 0);
  const cover = t.length ? hits.length / t.length : 0;
  const status = cover === 1 ? "present" : cover >= 0.33 ? "partial" : "missing";
  let evidence = "Not mentioned in the resume.";
  if (hits.length) {
    const at = hits[0].at;
    const snip = text.slice(Math.max(0, at - 30), at + 50).replace(/\s+/g, " ").trim();
    evidence = status === "present" ? `Found in resume: “…${snip}…”` : `Only part of this found (${hits.map((h) => h.w).join(", ")}): “…${snip}…”`;
  }
  return { id: r.id, requirement: r.text, type: r.type, status, evidence };
}

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE = /(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s.-]?){2,4}\d{2,4}/;
const HEADINGS = /resume|curriculum|vitae|profile|summary|contact|objective|address|email|phone|mobile|linkedin|github/i;

function guessName(text: string): string {
  for (const line of text.split("\n").slice(0, 8)) {
    const l = line.trim();
    if (l.length < 3 || l.length > 40 || /[\d@:/]/.test(l) || HEADINGS.test(l)) continue;
    const words = l.split(/\s+/);
    if (words.length >= 2 && words.length <= 4 && words.every((w) => /^[A-Za-z][A-Za-z.'-]*$/.test(w))) return l.replace(/\b([A-Z])([A-Z]+)\b/g, (_, a, b) => a + b.toLowerCase());
  }
  return "";
}

function guessPhone(text: string): string {
  for (const m of text.matchAll(new RegExp(PHONE, "g"))) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 13) return m[0].trim();
  }
  return "";
}

function guessYears(text: string): number | null {
  const said = [...text.matchAll(/(\d{1,2})(?:\.\d)?\s*\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:\w+\s+){0,3}?experience|experience\s+(?:of\s+)?(\d{1,2})\s*\+?\s*(?:years?|yrs?)/gi)]
    .map((m) => Number(m[1] ?? m[2]))
    .filter((n) => n > 0 && n <= 45);
  if (said.length) return Math.max(...said);
  const nowYear = new Date().getFullYear();
  let from = 9999;
  let to = 0;
  for (const m of text.matchAll(/\b((?:19|20)\d{2})\s*(?:-|–|—|to)\s*((?:19|20)\d{2}|present|current|now|till date|date)\b/gi)) {
    const a = Number(m[1]);
    const b = /\d/.test(m[2]) ? Number(m[2]) : nowYear;
    if (a <= b && b <= nowYear + 1) {
      from = Math.min(from, a);
      to = Math.max(to, b);
    }
  }
  return to > from ? Math.min(45, to - from) : null;
}

const DEGREE = /\b(ph\.?d|doctorate|master'?s?|m\.?\s?tech|m\.?\s?sc|m\.?\s?e\b|mba|mca|bachelor'?s?|b\.?\s?tech|b\.?\s?e\b|b\.?\s?sc|bca|diploma)\b/i;

function fitYears(years: number | null, min: number | null): FitBlock["fit"] {
  if (years == null || min == null) return "unknown";
  if (years >= min + 3) return "exceeds";
  if (years >= min) return "meets";
  return years >= min * 0.7 ? "partial" : "below";
}

export interface QuickFacts {
  candidate: { name: string; email: string; phone: string; currentRole: string; location: string; totalYears: number | null };
  skills: SkillMatch[];
  experience: { candidate: string; fit: FitBlock["fit"]; comment: string };
  education: { candidate: string; fit: FitBlock["fit"]; comment: string };
  summary: string;
  strengths: string[];
  gaps: string[];
}

export function quickFacts(req: JobRequirements, resumeText: string): QuickFacts {
  const skills = req.requirements.map((r) => matchSkill(r, resumeText));
  const years = guessYears(resumeText);
  const degree = resumeText.match(DEGREE)?.[0];
  const hit = skills.filter((k) => k.status === "present").length;
  return {
    candidate: {
      name: guessName(resumeText),
      email: resumeText.match(EMAIL)?.[0] ?? "",
      phone: guessPhone(resumeText),
      currentRole: "",
      location: "",
      totalYears: years,
    },
    skills,
    experience: {
      candidate: years != null ? `About ${years} years (estimated from the resume)` : "",
      fit: fitYears(years, req.minYearsExperience),
      comment: years != null ? "Estimated by a quick text check." : "Couldn't tell from a quick text check.",
    },
    education: {
      candidate: degree ?? "",
      fit: degree ? "meets" : "unknown",
      comment: degree ? "A degree is mentioned." : "No degree found by the quick check.",
    },
    summary: `Quick keyword check: ${hit} of ${skills.length} requirements clearly found in the resume. The AI review adds a proper assessment.`,
    strengths: skills.filter((k) => k.status === "present" && k.type === "must").slice(0, 4).map((k) => k.requirement),
    gaps: skills.filter((k) => k.status === "missing" && k.type === "must").slice(0, 5).map((k) => `No sign of: ${k.requirement}`),
  };
}
