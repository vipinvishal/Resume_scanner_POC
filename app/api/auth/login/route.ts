import { cookies } from "next/headers";
import { DEMO_PASS, DEMO_USER, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  const { username, password } = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  if (username?.trim() !== DEMO_USER || password !== DEMO_PASS)
    return Response.json({ error: "Incorrect ID or password." }, { status: 401 });
  (await cookies()).set(SESSION_COOKIE, "ok", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
  return Response.json({ ok: true });
}
