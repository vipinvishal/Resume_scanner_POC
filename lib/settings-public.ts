import type { DbConfig, Settings } from "./types";

/** Same server and login (so a saved password still applies). Safe to import in the browser. */
export const sameDbTarget = (a: Pick<DbConfig, "type" | "host" | "port" | "user" | "database">, b: typeof a) =>
  a.type === b.type && a.host === b.host && a.port === b.port && a.user === b.user && a.database === b.database;

/** What the browser may see: secrets are blanked and replaced with "is one saved?" flags. */
export function publicSettings(s: Settings) {
  return {
    ...s,
    openaiKey: "",
    anthropicKey: "",
    geminiKey: "",
    hasOpenaiKey: !!s.openaiKey,
    hasAnthropicKey: !!s.anthropicKey,
    hasGeminiKey: !!s.geminiKey,
    db: { ...s.db, password: "", hasPassword: !!s.db.password },
  };
}
export type PublicSettings = ReturnType<typeof publicSettings>;
