"use client";

import { useActionState } from "react";
import type { CaseFormState } from "@/app/actions/cases";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Values = { legalName?: string | null; preferredName?: string | null; dateOfBirth?: string | null; preferredLanguage?: string | null; phone?: string | null; email?: string | null; currentLivingSituation?: string | null; accessibilityNeeds?: string | null; notes?: string | null };
type Action = (state: CaseFormState, formData: FormData) => Promise<CaseFormState>;

export function CaseForm({ action, initialValues = {}, submitLabel }: { action: Action; initialValues?: Values; submitLabel: string }) {
  const initialState: CaseFormState = { message: "", errors: {}, values: Object.fromEntries(Object.entries(initialValues).map(([key, value]) => [key, value ?? ""])) };
  const [state, formAction] = useActionState(action, initialState);
  const value = (name: keyof Values) => state.values[name] ?? initialValues[name] ?? "";
  return <form action={formAction} className="border bg-white p-6 sm:p-8"><div className="grid gap-6 sm:grid-cols-2"><Field label="Legal name" name="legalName" value={value("legalName")} error={state.errors.legalName?.[0]} required /><Field label="Preferred name" name="preferredName" value={value("preferredName")} error={state.errors.preferredName?.[0]} /><Field label="Date of birth" name="dateOfBirth" value={value("dateOfBirth")} error={state.errors.dateOfBirth?.[0]} type="date" /><Field label="Preferred language" name="preferredLanguage" value={value("preferredLanguage")} error={state.errors.preferredLanguage?.[0]} /><Field label="Phone" name="phone" value={value("phone")} error={state.errors.phone?.[0]} type="tel" /><Field label="Email" name="email" value={value("email")} error={state.errors.email?.[0]} type="email" /><Area label="Current living situation" name="currentLivingSituation" value={value("currentLivingSituation")} error={state.errors.currentLivingSituation?.[0]} placeholder="Use plain, factual language." /><Area label="Accessibility needs" name="accessibilityNeeds" value={value("accessibilityNeeds")} error={state.errors.accessibilityNeeds?.[0]} /><Area label="Case notes" name="notes" value={value("notes")} error={state.errors.notes?.[0]} /></div><div className="mt-8 flex flex-wrap items-center justify-between gap-4"><p aria-live="polite" className={`text-sm ${Object.keys(state.errors).length ? "text-red-700" : "text-emerald-700"}`}>{state.message}</p><SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton></div></form>;
}

function Field({ label, name, value, error, type = "text", required = false }: { label: string; name: string; value: string; error?: string; type?: string; required?: boolean }) { const errorId = `${name}-error`; return <div className="space-y-2"><Label htmlFor={name}>{label}{required && " *"}</Label><Input id={name} name={name} type={type} defaultValue={value} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} />{error && <p id={errorId} className="text-sm text-red-700">{error}</p>}</div>; }
function Area({ label, name, value, error, placeholder }: { label: string; name: string; value: string; error?: string; placeholder?: string }) { const errorId = `${name}-error`; return <div className="space-y-2 sm:col-span-2"><Label htmlFor={name}>{label}</Label><Textarea id={name} name={name} defaultValue={value} placeholder={placeholder} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} />{error && <p id={errorId} className="text-sm text-red-700">{error}</p>}</div>; }
