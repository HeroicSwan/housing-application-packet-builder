"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";

type ReviewField = {
  id: string;
  fieldName: string;
  sourcePage: number | null;
  sourceText: string | null;
  confidence: number;
  reviewStatus: string;
  reviewReason: string | null;
  sourceRegionJson: string | null;
  conflicts: Array<{ filename: string; value: string; status: string }>;
};

type PageImage = { page: number; dataUrl: string };

export function DocumentReviewWorkbench({
  documentId,
  fields,
  pages,
  children,
  batchForm,
}: {
  documentId: string;
  fields: ReviewField[];
  pages: PageImage[];
  children: ReactNode;
  batchForm: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState(fields[0]?.id ?? "");
  const selected = useMemo(() => fields.find((field) => field.id === selectedId) ?? fields[0], [fields, selectedId]);

  useEffect(() => {
    const fieldNodes = document.querySelectorAll<HTMLElement>(`[data-review-workbench="${documentId}"] [data-review-field]`);
    fieldNodes.forEach((node) => node.dataset.selected = node.dataset.fieldId === selected?.id ? "true" : "false");
  }, [documentId, selected?.id]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (!selected) return;
      const index = fields.findIndex((field) => field.id === selected.id);
      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedId(fields[Math.min(index + 1, fields.length - 1)]?.id ?? selected.id);
      } else if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedId(fields[Math.max(index - 1, 0)]?.id ?? selected.id);
      } else if (["a", "r"].includes(event.key)) {
        event.preventDefault();
        const action = event.key === "a" ? "approve" : "reject";
        document.querySelector<HTMLButtonElement>(`[data-review-field][data-field-id="${selected.id}"] [data-review-action="${action}"]`)?.click();
      } else if (event.key === "e") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(`[data-review-field][data-field-id="${selected.id}"] [data-review-input]`)?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fields, selected]);

  const page = selected?.sourcePage ? pages.find((item) => item.page === selected.sourcePage) : pages[0];
  let region: { x: number; y: number; width: number; height: number } | null = null;
  try { region = selected?.sourceRegionJson ? JSON.parse(selected.sourceRegionJson) : null; } catch { region = null; }

  return <div data-review-workbench={documentId} onClick={(event) => { const node = (event.target as HTMLElement).closest<HTMLElement>("[data-review-field]"); if (node?.dataset.fieldId) setSelectedId(node.dataset.fieldId); }} className="grid gap-0 border-t bg-slate-50 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
    <aside className="border-b bg-slate-950 p-4 text-white lg:border-b-0 lg:border-r lg:p-5">
      <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Evidence rail</p><h4 className="mt-1 text-sm font-semibold">Source page {selected?.sourcePage ?? "—"}</h4></div><div className="text-right text-[10px] text-slate-400">{pages.length ? `${pages.length} page${pages.length === 1 ? "" : "s"}` : "Preview unavailable"}</div></div>
      <div className="relative mt-4 min-h-64 overflow-hidden border border-slate-700 bg-slate-900">
        {page ? <Image src={page.dataUrl} alt={`Document page ${page.page}`} width={1200} height={1600} unoptimized className="max-h-[620px] w-full object-contain" /> : <div className="flex min-h-64 items-center justify-center px-6 text-center text-xs text-slate-400">The source preview is unavailable. Use the retained evidence snippet and page number to verify this value.</div>}
        {page && region && <span aria-hidden className="pointer-events-none absolute border-2 border-blue-400 bg-blue-400/20" style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` }} />}
      </div>
      <div className="mt-4 rounded border border-slate-700 bg-slate-900/70 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300">Selected evidence</p><p className="mt-2 text-sm leading-6 text-slate-200">{selected?.sourceText || "No evidence snippet was retained for this field."}</p>{selected && <p className="mt-2 text-[11px] text-slate-400">Confidence {Math.round(selected.confidence * 100)}% · {selected.reviewStatus}</p>}</div>
      <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-slate-400"><span className="rounded border border-slate-700 px-2 py-1">A approve</span><span className="rounded border border-slate-700 px-2 py-1">R reject</span><span className="rounded border border-slate-700 px-2 py-1">E edit</span><span className="rounded border border-slate-700 px-2 py-1">J/K next</span></div>
    </aside>
    <section className="min-w-0 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Review workspace</p><p className="mt-1 text-sm text-slate-600">Select a field to anchor the evidence rail. High-confidence fields can be approved in one pass.</p></div>{batchForm}</div>
      {children}
    </section>
  </div>;
}
