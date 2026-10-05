import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import { activeModel, isConfigured } from "@/lib/llm";
import Shell from "@/components/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthed())) redirect("/signin");
  const s = getSettings();
  const model = activeModel(s);
  return (
    <Shell provider={s.provider} model={model} configured={isConfigured(s)}>
      {children}
    </Shell>
  );
}
