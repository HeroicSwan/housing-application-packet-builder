"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { canAccessCase, canAccessPacket, requireRole } from "@/lib/auth/session";
import { canApprovePacket } from "@/lib/packets/approval";
import { assertPacketTransition } from "@/lib/packets/lifecycle";
import { buildPacketSnapshot, parsePacketSnapshot } from "@/lib/packets/snapshot";

const reviewStatusSchema = z.enum(["APPROVED", "REJECTED"]);
const noteSchema = z.string().trim().min(3, "Add a specific reviewer note.").max(2000);

export async function generatePacketAction(clientCaseId: string) {
  const user = await requireRole(["CASEWORKER"]);
  if (!(await canAccessCase(user, clientCaseId))) throw new Error("Case access denied.");
  const clientCase = await db.clientCase.findUniqueOrThrow({ where: { id: clientCaseId }, include: { selectedProgram: { include: { requirements: { orderBy: { sortOrder: "asc" } } } }, householdMembers: true, documents: { include: { extractedFields: true } }, packets: { orderBy: { version: "desc" } } } });
  if (!clientCase.selectedProgramId || !clientCase.selectedProgram) throw new Error("Select a housing program before generating a packet.");
  const currentDraft = clientCase.packets.find((packet) => packet.status === "DRAFT");
  if (currentDraft) redirect(`/packets/${currentDraft.id}?notice=${encodeURIComponent("Continue or submit the existing draft before creating another version.")}`);
  const generatedAt = new Date();
  const extractedValues = clientCase.documents.flatMap((document) => document.extractedFields.filter((field) => field.reviewStatus !== "REJECTED").map((field) => ({ fieldName: field.fieldName, value: field.reviewedValue ?? field.extractedValue, category: document.documentCategory })));
  const caseFacts = {
    legalName: clientCase.legalName,
    dateOfBirth: clientCase.dateOfBirth,
    householdCount: clientCase.householdMembers.length + 1,
    householdHasChildren: clientCase.householdMembers.some((member) => member.relationship.toLowerCase() === "child"),
    accessibilityNeeds: clientCase.accessibilityNeeds,
    documents: clientCase.documents.map((document) => ({ category: document.documentCategory, expirationDate: document.expirationDate })),
    requiredFields: { current_living_situation: clientCase.currentLivingSituation },
  };
  const snapshot = buildPacketSnapshot({
    generatedAt,
    caseReference: clientCase.referenceNumber,
    client: { legalName: clientCase.legalName, preferredName: clientCase.preferredName, dateOfBirth: clientCase.dateOfBirth?.toISOString().slice(0, 10) ?? null, preferredLanguage: clientCase.preferredLanguage, currentLivingSituation: clientCase.currentLivingSituation, accessibilityNeeds: clientCase.accessibilityNeeds },
    household: clientCase.householdMembers.map((member) => ({ name: member.name, relationship: member.relationship, dateOfBirth: member.dateOfBirth?.toISOString().slice(0, 10) ?? null, monthlyIncomeCents: member.monthlyIncomeCents, incomeSource: member.incomeSource })),
    program: { name: clientCase.selectedProgram.name, organization: clientCase.selectedProgram.organization, description: clientCase.selectedProgram.description, fictional: clientCase.selectedProgram.fictional },
    requirements: clientCase.selectedProgram.requirements,
    documents: clientCase.documents.map((document) => ({ originalFilename: document.originalFilename, fileType: document.fileType, category: document.documentCategory, uploadedAt: document.uploadedAt, expirationDate: document.expirationDate, processingStatus: document.processingStatus, reviewStatuses: document.extractedFields.map((field) => field.reviewStatus), extractedFields: document.extractedFields })),
    extractedValues,
    caseFacts,
  });
  const version = (clientCase.packets[0]?.version ?? 0) + 1;
  const packet = await db.$transaction(async (tx) => {
    const created = await tx.applicationPacket.create({ data: {
      referenceNumber: `PKT-${clientCase.referenceNumber.slice(-4)}-V${version}`,
      clientCaseId,
      housingProgramId: clientCase.selectedProgramId!,
      version,
      status: "DRAFT",
      generatedAt,
      snapshotJson: JSON.stringify(snapshot),
      unresolvedConflicts: snapshot.reviewItems.filter((item) => item.severity === "BLOCKING").length,
      fields: { create: [
        { fieldKey: "legal_name", fieldLabel: "Legal name", value: snapshot.client.legalName, sourceType: "CASE_RECORD", sourceReference: snapshot.caseReference },
        { fieldKey: "preferred_name", fieldLabel: "Preferred name", value: snapshot.client.preferredName ?? "", sourceType: "CASE_RECORD", sourceReference: snapshot.caseReference, isRequired: false },
        { fieldKey: "date_of_birth", fieldLabel: "Date of birth", value: snapshot.client.dateOfBirth ?? "", sourceType: "CASE_RECORD", sourceReference: snapshot.caseReference },
        { fieldKey: "living_situation", fieldLabel: "Current living situation", value: snapshot.client.currentLivingSituation ?? "", sourceType: "CASE_RECORD", sourceReference: snapshot.caseReference },
        { fieldKey: "household_size", fieldLabel: "Household size", value: String(snapshot.household.length + 1), sourceType: "CASE_RECORD", sourceReference: snapshot.caseReference },
        { fieldKey: "program", fieldLabel: "Housing program", value: snapshot.program.name, sourceType: "PROGRAM", sourceReference: "Program snapshot" },
      ] },
    } });
    await tx.auditEvent.create({ data: { userId: user.id, clientCaseId, action: "PACKET_GENERATED", entityType: "ApplicationPacket", entityId: created.id, metadata: `Draft packet version ${version} generated from a source snapshot` } });
    return created;
  });
  redirect(`/packets/${packet.id}`);
}

