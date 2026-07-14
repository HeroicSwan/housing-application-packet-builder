export default function PortalLoading() {
  return <div role="status" aria-live="polite" className="space-y-5"><div className="h-4 w-40 animate-pulse bg-zinc-200" /><div className="h-12 max-w-xl animate-pulse bg-zinc-200" /><div className="grid gap-px bg-border sm:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-32 animate-pulse bg-white p-5"><div className="h-8 w-16 bg-zinc-200" /><div className="mt-8 h-3 w-32 bg-zinc-200" /></div>)}</div><span className="sr-only">Loading workspace</span></div>;
}
