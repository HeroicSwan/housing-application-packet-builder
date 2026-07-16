import { sha256 } from "@/lib/security/encryption";

type AuditData = Record<string, unknown>;

export function sealAuditRows(rows: AuditData[], organizationId: string, previousHash: string | null) {
  let prior = previousHash;
  return rows.map((row) => {
    const createdAt = row.createdAt instanceof Date ? row.createdAt : new Date();
    const eventHash = sha256(JSON.stringify([
      organizationId,
      row.userId,
      row.clientCaseId ?? null,
      row.action,
      row.entityType,
      row.entityId,
      row.metadata ?? null,
      createdAt.toISOString(),
      prior ?? "GENESIS",
    ]));
    const sealed = { ...row, createdAt, previousHash: prior, eventHash };
    prior = eventHash;
    return sealed;
  });
}

export function verifyAuditChain(rows: AuditData[], organizationId: string) {
  let prior: string | null = null;
  for (const row of rows) {
    const [sealed] = sealAuditRows([{ ...row, previousHash: undefined, eventHash: undefined }], organizationId, prior);
    if (row.previousHash !== prior || row.eventHash !== sealed.eventHash) return false;
    prior = String(row.eventHash);
  }
  return true;
}
