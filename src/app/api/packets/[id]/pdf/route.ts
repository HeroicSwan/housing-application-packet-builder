import { NextResponse } from "next/server";
import { activateOrganizationContext, canAccessPacket, requireUser } from "@/lib/auth/session";
import { generatePacketOutput } from "@/lib/packets/output";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = activateOrganizationContext(await requireUser());
  const { id } = await params;
  if (!(await canAccessPacket(user, id))) return new NextResponse("Forbidden", { status: 403 });
  try {
    const { packet, bytes } = await generatePacketOutput(id);
    return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${packet.referenceNumber}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new NextResponse("Packet snapshot is unavailable, invalid, or no longer matches its approval.", { status: 422 });
  }
}
