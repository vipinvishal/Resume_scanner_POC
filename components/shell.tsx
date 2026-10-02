"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, LogOut, Settings, Users, Zap, Files, TriangleAlert } from "lucide-react";
import { Logo, cx } from "./ui";

const NAV = [
  { href: "/home", label: "Home", icon: LayoutGrid },
  { href: "/analyze", label: "Instant analysis", icon: Zap },
  { href: "/bulk", label: "Bulk upload", icon: Files },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Shell({
  provider,
  model,
  configured,
  children,
}: {
  provider: "gemini" | "ollama";
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

  const engine = (
    <Link
      href="/settings"
      className={cx(
        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        configured ? "border-line-strong bg-card/70 text-ink-soft hover:bg-card" : "border-talk/40 bg-talk-bg text-talk",
      )}
      title="Change AI engine in Settings"
    >
      {configured ? <span className="h-2 w-2 rounded-full bg-accept" /> : <TriangleAlert size={13} />}
      <span className="font-semibold text-ink">{provider === "gemini" ? "Gemini" : "Ollama"}</span>
      <span className="max-w-[9rem] truncate font-mono">{configured ? model : "not set up"}</span>
    </Link>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      {/* Sidebar (desktop) */}
      <aside className="no-print sticky top-0 hidden h-screen flex-col border-r border-line bg-paper-2/40 px-5 py-7 lg:flex">
        <Logo href="/home" />
        <nav className="mt-10 flex flex-1 flex-col gap-1">
          {NAV.map((n) => {
            const active = path === n.href || (n.href !== "/home" && path.startsWith(n.href));
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-forest text-paper shadow-soft" : "text-ink-soft hover:bg-card hover:text-ink",
                )}
              >
                <n.icon size={18} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-3">
          {engine}
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-ink-soft transition-colors hover:bg-card hover:text-ink">
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Top bar (mobile) */}
        <header className="no-print sticky top-0 z-20 flex items-center justify-between border-b border-line bg-paper/90 px-4 py-3 backdrop-blur lg:hidden">
          <Logo href="/home" />
          <div className="flex items-center gap-2">
            {engine}
            <button onClick={signOut} aria-label="Sign out" className="rounded-full p-2 text-ink-soft hover:bg-paper-2">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <nav className="no-print flex gap-1 overflow-x-auto border-b border-line px-3 py-2 lg:hidden">
          {NAV.map((n) => {
            const active = path === n.href || (n.href !== "/home" && path.startsWith(n.href));
            return (
              <Link key={n.href} href={n.href} className={cx("shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium", active ? "bg-forest text-paper" : "text-ink-soft")}>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <main className="app-shell-main mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:py-12">{children}</main>
      </div>
    </div>
  );
}
