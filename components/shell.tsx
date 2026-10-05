"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, LogOut, Settings, TriangleAlert, Users } from "lucide-react";
import type { Provider } from "@/lib/types";
import { Logo, cx } from "./ui";

const ENGINE_NAME: Record<Provider, string> = { openai: "OpenAI", anthropic: "Anthropic", gemini: "Gemini", ollama: "Ollama" };

const NAV = [
  { href: "/home", label: "Home", icon: LayoutGrid },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Shell({
  provider,
  model,
  configured,
  children,
}: {
  provider: Provider;
  model: string;
  configured: boolean;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 sm:px-8">
          <Logo href="/home" />

          <nav className="order-last flex w-full gap-1 sm:order-none sm:w-auto" aria-label="Main">
            {NAV.map((n) => {
              const active = path.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors sm:flex-none",
                    active ? "bg-forest text-paper shadow-soft" : "text-ink-soft hover:bg-card hover:text-ink",
                  )}
                >
                  <n.icon size={16} />
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/settings"
              className={cx(
                "hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors md:flex",
                configured ? "border-line-strong bg-card/70 text-ink-soft hover:bg-card" : "border-talk/40 bg-talk-bg text-talk",
              )}
              title="Change the AI engine in Settings"
            >
              {configured ? <span className="h-2 w-2 rounded-full bg-accept" /> : <TriangleAlert size={13} />}
              <span className="font-semibold text-ink">{ENGINE_NAME[provider]}</span>
              <span className="max-w-[9rem] truncate font-mono">{configured ? model : "not set up"}</span>
            </Link>
            <button onClick={signOut} className="flex items-center gap-2 rounded-full px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-card hover:text-ink">
              <LogOut size={16} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="app-shell-main mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:py-10">{children}</main>
    </div>
  );
}
