import { sha256 } from "@/lib/security/encryption";

export type TemplateCompatibilityField = { fieldKey: string; fieldType: string; required: boolean; canonicalFieldPath: string | null; pdfFieldName: string | null };

export function templateVersionFingerprint(fields: TemplateCompatibilityField[]) {
  return sha256(JSON.stringify([...fields].sort((a, b) => a.fieldKey.localeCompare(b.fieldKey))));
}

export function compareTemplateVersions(source: TemplateCompatibilityField[], target: TemplateCompatibilityField[]) {
  const before = new Map(source.map((field) => [field.fieldKey, field]));
  const after = new Map(target.map((field) => [field.fieldKey, field]));
  const added = target.filter((field) => !before.has(field.fieldKey)).map((field) => field.fieldKey);
  const removed = source.filter((field) => !after.has(field.fieldKey)).map((field) => field.fieldKey);
  const changed = target.filter((field) => {
    const previous = before.get(field.fieldKey);
    return previous && JSON.stringify(previous) !== JSON.stringify(field);
  }).map((field) => field.fieldKey);
  const blockers = [
    ...removed.map((field) => `Mapped field removed: ${field}`),
    ...target.filter((field) => field.required && !field.canonicalFieldPath && !field.pdfFieldName).map((field) => `Required field has no mapping: ${field.fieldKey}`),
  ];
  return { compatible: blockers.length === 0, added, removed, changed, blockers };
}
