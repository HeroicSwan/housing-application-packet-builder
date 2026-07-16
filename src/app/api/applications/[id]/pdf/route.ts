import { NextResponse } from "next/server";
import { activateOrganizationContext, canAccessCase, requireUser } from "@/lib/auth/session";
import { safeApplicationFilename } from "@/lib/applications/filename";
import { generateApplicationOutput } from "@/lib/applications/output";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = activateOrganizationContext(await requireUser());
  const { id } = await params;
  try {
    const { draft, pdfData, bytes } = await generateApplicationOutput(id);
    if (!(await canAccessCase(user, draft.clientCaseId))) return new NextResponse("Forbidden", { status: 403 });
    if (!draft.generatedAt) return new NextResponse("Generate the application before downloading it.", { status: 409 });
    const filename = safeApplicationFilename(draft.template.outputFilenamePattern, { clientName: draft.clientCase.legalName, version: pdfData.generationVersion });
    return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return new NextResponse(error instanceof Error ? error.message : "Application unavailable.", { status: 422 }); }
}
