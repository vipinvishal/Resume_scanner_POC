/**
 * What HR is allowed to see when something goes wrong. Technical details (connection codes, SQL, raw model output)
 * stay in the server log; the screen gets a short, plain sentence. Safe to import in the browser.
 */

const RULES: [RegExp, string][] = [
  [/failed to fetch|networkerror|load failed|network request failed/i, "Couldn't reach the TalentLens server. Check that it is still running, then try again."],
  [/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|fetch failed|can't reach|cannot reach/i, "Couldn't connect to the AI engine. Make sure it is running (for Ollama, start it first), then try again."],
  [/timed? ?out|aborted|timeouterror|took too long/i, "The AI took too long to answer. Please try again, or choose a smaller or faster model in Settings."],
  [/not installed|model .* not found|pull /i, "The selected AI model isn't installed. Open Settings and pick an installed model."],
  [/\b(401|403)\b|api key|unauthori[sz]ed|permission denied|invalid.*key/i, "The AI service rejected the credentials. Check the API key in Settings."],
  [/\b429\b|rate.?limit|quota|overloaded|too many requests/i, "The AI service is busy right now. Please wait a moment and try again."],
  [/ollama error|returned an unusable|did not return json|empty answer|returned no content|unexpected token|json|zod|invalid input/i, "The AI couldn't process this one. Please try again."],
  [/sqlite|sqlstate|\bER_[A-Z_]+|ECONNRESET|relation .* does not exist|syntax error|deadlock|database|SQL|login failed|tedious/i, "Couldn't reach the database. Check the database settings and try again."],
];

const GENERIC = "Something went wrong. Please try again.";

/** Our own plain-English messages pass through; anything technical is replaced. */
export function publicMessage(e: unknown): string {
  // Messages written on purpose for HR (e.g. "the database password is wrong") are shown as they are.
  if ((e as { name?: string })?.name === "FriendlyDbError") return (e as Error).message;
  const raw = ((e as { message?: string })?.message ?? String(e ?? "")).trim();
  if (!raw) return GENERIC;
  for (const [re, text] of RULES) if (re.test(raw)) return text;
  // Long text, stack-like text or code-like text is not meant for HR.
  if (raw.length > 220 || /\n\s+at\s|\bat\s.+\(.+:\d+|[{}[\]]|TypeError|ReferenceError|undefined|\bnull\b|\[object/.test(raw)) return GENERIC;
  return raw;
}