export async function submitPacketAction(packetId: string) {
  const user = await requireRole(["CASEWORKER"]);
  if (!(await canAccessPacket(user, packetId))) throw new Error("Packet access denied.");
  const packet = await db.applicationPacket.findUniqueOrThrow({ where: { id: packetId } });
  assertPacketTransition(packet.status, "READY_FOR_REVIEW");
  await db.$transaction([
    db.applicationPacket.update({ where: { id: packetId }, data: { status: "READY_FOR_REVIEW", submittedAt: new Date() } }),
    db.clientCase.update({ where: { id: packet.clientCaseId }, data: { status: "READY_FOR_REVIEW" } }),
    db.auditEvent.create({ data: { userId: user.id, clientCaseId: packet.clientCaseId, action: "PACKET_SUBMITTED", entityType: "ApplicationPacket", entityId: packetId, metadata: `Packet version ${packet.version} submitted for human review` } }),
  ]);
  redirect(`/packets/${packetId}?submitted=1`);
}

export async function reviewPacketFieldAction(packetId: string, fieldId: string, formData: FormData) {
  const user = await requireRole(["REVIEWER"]);
  const reviewStatus = reviewStatusSchema.parse(formData.get("status"));
  const reviewerNote = z.string().trim().max(500).parse(String(formData.get("note") ?? "")) || null;
  const packet = await db.applicationPacket.findUniqueOrThrow({ where: { id: packetId }, include: { fields: { where: { id: fieldId } } } });
  if (!packet.fields.length) throw new Error("Packet field not found.");
  if (packet.status === "READY_FOR_REVIEW") assertPacketTransition(packet.status, "IN_REVIEW");
  else if (packet.status !== "IN_REVIEW") throw new Error("Only packets under review can be changed.");
  await db.$transaction(async (tx) => {
    if (packet.status === "READY_FOR_REVIEW") await tx.applicationPacket.update({ where: { id: packetId }, data: { status: "IN_REVIEW" } });
    await tx.packetField.update({ where: { id: fieldId }, data: { reviewStatus, reviewerNote, reviewerId: user.id } });
    await tx.auditEvent.create({ data: { userId: user.id, clientCaseId: packet.clientCaseId, action: `PACKET_FIELD_${reviewStatus}`, entityType: "PacketField", entityId: fieldId, metadata: "Packet field reviewed; value not logged" } });
  });
  revalidatePath(`/review/${packetId}`);
}

export async function addReviewNoteAction(packetId: string, formData: FormData) {
  const user = await requireRole(["REVIEWER"]);
  const note = noteSchema.parse(formData.get("note"));
  const packet = await db.applicationPacket.findUniqueOrThrow({ where: { id: packetId } });
  if (!['READY_FOR_REVIEW', 'IN_REVIEW'].includes(packet.status)) throw new Error("Notes can be added only while a packet is under review.");
  await db.$transaction(async (tx) => {
    if (packet.status === "READY_FOR_REVIEW") await tx.applicationPacket.update({ where: { id: packetId }, data: { status: "IN_REVIEW" } });
    await tx.reviewNote.create({ data: { packetId, authorId: user.id, note } });
    await tx.auditEvent.create({ data: { userId: user.id, clientCaseId: packet.clientCaseId, action: "REVIEW_NOTE_ADDED", entityType: "ApplicationPacket", entityId: packetId, metadata: "Reviewer note added; note contents not logged" } });
  });
  revalidatePath(`/review/${packetId}`);
}

