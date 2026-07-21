import { notFound } from "next/navigation";
import { Check, FileText, Pencil, Trash2, X } from "lucide-react";
import { deleteDocumentAction, retryDocumentProcessingAction, uploadDocumentAction, reviewExtractionAction } from "@/app/actions/documents";
import { db } from "@/lib/db";
import { activateOrganizationContext, canAccessCase, requireRole } from "@/lib/auth/session";
import { CaseHeader } from "@/features/cases/case-header";
import { SectionHeading } from "@/components/section-heading";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { SubmitButton } from "@/components/submit-button";
import { UploadDocumentForm } from "@/features/documents/upload-document-form";

export default async function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = activateOrganizationContext(await requireRole(["CASEWORKER", "REVIEWER", "SUPERVISOR", "AUDITOR"]));
  const { id } = await params;
  if (!(await canAccessCase(user, id))) notFound();
  const clientCase = await db.clientCase.findUnique({ where: { id }, include: { documents: { include: { extractedFields: true, uploadedBy: true }, orderBy: { uploadedAt: "desc" } } } });
  if (!clientCase) notFound();
  return <div>
    <CaseHeader clientCase={clientCase} />
    <section className="mt-10">
      <SectionHeading index="03" title="Supporting documents" description="Extraction is a proposal. Staff must approve, correct, or classify every value before it can be relied on." />
      {user.role === "CASEWORKER" && <UploadDocumentForm action={uploadDocumentAction.bind(null, id)} />}
      <div className="mt-7 space-y-5">{clientCase.documents.length ? clientCase.documents.map((document) => <article key={document.id} className="border bg-white">
        <header className="grid gap-4 border-b bg-secondary p-5 sm:grid-cols-[auto_1fr_auto]">
          <div className="flex h-10 w-10 items-center justify-center border bg-white"><FileText className="h-5 w-5 text-primary" /></div>
          <div><h3 className="font-semibold">{document.originalFilename}</h3><p className="mt-1 text-xs text-muted-foreground">{document.documentCategory.replaceAll("_", " ")} · Uploaded {formatDate(document.uploadedAt)} by {document.uploadedBy.name}{document.expirationDate ? ` · Expires ${formatDate(document.expirationDate)}` : ""}{document.duplicateOfId ? " · Duplicate bytes were not stored" : ""}</p></div>
          <div className="flex flex-wrap gap-2"><StatusBadge status={document.processingStatus} />{document.quarantineStatus !== "CLEAR" && <StatusBadge status={document.quarantineStatus} />}</div>
        </header>
        {["FAILED", "QUARANTINED", "DUPLICATE", "COMPLETED_WITH_REVIEW"].includes(document.processingStatus) && <div role="alert" className={`flex flex-wrap items-center justify-between gap-4 border-b p-4 text-sm ${document.processingStatus === "COMPLETED_WITH_REVIEW" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-red-300 bg-red-50 text-red-900"}`}><span>{document.processingError ?? (document.processingStatus === "COMPLETED_WITH_REVIEW" ? "Extraction completed with abstentions. Confirm values manually before using this document." : "This document is unavailable.")}</span>{user.role === "CASEWORKER" && document.processingStatus === "FAILED" && <form action={retryDocumentProcessingAction.bind(null, id, document.id)}><SubmitButton variant="outline" size="sm" pendingLabel="Retrying…">Retry processing</SubmitButton></form>}</div>}
        <div>{document.extractedFields.length ? document.extractedFields.map((field) => <Extraction key={field.id} field={field} clientCaseId={id} editable={user.role !== "AUDITOR"} />) : <div className="p-5 text-sm text-muted-foreground">No extracted fields are available for this document.</div>}</div>
        {user.role === "CASEWORKER" && !document.deletedAt && <form action={deleteDocumentAction.bind(null, id, document.id)} className="flex flex-wrap items-end gap-3 border-t bg-red-50/50 p-4"><div className="min-w-72 flex-1"><label htmlFor={`delete-${document.id}`} className="text-xs font-semibold">Deletion reason</label><Input id={`delete-${document.id}`} name="reason" required minLength={10} placeholder="Why this document may be removed" className="mt-1" /></div><SubmitButton variant="outline" size="sm" pendingLabel="Deleting…"><Trash2 /> Delete document</SubmitButton></form>}
      </article>) : <div className="border bg-white p-12 text-center"><FileText className="mx-auto h-8 w-8 text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">No documents uploaded</h3><p className="mt-2 text-sm text-muted-foreground">Upload a PDF, PNG, or JPEG to begin human-reviewed extraction.</p></div>}</div>
    </section>
  </div>;
}

function Extraction({ field, clientCaseId, editable }: { field: { id: string; fieldName: string; extractedValue: string; normalizedValue: string | null; reviewedValue: string | null; confidence: number; sourcePage: number | null; sourceText: string | null; reviewStatus: string; reviewReason: string | null; validationState: string }; clientCaseId: string; editable: boolean }) {
  const action = reviewExtractionAction.bind(null, clientCaseId, field.id);
  return <div data-testid={`extraction-${field.fieldName}`} className="grid gap-4 border-b p-5 last:border-b-0 lg:grid-cols-[1fr_1.1fr_240px]">
    <div><div className="flex flex-wrap items-center gap-2"><span className="font-medium capitalize">{field.fieldName.replaceAll("_", " ")}</span><StatusBadge status={field.reviewStatus} /><StatusBadge status={field.validationState} /></div><div className="mt-2 text-base">{field.reviewedValue ?? field.normalizedValue ?? field.extractedValue}</div><div className="mt-1 text-xs text-muted-foreground">Original: {field.extractedValue} · Confidence {Math.round(field.confidence * 100)}% · Page {field.sourcePage ?? "unknown"}</div>{field.reviewReason && <p className="mt-2 text-xs text-muted-foreground">Reason: {field.reviewReason}</p>}</div>
    <div className="rounded-md bg-secondary p-3"><div className="text-xs font-medium text-muted-foreground">Source text</div><blockquote className="mt-1.5 text-sm leading-6">{field.sourceText ?? "No source text retained."}</blockquote></div>
    {editable ? <form action={action} className="space-y-2">
      <Input name="reviewedValue" aria-label={`Reviewed value for ${field.fieldName}`} defaultValue={field.reviewedValue ?? field.normalizedValue ?? field.extractedValue} />
      <Input name="reason" aria-label={`Review reason for ${field.fieldName}`} defaultValue={field.reviewReason ?? ""} placeholder="Reason for rejection or exception" />
      <div className="grid grid-cols-3 gap-1"><SubmitButton name="status" value="APPROVED" size="sm" variant="outline" title="Approve" pendingLabel="…"><Check /></SubmitButton><SubmitButton name="status" value="EDITED" size="sm" variant="outline" title="Save edit" pendingLabel="…"><Pencil /></SubmitButton><SubmitButton name="status" value="REJECTED" size="sm" variant="outline" title="Reject" pendingLabel="…"><X /></SubmitButton></div>
      <div className="flex gap-2"><select name="status" aria-label={`Exceptional review state for ${field.fieldName}`} defaultValue="UNREADABLE" className="h-9 min-w-0 flex-1 border bg-white px-2 text-xs">{["UNREADABLE", "MISSING", "EXPIRED", "INVALID", "CONFLICTING"].map((status) => <option key={status}>{status}</option>)}</select><SubmitButton size="sm" variant="outline" pendingLabel="Saving…">Save state</SubmitButton></div>
    </form> : <p className="text-sm text-muted-foreground">Read-only audit view</p>}
  </div>;
}
