"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function PortalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => { console.error("Portal render failed", error.digest ?? "no-digest"); }, [error.digest]);
  return <div role="alert" className="mx-auto max-w-xl border bg-white p-8"><p className="text-sm font-semibold text-primary">Workspace error</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">This page could not be loaded</h1><p className="mt-3 text-muted-foreground">Try the request again. If the problem continues, return to the dashboard. Sensitive record details have not been included in this message.</p><div className="mt-6 flex gap-3"><Button type="button" onClick={() => unstable_retry()}>Try again</Button><Button asChild variant="outline"><a href="/dashboard">Dashboard</a></Button></div></div>;
}
