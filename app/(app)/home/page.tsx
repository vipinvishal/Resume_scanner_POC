import Workspace from "@/components/workspace";
import { getSettings } from "@/lib/db";
import { isConfigured } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Home — TalentLens" };

export default function Home() {
  const s = getSettings();
  return <Workspace engineReady={isConfigured(s)} />;
}
