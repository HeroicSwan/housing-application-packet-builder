import Link from "next/link";
import { LockKeyhole } from "lucide-react";

export default function UnauthorizedPage() {
  return <div className="mx-auto max-w-xl border bg-white p-10 text-center"><LockKeyhole className="mx-auto h-10 w-10 text-primary" /><h1 className="mt-5 text-3xl font-semibold tracking-tight">This area is restricted</h1><p className="mt-3 text-muted-foreground">Your demonstration role does not have permission to open this page.</p><Link href="/dashboard" className="mt-7 inline-block font-semibold text-primary underline underline-offset-4">Return to dashboard</Link></div>;
}