export async function overrideRequirementAction(packetId: string, formData: FormData) {
  const user = await requireRole(["REVIEWER"]);
  const requirementId = z.string().min(1).parse(formData.get("requirementId"));
  const note = z.string().trim().min(10, "Explain why this specific requirement is being overridden.").max(2000).parse(formData.get("note"));
  const packet = await db.applicationPacket.findUniqueOrThrow({ where: { id: packetId } });
  if (!['READY_FOR_REVIEW', 'IN_REVIEW'].includes(packet.status)) throw new Error("Requirements can be overridden only during review.");
  const requirement = parsePacketSnapshot(packet.snapshotJson).requirements.find((item) => item.id === requirementId && item.isRequired && item.state !== "SATISFIED");
  if (!requirement) throw new Error("This requirement does not need an override.");
  await db.$transaction(async (tx) => {
    if (packet.status === "READY_FOR_REVIEW") await tx.applicationPacket.update({ where: { id: packetId }, data: { status: "IN_REVIEW" } });
    await tx.requirementOverride.upsert({ where: { packetId_requirementId: { packetId, requirementId } }, update: { note, reviewerId: user.id, requirementName: requirement.name }, create: { packetId, requirementId, requirementName: requirement.name, note, reviewerId: user.id } });
    await tx.auditEvent.create({ data: { userId: user.id, clientCaseId: packet.clientCaseId, action: "REQUIREMENT_OVERRIDDEN", entityType: "ApplicationPacket", entityId: packetId, metadata: `Written override recorded for requirement: ${requirement.name}` } });
  });
  revalidatePath(`/review/${packetId}`);
}

export async function returnPacketAction(packetId: string, formData: FormData) {
  const user = await requireRole(["REVIEWER"]);
  const packet = await db.applicationPacket.findUniqueOrThrow({ where: { id: packetId } });
  assertPacketTransition(packet.status, "NEEDS_CORRECTION");
  const note = noteSchema.parse(formData.get("note"));
  await db.$transaction([
    db.applicationPacket.update({ where: { id: packetId }, data: { status: "NEEDS_CORRECTION" } }),
    db.clientCase.update({ where: { id: packet.clientCaseId }, data: { status: "NEEDS_CORRECTION" } }),
    db.reviewNote.create({ data: { packetId, authorId: user.id, note } }),
    db.auditEvent.create({ data: { userId: user.id, clientCaseId: packet.clientCaseId, action: "PACKET_RETURNED", entityType: "ApplicationPacket", entityId: packetId, metadata: `Packet version ${packet.version} returned with a correction note` } }),
  ]);
  redirect("/review");
}

export async function approvePacketAction(packetId: string) {
  const user = await requireRole(["REVIEWER"]);
  const packet = await db.applicationPacket.findUniqueOrThrow({ where: { id: packetId }, include: { fields: true, requirementOverrides: true } });
  const snapshot = parsePacketSnapshot(packet.snapshotJson);
  const overridden = new Set(packet.requirementOverrides.map((item) => item.requirementId));
  const rule = canApprovePacket({ status: packet.status, fields: packet.fields, unresolvedConflicts: packet.unresolvedConflicts, requirements: snapshot.requirements.map((item) => ({ ...item, overridden: overridden.has(item.id) })) });
  if (!rule.allowed) redirect(`/review/${packetId}?error=${encodeURIComponent(rule.reasons.join(" "))}`);
  assertPacketTransition(packet.status, "APPROVED");
  await db.$transaction([
    db.applicationPacket.update({ where: { id: packetId }, data: { status: "APPROVED", approvedById: user.id } }),
    db.clientCase.update({ where: { id: packet.clientCaseId }, data: { status: "APPROVED" } }),
    db.auditEvent.create({ data: { userId: user.id, clientCaseId: packet.clientCaseId, action: "PACKET_APPROVED", entityType: "ApplicationPacket", entityId: packetId, metadata: `Packet version ${packet.version} approved after human review` } }),
  ]);
  redirect(`/review/${packetId}`);
}
