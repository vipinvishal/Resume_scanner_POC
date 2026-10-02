import type { Metadata } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "TalentLens — Resume screening, done in minutes",
  description:
    "Match every resume against your job description. Get a clear, HR-ready report and a recommendation: accept, talk to the candidate, or reject.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
