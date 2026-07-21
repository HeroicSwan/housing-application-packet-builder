# Reviewer workbench

The document review screen is designed for evidence-first review. Open **Review queue → Documents needing attention**, then choose a document to work through its extracted fields.

## Fast review loop

- Select a field to anchor the source page, retained evidence snippet, confidence, and review reason in the evidence rail.
- Press `A` to approve, `R` to reject, `E` to focus the corrected value, and `J`/`K` (or the arrow keys) to move between fields. Shortcuts are disabled while typing in a control.
- Use **Approve high-confidence** for pending fields at or above 90% confidence that include both a source page and evidence snippet. Every batch decision creates its own revision and audit event.
- Use the escalation form when evidence is ambiguous or documents disagree. Escalation changes the field to `CONFLICTING`, preserves the reason, and places it back in the review queue.

## Evidence and history

PDF pages and image uploads are rendered into an authenticated, in-memory evidence rail. If a model provides a normalized source region, the region is highlighted; otherwise the source page and snippet remain the authoritative anchors. The rail never sends the document to an external AI provider.

Open **Change history** on any field to see every before/after value, review state transition, reviewer, timestamp, and comment. Revision rows are append-only and are tenant-scoped in production PostgreSQL.

Duplicate uploads link back to the original document. Conflicting values for the same field across documents are shown together before a reviewer can approve the value.
