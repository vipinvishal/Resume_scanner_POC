"use client";

import { useEffect } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { btn, cx } from "./ui";

/** A small "are you sure?" pop-up. Escape or clicking outside cancels. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  icon: Icon = Trash2,
  busy = false,
  error = "",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  icon?: React.ElementType;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div className="animate-fade-quick fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]" onClick={() => !busy && onCancel()}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-msg" onClick={(e) => e.stopPropagation()} className="animate-pop w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-lift">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-reject-bg text-reject">
          <Icon size={20} />
        </span>
        <h2 id="confirm-title" className="font-display mt-4 text-2xl font-semibold">{title}</h2>
        <p id="confirm-msg" className="mt-1.5 text-ink-soft">{message}</p>
        {error && <p role="alert" className="mt-3 text-sm text-reject">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button autoFocus onClick={onCancel} disabled={busy} className={btn.ghost}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy} className={cx(btn.primary, "!bg-reject hover:!bg-reject/90")}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />} {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
