import { publicMessage } from "./friendly";

/**
 * JSON error response for the screen. HR sees a short plain message; the real error (with its stack)
 * is written to the server log where whoever runs TalentLens can read it.
 */
export function fail(e: unknown, status = 500, extra: Record<string, unknown> = {}) {
  console.error("[talentlens]", e);
  return Response.json({ ...extra, error: publicMessage(e) }, { status });
}
