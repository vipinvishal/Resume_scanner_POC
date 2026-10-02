"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { btn, cx } from "@/components/ui";

const field =
  "w-full rounded-xl border border-line-strong bg-card px-4 py-3 text-base outline-none transition focus:border-forest focus:ring-4 focus:ring-forest/10";

export default function SignInForm() {
  const router = useRouter();
  const [username, setUsername] = useState("demo");
  const [password, setPassword] = useState("demo");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      router.push("/home");
      router.refresh();
    } else {
      setError((await res.json().catch(() => ({}))).error ?? "Couldn't sign in.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="u" className="mb-1.5 block text-sm font-medium">ID</label>
        <input id="u" className={field} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
      </div>
      <div>
        <label htmlFor="p" className="mb-1.5 block text-sm font-medium">Password</label>
        <input id="p" type="password" className={field} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-reject-bg px-4 py-2.5 text-sm text-reject">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={cx(btn.primary, "w-full !py-3.5 text-base")}>
        {busy ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="rounded-xl border border-dashed border-line-strong bg-paper-2/50 px-4 py-3 text-center text-sm text-ink-soft">
        Demo account — ID <code className="font-mono font-semibold text-ink">demo</code> · Password <code className="font-mono font-semibold text-ink">demo</code>
      </p>
    </form>
  );
}
