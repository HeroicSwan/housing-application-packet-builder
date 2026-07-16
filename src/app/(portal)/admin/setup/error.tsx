"use client";
import { Button } from "@/components/ui/button";
export default function SetupError({ reset }: { error: Error; reset: () => void }) { return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-7"><h2 className="text-lg font-semibold text-red-900">Setup could not be displayed</h2><p className="mt-2 text-sm text-red-800">No secret values were exposed. Reload the saved server-side configuration and try again.</p><Button className="mt-5" variant="outline" onClick={reset}>Try again</Button></div>; }
