import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { Logo } from "@/components/ui";
import ThemeToggle from "@/components/theme-toggle";
import SignInForm from "./form";

export const metadata = { title: "Sign in — TalentLens" };

export default async function SignIn() {
  if (await isAuthed()) redirect("/home");
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Left: brand panel */}
      <aside className="relative hidden overflow-hidden bg-panel p-12 text-on-panel lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-mint/10 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-[#d9482b]/20 blur-3xl" />
        <Logo light />
        <div className="relative max-w-md">
          <p className="font-display text-5xl font-semibold leading-[1.05]">
            Every resume,
            <br />
            <span className="italic font-normal text-mint">read with care.</span>
          </p>
          <p className="mt-6 text-lg text-on-panel/75">
            Match candidates to the job description, see exactly why, and decide with confidence.
          </p>
        </div>
        <p className="relative font-mono text-xs tracking-wider text-on-panel/50">TALENTLENS · PROOF OF CONCEPT</p>
      </aside>

      {/* Right: form */}
      <section className="relative flex flex-col justify-center px-6 py-12 sm:px-14">
        <ThemeToggle className="absolute right-5 top-5" />
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>
          <p className="eyebrow mb-3">Welcome back</p>
          <h1 className="font-display text-4xl font-semibold leading-tight">Sign in</h1>
          <p className="mt-2 text-ink-soft">Sign in with the demo account to explore TalentLens.</p>
          <SignInForm />
          <p className="mt-8 text-center text-sm text-ink-soft">
            <Link href="/" className="underline-offset-4 hover:underline">← Back to home</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
