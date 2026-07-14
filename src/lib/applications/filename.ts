export function safeApplicationFilename(pattern: string, input: { clientName: string; version: number }) {
  const slug = input.clientName.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "applicant";
  const raw = pattern.replace("{client}", slug).replace("{version}", String(input.version));
  const safe = raw.toLowerCase().replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^\.+/, "");
  return safe.endsWith(".pdf") ? safe : `${safe}.pdf`;
}
