"use client";

import { useActionState } from "react";
import type { UploadFormState } from "@/app/actions/documents";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const categories = ["IDENTITY", "INCOME", "RESIDENCY", "HOUSEHOLD", "DISABILITY", "HOMELESSNESS_VERIFICATION", "OTHER"];

export function UploadDocumentForm({ action }: { action: (state: UploadFormState, formData: FormData) => Promise<UploadFormState> }) {
  const [state, formAction] = useActionState(action, { message: "", error: false });
  return <form action={formAction} className="mt-5 grid gap-5 border bg-white p-6 sm:grid-cols-[1fr_260px_auto]"><div className="space-y-2"><Label htmlFor="file">Document</Label><Input id="file" name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" required /><p className="text-xs text-muted-foreground">PDF, PNG, or JPEG · up to 8 MB · file contents must match the extension</p></div><div className="space-y-2"><Label htmlFor="category">Document category</Label><select id="category" name="category" className="h-9 w-full border bg-white px-3 text-sm">{categories.map((category) => <option key={category}>{category}</option>)}</select></div><div className="flex items-end"><SubmitButton pendingLabel="Uploading and processing…">Upload and process</SubmitButton></div>{state.message && <p aria-live="polite" className={`text-sm sm:col-span-3 ${state.error ? "text-red-700" : "text-emerald-700"}`}>{state.message}</p>}</form>;
}
