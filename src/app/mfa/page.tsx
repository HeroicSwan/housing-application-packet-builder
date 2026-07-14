import { verifyMfaAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="mx-auto min-h-screen max-w-lg px-6 py-20"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">Two-step verification</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">Enter your verification code</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Use the current six-digit code from your authenticator app, or one unused recovery code.</p>{error && <div role="alert" className="mt-6 border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>}<form action={verifyMfaAction} className="mt-8 space-y-5 border bg-white p-6"><div className="space-y-2"><Label htmlFor="code">Verification or recovery code</Label><Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required autoFocus /></div><SubmitButton pendingLabel="Verifying…">Verify and sign in</SubmitButton></form></main>;
}
