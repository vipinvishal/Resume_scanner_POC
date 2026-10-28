import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { STATUS_LABEL, VERDICT_LABEL, type CandidateDetail } from "./types";

/** A detailed, one-candidate screening report as a PDF. */

const A4: [number, number] = [595.28, 841.89];
const M = 44; // page margin
const INK = rgb(0.11, 0.13, 0.12);
const SOFT = rgb(0.4, 0.43, 0.41);
const LINE = rgb(0.85, 0.86, 0.84);
const GREEN = rgb(0.13, 0.42, 0.3);
const AMBER = rgb(0.72, 0.45, 0.05);
const RED = rgb(0.7, 0.18, 0.15);

// The built-in PDF fonts only cover Latin-1 plus a few typographic marks; anything else would make the PDF fail.
const EXTRA = "•…–—‘’“”€™";
const safe = (v: unknown) =>
  String(v ?? "")
    .replace(/[\r\t]+/g, " ")
    .replace(/[•]/g, "-")
    .split("")
    .map((ch) => (/[\x20-\x7E\n]/.test(ch) || (ch >= " " && ch <= "ÿ") || EXTRA.includes(ch) ? ch : "?"))
    .join("");

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "-");
const tone = (s: string) => (s === "present" || s === "accept" || s === "meets" || s === "exceeds" ? GREEN : s === "missing" || s === "reject" || s === "below" ? RED : AMBER);
const FIT = { exceeds: "Exceeds", meets: "Meets", partial: "Partly meets", below: "Below", unknown: "Not stated" } as const;
const SKILL = { present: "Present", partial: "Partial", missing: "Missing" } as const;

