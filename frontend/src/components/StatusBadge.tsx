import type { ApplicationStatus } from "../lib/types";

const STYLES: Record<ApplicationStatus, string> = {
  APPLIED: "bg-blue-50 text-blue-700 ring-blue-200",
  INTERVIEWING: "bg-amber-50 text-amber-700 ring-amber-200",
  OFFER: "bg-green-50 text-green-700 ring-green-200",
  REJECTED: "bg-red-50 text-red-700 ring-red-200",
  GHOSTED: "bg-gray-100 text-gray-600 ring-gray-200",
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
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
