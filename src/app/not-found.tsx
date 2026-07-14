import Link from "next/link";

export default function NotFound() {
  return <main className="mx-auto max-w-xl px-6 py-20"><p className="text-sm font-semibold text-primary">Record unavailable</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">The requested page was not found</h1><p className="mt-3 text-muted-foreground">The record may not exist, or your role may not have access to it.</p><Link href="/dashboard" className="mt-7 inline-block font-semibold text-primary underline underline-offset-4">Return to dashboard</Link></main>;
}
