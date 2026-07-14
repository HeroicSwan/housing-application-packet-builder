import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { loginAction, demoLoginAction } from "@/app/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { env } from "@/lib/env";
import { SubmitButton } from "@/components/submit-button";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { error } = await searchParams;
  return (
    <main className="min-h-screen bg-[#f7f8f8]">
      <div className="border-b border-sky-200/70 bg-sky-50 px-5 py-3 text-xs text-sky-950">
        <div className="mx-auto flex max-w-6xl items-center gap-2"><ShieldCheck className="h-4 w-4" /> Demonstration environment · Synthetic data only · Do not enter real client information</div>
      </div>
      <div className="mx-auto grid min-h-[calc(100vh-49px)] max-w-6xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="flex flex-col justify-between border-x border-b bg-white p-7 sm:p-12 lg:p-16">
          <div>
            <div className="mb-20 text-sm font-semibold text-primary">Housing Application Packet Builder</div>
            <div className="border-l-2 border-primary pl-6"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">Human-centered case operations</p><h1 className="mt-4 max-w-xl text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl">Build complete packets. Keep people in the decision.</h1><p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground">A focused workspace for nonprofit housing teams to collect records, resolve inconsistencies, and prepare submission-ready application packets.</p></div>
          </div>
          <div className="mt-16 border-t pt-5 text-sm text-muted-foreground">This support tool does not determine eligibility, rank clients, or provide legal conclusions. Qualified staff must review every packet.</div>
        </section>
        <section className="flex items-center border-r border-b bg-[#fbfbfb] p-7 sm:p-12 lg:p-16">
          <div className="w-full max-w-md">
            <h2 className="text-2xl font-semibold tracking-[-0.02em]">Sign in</h2>
            <p className="mt-2 text-sm text-muted-foreground">Use a seeded demonstration account or enter its credentials.</p>
            {error && <div role="alert" className="mt-5 border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
            <form action={loginAction} className="mt-7 space-y-5">
              <div className="space-y-2"><Label htmlFor="email">Email address</Label><Input id="email" name="email" type="email" autoComplete="email" required placeholder="caseworker@example.org" /></div>
              <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="password">Password</Label><Link href="/forgot-password" className="text-xs font-medium text-primary underline underline-offset-4">Forgot password?</Link></div><Input id="password" name="password" type="password" autoComplete="current-password" required /></div>
              <SubmitButton className="h-11 w-full" pendingLabel="Signing in…">Sign in <ArrowRight /></SubmitButton>
            </form>
            {env.ENABLE_DEMO_LOGIN && <><div className="my-7 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />Demo account selection<span className="h-px flex-1 bg-border" /></div>
            <div className="grid gap-2 sm:grid-cols-3">
              {["CASEWORKER", "REVIEWER", "ADMIN"].map((role) => <form action={demoLoginAction} key={role}><input type="hidden" name="role" value={role} /><SubmitButton pendingLabel="Opening…" variant="outline" className="w-full text-xs">{role === "CASEWORKER" ? "Caseworker" : role === "REVIEWER" ? "Reviewer" : "Administrator"}</SubmitButton></form>)}
            </div></>}
            <p className="mt-5 text-xs text-muted-foreground">Demo password: <span className="font-semibold text-foreground">DemoHousing2026!</span></p>
            <Link href="/privacy" className="mt-7 inline-block text-sm font-medium text-primary underline underline-offset-4">Privacy and demonstration notice</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
