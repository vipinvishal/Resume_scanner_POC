import type { Requirement, SkillMatch } from "./types";

/**
 * The must-have gate. A skill marked mandatory that the resume doesn't show ("missing") makes the
 * candidate Not eligible, whatever their score. "Partial" still passes — the AI saw some evidence.
 * Pure and browser-safe, so the Home page can re-check instantly when HR changes the mandatory list.
 */
export function gateMissing(reqs: Requirement[], skills: SkillMatch[]): string[] {
  return reqs
    .filter((r) => r.mandatory)
    .filter((r) => {
      const s = skills.find((x) => x.id === r.id);
      return !s || s.status === "missing";
    })
    .map((r) => r.text);
}
