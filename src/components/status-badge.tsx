import { Badge } from "@/components/ui/badge";
import { statusLabel } from "@/lib/format";

const colors: Record<string, string> = {
  APPROVED: "border-emerald-200 bg-emerald-50/70 text-emerald-800", SATISFIED: "border-emerald-200 bg-emerald-50/70 text-emerald-800", COMPLETED: "border-emerald-200 bg-emerald-50/70 text-emerald-800", AUTOMATICALLY_COMPLETED: "border-emerald-200 bg-emerald-50/70 text-emerald-800", CONFIRMED: "border-emerald-200 bg-emerald-50/70 text-emerald-800", GENERATED: "border-emerald-200 bg-emerald-50/70 text-emerald-800",
  READY_FOR_REVIEW: "border-sky-200 bg-sky-50/70 text-sky-800", PENDING: "border-amber-200 bg-amber-50/70 text-amber-800", NEEDS_REVIEW: "border-amber-200 bg-amber-50/70 text-amber-800",
  IN_REVIEW: "border-sky-200 bg-sky-50/70 text-sky-800", PROCESSING: "border-sky-200 bg-sky-50/70 text-sky-800", ACTIVE: "border-sky-200 bg-sky-50/70 text-sky-800", READY_TO_GENERATE: "border-sky-200 bg-sky-50/70 text-sky-800", SUBMITTED_FOR_REVIEW: "border-sky-200 bg-sky-50/70 text-sky-800",
  NEEDS_CORRECTION: "border-rose-200 bg-rose-50/70 text-rose-800", CONFLICT: "border-rose-200 bg-rose-50/70 text-rose-800", EXPIRED: "border-rose-200 bg-rose-50/70 text-rose-800", REJECTED: "border-rose-200 bg-rose-50/70 text-rose-800",
  MISSING: "border-zinc-200 bg-zinc-50 text-zinc-700", NOT_APPLICABLE: "border-zinc-200 bg-zinc-50 text-zinc-600", FAILED: "border-rose-200 bg-rose-50/70 text-rose-800", NEEDS_ANSWER: "border-amber-200 bg-amber-50/70 text-amber-800", NEEDS_INFORMATION: "border-amber-200 bg-amber-50/70 text-amber-800", AWAITING_CONFIRMATION: "border-amber-200 bg-amber-50/70 text-amber-800", INVALID: "border-rose-200 bg-rose-50/70 text-rose-800", RETURNED: "border-rose-200 bg-rose-50/70 text-rose-800",
};

export function StatusBadge({ status }: { status: string }) {
  const staffLabels: Record<string, string> = { NEEDS_REVIEW: "Needs staff review", EXPIRED: "Document has expired", CONFLICT: "Information differs", PENDING: "Waiting for staff review", PROCESSING: "Processing document", FAILED: "Processing failed", AUTOMATICALLY_COMPLETED: "Automatically completed", NEEDS_ANSWER: "Needs an answer", NEEDS_INFORMATION: "Needs information", READY_TO_GENERATE: "Ready to generate", AWAITING_CONFIRMATION: "Awaiting confirmation", SUBMITTED_FOR_REVIEW: "Submitted for review", GENERATED: "Application generated" };
  return <Badge variant="outline" className={colors[status] ?? "border-zinc-300 bg-white text-zinc-700"}>{staffLabels[status] ?? statusLabel(status)}</Badge>;
}
