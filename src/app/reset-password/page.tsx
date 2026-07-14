import Link from "next/link";
import { resetPasswordAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token = "", error } = await searchParams;
  const action = resetPasswordAction.bind(null, token);
  return <main className="mx-auto min-h-screen max-w-xl px-6 py-20"><Link href="/" className="text-sm text-primary underline underline-offset-4">Back to sign in</Link><h1 className="mt-10 text-3xl font-semibold tracking-[-0.03em]">Choose a new password</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Use at least 12 characters with uppercase, lowercase, and a number.</p>{error && <div role="alert" className="mt-6 border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>}<form action={action} className="mt-8 space-y-5 border bg-white p-6"><div className="space-y-2"><Label htmlFor="password">New password</Label><Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required /></div><div className="space-y-2"><Label htmlFor="confirmPassword">Confirm password</Label><Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} required /></div><SubmitButton pendingLabel="Updating…">Update password</SubmitButton></form></main>;
}
