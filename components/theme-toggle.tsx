"use client";

import { Moon, Sun } from "lucide-react";
import { cx } from "./ui";

const KEY = "talentlens.theme";

/** Light / dark switch. The theme itself is applied before first paint by the script in the root layout. */
export default function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    // Let every colour ease to its new value for a moment, instead of snapping.
    root.classList.add("theme-switching");
    root.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {}
    window.setTimeout(() => root.classList.remove("theme-switching"), 450);
  }

  // Both icons are always rendered; CSS shows the right one, so server and browser markup match.
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark mode"
      title="Switch between light and dark mode"
      className={cx("no-print grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-card hover:text-ink active:scale-95", className)}
    >
      <Moon size={17} className="dark:hidden" />
      <Sun size={17} className="hidden dark:block" />
    </button>
  );
}
