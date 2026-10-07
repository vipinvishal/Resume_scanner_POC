"use client";

import { useRef, useState } from "react";
import { FileText, UploadCloud, X } from "lucide-react";
import { cx } from "./ui";

export const ACCEPT = ".pdf,.docx,.txt,.md";
const OK = /\.(pdf|docx|txt|md)$/i;

export interface JdValue {
  text: string;
  file: File | null;
}

const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/* ───────── File drop zone ───────── */
export function FileDrop({
  multiple = false,
  files,
  onChange,
  title,
  hint,
  fill = false,
}: {
  multiple?: boolean;
  files: File[];
  onChange: (f: File[]) => void;
  title: string;
  hint?: string;
  /** Let the drop zone take up any spare height in its card. */
  fill?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [rejected, setRejected] = useState("");

  function add(list: FileList | File[]) {
    const incoming = Array.from(list);
    const good = incoming.filter((f) => OK.test(f.name));
    setRejected(good.length < incoming.length ? "Some files were skipped — only PDF, DOCX and TXT are supported." : "");
    if (!good.length) return;
    if (multiple) {
      const seen = new Set(files.map((f) => f.name + f.size));
      onChange([...files, ...good.filter((f) => !seen.has(f.name + f.size))]);
    } else onChange([good[0]]);
  }

  return (
    <div className={cx(fill && "flex flex-1 flex-col")}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => ref.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), ref.current?.click())}
        onDragOver={(e) => (e.preventDefault(), setOver(true))}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
        className={cx(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-9 text-center transition-all",
          fill && "flex-1",
          over ? "scale-[1.01] border-forest bg-moss/50" : "border-line-strong bg-paper/50 hover:border-forest/60 hover:bg-card",
        )}
      >
        <span className={cx("grid h-12 w-12 place-items-center rounded-full transition-colors", over ? "bg-forest text-paper" : "bg-moss text-forest")}>
          <UploadCloud size={22} />
        </span>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-ink-soft">{hint ?? "PDF, DOCX or TXT · up to 8 MB each"}</p>
        <input
          ref={ref}
          type="file"
          hidden
          multiple={multiple}
          accept={ACCEPT}
          onChange={(e) => {
            if (e.target.files) add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {rejected && <p className="mt-2 text-sm text-talk">{rejected}</p>}
      {files.length > 0 && (
        <ul className="mt-3 max-h-64 space-y-1.5 overflow-auto pr-1">
          {files.map((f, i) => (
            <li key={f.name + f.size + i} className="flex items-center gap-3 rounded-xl border border-line bg-card px-3 py-2 text-sm">
              <FileText size={16} className="shrink-0 text-forest" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 font-mono text-xs text-ink-faint">{fmtSize(f.size)}</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onChange(files.filter((_, j) => j !== i))} className="rounded-full p-1 text-ink-faint hover:bg-paper-2 hover:text-ink">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ───────── JD input: paste or upload ───────── */
export function JdInput({ value, onChange }: { value: JdValue; onChange: (v: JdValue) => void }) {
  const [picked, setPicked] = useState<"paste" | "upload">("paste");
  // A file set from outside (e.g. sample data) always shows the upload view.
  const mode = value.file ? "upload" : picked;
  const setMode = (m: "paste" | "upload") => {
    setPicked(m);
    if (m === "paste" && value.file) onChange({ text: "", file: null });
  };
  return (
    <div>
      <div className="mb-3 inline-flex rounded-full border border-line-strong bg-paper-2/60 p-1 text-sm">
        {(["paste", "upload"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cx("rounded-full px-4 py-1.5 font-medium transition-colors", mode === m ? "bg-forest text-paper shadow-soft" : "text-ink-soft hover:text-ink")}
          >
            {m === "paste" ? "Paste text" : "Upload file"}
          </button>
        ))}
      </div>
      {mode === "paste" ? (
        <textarea
          value={value.text}
          onChange={(e) => onChange({ text: e.target.value, file: null })}
          rows={11}
          placeholder="Paste the full job description here…"
          className="w-full resize-y rounded-2xl border border-line-strong bg-paper/50 px-4 py-3.5 leading-relaxed outline-none transition focus:border-forest focus:bg-card focus:ring-4 focus:ring-forest/10"
        />
      ) : (
        <FileDrop files={value.file ? [value.file] : []} onChange={(f) => onChange({ text: "", file: f[0] ?? null })} title="Drop the job description here, or click to browse" />
      )}
    </div>
  );
}

export const jdReady = (v: JdValue) => !!v.file || v.text.trim().length >= 60;

export function jdFormData(v: JdValue, title?: string): FormData {
  const fd = new FormData();
  if (v.file) fd.append("jdFile", v.file);
  else fd.append("jdText", v.text);
  if (title) fd.append("title", title);
  return fd;
}
