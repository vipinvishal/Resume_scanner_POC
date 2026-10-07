import { fail } from "@/lib/api";
import { guard } from "@/lib/auth";
import { ChatRequest, answerChat, rateLimited } from "@/lib/chat";

export const maxDuration = 120;

/** The HR assistant. Read-only: it answers questions about the screened data and never changes anything. */
export async function POST(req: Request) {
  const g = await guard();
  if (g) return g;
  const parsed = ChatRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "That message couldn't be read. Please try again." }, { status: 400 });
  if (rateLimited()) return Response.json({ error: "You're asking quickly. Please wait a few seconds and try again." }, { status: 429 });
  try {
    return Response.json(await answerChat(parsed.data));
  } catch (e) {
    return fail(e, 400);
  }
}
