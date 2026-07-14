export function SectionHeading({ index, title, description, action }: { index?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div data-section={index} className="flex flex-wrap items-start justify-between gap-4 border-b pb-4"><div><h2 className="text-xl font-semibold tracking-[-0.015em]">{title}</h2>{description && <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}</div>{action && <div>{action}</div>}</div>;
}
