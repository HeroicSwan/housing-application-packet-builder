import { db } from "@/lib/db";

export function recordAudit(input: { userId: string; clientCaseId?: string; action: string; entityType: string; entityId: string; metadata?: string }) {
  return db.auditEvent.create({ data: input });
}
