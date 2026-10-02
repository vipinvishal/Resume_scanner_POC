import { cookies } from "next/headers";

export const SESSION_COOKIE = "tl_session";
// POC only: hard-coded demo credentials.
export const DEMO_USER = "demo";
export const DEMO_PASS = "demo";

export async function isAuthed(): Promise<boolean> {
  const c = await cookies();
  return c.get(SESSION_COOKIE)?.value === "ok";
}

/** For route handlers: returns a 401 Response when not signed in. */
export async function guard(): Promise<Response | null> {
  return (await isAuthed()) ? null : Response.json({ error: "Please sign in." }, { status: 401 });
}
