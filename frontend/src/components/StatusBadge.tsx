import type { ApplicationStatus } from "../lib/types";

const STYLES: Record<ApplicationStatus, string> = {
  APPLIED: "bg-paper-dim text-ink-soft border-line-strong/40",
  INTERVIEWING: "bg-glow-soft text-glow-ink border-glow/40",
  OFFER: "bg-accent-soft text-accent-ink border-accent/40",
  REJECTED: "bg-rust-soft text-rust-ink border-rust/40",
  GHOSTED: "bg-paper-dim text-ink-soft/70 border-line border-dashed",
};

const LABELS: Record<ApplicationStatus, string> = {
  APPLIED: "Applied",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  REJECTED: "Rejected",
  GHOSTED: "Ghosted",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-[4px] border px-2 py-0.5 font-mono text-[11px] tracking-wide ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
