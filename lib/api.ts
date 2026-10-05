/** JSON error response with the message HR will see. */
export const fail = (e: unknown, status = 500) => Response.json({ error: (e as Error)?.message ?? String(e) }, { status });