export async function candidatePdf(c: CandidateDetail): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle(safe(`Screening report - ${c.name}`));
  doc.setProducer("TalentLens");
  doc.setCreator("TalentLens");

  const W = A4[0] - M * 2;
  let page: PDFPage = doc.addPage(A4);
  let y = A4[1] - M;

  const ensure = (h: number) => {
    if (y - h < M + 18) {
      page = doc.addPage(A4);
      y = A4[1] - M;
    }
  };
  const wrap = (text: string, font: PDFFont, size: number, width: number): string[] => {
    const out: string[] = [];
    for (const para of safe(text).split("\n")) {
      let line = "";
      for (const word of para.split(" ")) {
        // a single very long token (URL, etc.) is cut so it can't run off the page
        let w = word;
        while (font.widthOfTextAtSize(w, size) > width) {
          let n = w.length - 1;
          while (n > 1 && font.widthOfTextAtSize(w.slice(0, n), size) > width) n--;
          if (line) {
            out.push(line);
            line = "";
          }
          out.push(w.slice(0, n));
          w = w.slice(n);
        }
        const next = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(next, size) <= width) line = next;
        else {
          out.push(line);
          line = w;
        }
      }
      out.push(line);
    }
    return out;
  };
  const text = (t: string, o: { x?: number; size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; width?: number; gap?: number } = {}) => {
    const size = o.size ?? 10;
    const font = o.font ?? reg;
    const x = o.x ?? M;
    const lh = size * 1.35;
    for (const l of wrap(t, font, size, o.width ?? W - (x - M))) {
      ensure(lh);
      y -= lh;
      if (l) page.drawText(l, { x, y: y + size * 0.25, size, font, color: o.color ?? INK });
    }
    y -= o.gap ?? 0;
  };
  const heading = (t: string) => {
    ensure(40);
    y -= 14;
    text(t, { size: 12.5, font: bold, color: GREEN, gap: 2 });
    page.drawLine({ start: { x: M, y: y + 2 }, end: { x: M + W, y: y + 2 }, thickness: 0.7, color: LINE });
    y -= 4;
  };
  const bullets = (items: string[], empty: string) => {
    if (!items.length) return text(empty, { color: SOFT });
    for (const it of items) {
      ensure(14);
      const top = y;
      text(it, { x: M + 14, width: W - 14 });
      page.drawCircle({ x: M + 5, y: top - 8, size: 1.6, color: SOFT });
      y -= 2;
    }
  };

  const r = c.report;

  // ── Header ──
  page.drawRectangle({ x: 0, y: A4[1] - 70, width: A4[0], height: 70, color: GREEN });
  page.drawText("TalentLens  |  Candidate screening report", { x: M, y: A4[1] - 42, size: 15, font: bold, color: rgb(1, 1, 1) });
  page.drawText(`Generated ${fmt(new Date().toISOString())}`, { x: M, y: A4[1] - 58, size: 8.5, font: reg, color: rgb(0.85, 0.93, 0.89) });
  y = A4[1] - 70 - 14;

  text(r.candidate.name || c.name, { size: 20, font: bold, gap: 2 });
  text(
    [r.candidate.currentRole, r.candidate.location].filter(Boolean).join("  |  ") || c.file_name,
    { size: 11, color: SOFT, gap: 1 },
  );
  text([r.candidate.email, r.candidate.phone].filter(Boolean).join("  |  "), { size: 10, color: SOFT, gap: 6 });

  // ── Result box ──
  ensure(78);
  const top = y;
  page.drawRectangle({ x: M, y: top - 70, width: W, height: 70, borderColor: LINE, borderWidth: 1, color: rgb(0.97, 0.98, 0.97) });
  page.drawText(String(r.score), { x: M + 16, y: top - 44, size: 34, font: bold, color: tone(r.verdict) });
  page.drawText("/ 100 match", { x: M + 16, y: top - 60, size: 8.5, font: reg, color: SOFT });
  const rx = M + 112;
  page.drawText(`AI recommendation: ${VERDICT_LABEL[r.verdict]}`, { x: rx, y: top - 22, size: 11, font: bold, color: tone(r.verdict) });
  page.drawText(safe(`Job: ${c.job_title}`).slice(0, 80), { x: rx, y: top - 37, size: 9.5, font: reg, color: INK });
  page.drawText(safe(`HR decision: ${STATUS_LABEL[c.hr_status]}${c.decided_at ? `  (${fmt(c.decided_at)})` : ""}`), { x: rx, y: top - 51, size: 9.5, font: reg, color: INK });
  page.drawText(safe(`Screened ${fmt(c.created_at)}  |  ${c.provider === "quick" ? "keyword check" : `${c.provider} ${c.model}`}`).slice(0, 90), { x: rx, y: top - 64, size: 8, font: reg, color: SOFT });
  y = top - 70;

  if (c.gate_missing.length) {
    y -= 8;
    text(`NOT ELIGIBLE - missing mandatory skill${c.gate_missing.length > 1 ? "s" : ""}: ${c.gate_missing.join(", ")}`, { font: bold, color: RED });
  }
  if (r.quick) text("Note: this result is from the quick keyword check only; the AI review has not been run for this candidate.", { size: 9, color: AMBER, gap: 2 });

  heading("Summary");
  text(r.summary || "-");
  text(r.verdictReason, { color: SOFT, size: 9.5 });

  heading("Score breakdown");
  const bars: [string, number, string][] = [
    ["Skills", r.scoreBreakdown.skills, "70%"],
    ["Experience", r.scoreBreakdown.experience, "20%"],
    ["Education", r.scoreBreakdown.education, "10%"],
  ];
  for (const [label, v, wt] of bars) {
    ensure(20);
    y -= 14;
    page.drawText(`${label}  (worth ${wt})`, { x: M, y, size: 9.5, font: reg, color: INK });
    page.drawRectangle({ x: M + 150, y: y - 1, width: W - 200, height: 8, color: rgb(0.9, 0.92, 0.9) });
    page.drawRectangle({ x: M + 150, y: y - 1, width: Math.max(1, ((W - 200) * v) / 100), height: 8, color: GREEN });
    page.drawText(`${v}%`, { x: M + W - 36, y, size: 9.5, font: bold, color: INK });
  }
  y -= 4;

  heading("Skills against the job");
  const mand = new Set(c.mandatory_ids);
  for (const k of r.skills) {
    const label = `${k.requirement}${mand.has(k.id) ? "  [MANDATORY]" : k.type === "must" ? "  (must-have)" : "  (nice-to-have)"}`;
    const lines = wrap(label, bold, 9.5, W - 80).length + wrap(k.evidence, reg, 9, W - 80).length;
    ensure(lines * 12.5 + 8);
    const rowTop = y;
    text(label, { size: 9.5, font: bold, width: W - 80 });
    text(k.evidence, { size: 9, color: SOFT, width: W - 80, gap: 4 });
    page.drawText(SKILL[k.status], { x: M + W - 62, y: rowTop - 11, size: 9.5, font: bold, color: tone(k.status) });
    page.drawLine({ start: { x: M, y: y + 2 }, end: { x: M + W, y: y + 2 }, thickness: 0.4, color: LINE });
  }

  heading("Experience and education");
  for (const [title, b] of [["Experience", r.experience], ["Education", r.education]] as const) {
    ensure(40);
    text(`${title}: ${FIT[b.fit]}`, { font: bold, color: tone(b.fit) });
    text(`Expected: ${b.required}`, { size: 9.5, color: SOFT });
    text(`Candidate: ${b.candidate}`, { size: 9.5 });
    if (b.comment) text(b.comment, { size: 9.5, color: SOFT });
    y -= 4;
  }
  if (r.candidate.totalYears != null) text(`Total professional experience: about ${r.candidate.totalYears} years`, { size: 9.5, color: SOFT });

  heading("Strengths");
  bullets(r.strengths, "None listed.");
  heading("Gaps");
  bullets(r.gaps, "None listed.");
  heading("Things to double-check");
  bullets(r.risks, "Nothing flagged.");

  heading("HR decision history");
  if (c.note) text(`Current note: ${c.note}`, { gap: 4 });
  if (!c.history.length) text("No decision recorded yet.", { color: SOFT });
  for (const h of c.history) {
    const from = h.from_status ? STATUS_LABEL[h.from_status as keyof typeof STATUS_LABEL] ?? h.from_status : "New";
    text(`${fmt(h.created_at)}  -  ${from} -> ${STATUS_LABEL[h.to_status as keyof typeof STATUS_LABEL] ?? h.to_status}${h.note ? `  -  ${h.note}` : ""}`, { size: 9 });
  }

  // ── Footer on every page ──
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawText(safe(`${r.candidate.name || c.name}  |  ${c.job_title}`).slice(0, 80), { x: M, y: 22, size: 8, font: reg, color: SOFT });
    const label = `Page ${i + 1} of ${pages.length}`;
    p.drawText(label, { x: A4[0] - M - reg.widthOfTextAtSize(label, 8), y: 22, size: 8, font: reg, color: SOFT });
  });

  return doc.save();
}

/** A safe file name such as "Jane-Doe_Backend-Engineer.pdf". */
export function pdfFileName(c: { name: string; job_title: string }): string {
  const part = (s: string) => safe(s).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return `${part(c.name) || "candidate"}_${part(c.job_title) || "job"}.pdf`;
}
