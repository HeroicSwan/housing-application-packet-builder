import Link from "next/link";
import { requestPasswordResetAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string; demoToken?: string; error?: string }> }) {
  const params = await searchParams;
  return <main className="mx-auto min-h-screen max-w-xl px-6 py-20"><Link href="/" className="text-sm text-primary underline underline-offset-4">Back to sign in</Link><h1 className="mt-10 text-3xl font-semibold tracking-[-0.03em]">Reset your password</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Enter your work email. If an active account exists, a reset link will be sent.</p>{params.error && <div role="alert" className="mt-6 border border-red-300 bg-red-50 p-4 text-sm text-red-800">{params.error}</div>}{params.sent ? <div aria-live="polite" className="mt-6 border bg-secondary p-4 text-sm">Check your email for a reset link.{params.demoToken && <div className="mt-3">Local demo: <Link className="font-medium text-primary underline" href={`/reset-password?token=${encodeURIComponent(params.demoToken)}`}>open the reset form</Link>.</div>}</div> : <form action={requestPasswordResetAction} className="mt-8 space-y-5 border bg-white p-6"><div className="space-y-2"><Label htmlFor="email">Email address</Label><Input id="email" name="email" type="email" autoComplete="email" required /></div><SubmitButton pendingLabel="Sending…">Send reset link</SubmitButton></form>}</main>;
}
