import { NextResponse } from "next/server";
import { canAccessCase, getCurrentUser } from "@/lib/auth/session";
import { generateSupportingPacketPdf } from "@/lib/applications/pdf";
import { safeApplicationFilename } from "@/lib/applications/filename";
import { generateApplicationOutput } from "@/lib/applications/output";
import { getLegacyOrStoredObject } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user) return new NextResponse("Unauthorized", { status: 401 }); const { id } = await params;
  try {
    const { draft, pdfData, bytes: applicationBytes } = await generateApplicationOutput(id);
    if (!(await canAccessCase(user, draft.clientCaseId))) return new NextResponse("Forbidden", { status: 403 });
    if (!draft.generatedAt) return new NextResponse("Generate the completed application before assembling a supporting packet.", { status: 409 });
    const selected = draft.documents.filter((item) => item.selected && item.authorized && item.uploadedDocument.processingStatus === "COMPLETED" && !item.uploadedDocument.extractedFields.some((field) => field.reviewStatus === "REJECTED"));
    const documents = await Promise.all(selected.map(async (item) => { let bytes: Uint8Array | undefined; try { bytes = await getLegacyOrStoredObject(item.uploadedDocument); } catch {} return { name: item.uploadedDocument.originalFilename, category: item.uploadedDocument.documentCategory, bytes }; }));
    const selectedCategories = new Set(selected.map((item) => item.uploadedDocument.documentCategory));
    const missingDocuments = draft.clientCase.selectedProgram?.requirements.filter((item) => item.isRequired && !selectedCategories.has(item.category)).map((item) => item.name) ?? [];
    const bytes = await generateSupportingPacketPdf({ applicationBytes, applicationReference: pdfData.applicationReference, applicantName: draft.clientCase.legalName, documents, missingDocuments });
    const applicationName = safeApplicationFilename(draft.template.outputFilenamePattern, { clientName: draft.clientCase.legalName, version: pdfData.generationVersion }).replace(/\.pdf$/, "");
    return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${applicationName}-supporting-packet.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return new NextResponse(error instanceof Error ? error.message : "Supporting packet unavailable.", { status: 422 }); }
}
