import type { Metadata } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "TalentLens — AI-powered Candidate Screening",
  description:
    "Match every resume against your job description. Get a clear, HR-ready report and a recommendation to accept, talk to the candidate, or reject.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Sets the saved (or system) theme before the page paints, so there is no flash of the wrong colours. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("talentlens.theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
