import { Prisma, type PrismaClient } from "@prisma/client";
import { requireOrganizationContext } from "./tenant-context";
import { directTenantModels, tenantParentsByModel, tenantScopeByModel } from "./tenant-scope";
import { sealAuditRows } from "./audit/chain";

type MutableArguments = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
  create?: Record<string, unknown>;
  update?: Record<string, unknown>;
};

type CountDelegate = { count(input: { where: Record<string, unknown> }): Promise<number> };

const readOrMutationOperations = new Set([
  "aggregate", "count", "delete", "deleteMany", "findFirst", "findFirstOrThrow", "findMany",
  "findUnique", "findUniqueOrThrow", "groupBy", "update", "updateMany", "upsert",
]);

function addScope(where: Record<string, unknown> | undefined, scope: Record<string, unknown>) {
  return { ...(where ?? {}), AND: [...(Array.isArray(where?.AND) ? where.AND : where?.AND ? [where.AND] : []), scope] };
}

function addDirectOrganization(data: Record<string, unknown>, organizationId: string) {
  if (data.organizationId && data.organizationId !== organizationId) throw new Error("Cross-organization write rejected.");
  return { ...data, organizationId };
}

export function createTenantDatabase(systemDb: PrismaClient, options: { databaseRls?: boolean } = {}) {
  async function runScoped<T>(organizationId: string, operation: Prisma.PrismaPromise<T>) {
    if (!options.databaseRls) return operation;
    const [, result] = await systemDb.$transaction([
      systemDb.$queryRaw(Prisma.sql`SELECT set_config('app.organization_id', ${organizationId}, true)`),
      operation,
    ]);
    return result;
  }

  async function assertOwnedParent(model: string, data: Record<string, unknown>, organizationId: string) {
    for (const parent of tenantParentsByModel[model] ?? []) {
      if (!(parent.foreignKey in data) || data[parent.foreignKey] === null) continue;
      const parentId = data[parent.foreignKey];
      if (typeof parentId !== "string") throw new Error(`Tenant-scoped ${model} writes require ${parent.foreignKey}.`);
      const delegateName = `${parent.model[0].toLowerCase()}${parent.model.slice(1)}`;
      const delegate = systemDb[delegateName as keyof typeof systemDb] as unknown as CountDelegate;
      const count = await runScoped(organizationId, delegate.count({ where: { id: parentId, ...tenantScopeByModel[parent.model](organizationId) } }) as unknown as Prisma.PrismaPromise<number>);
      if (count !== 1) throw new Error("Cross-organization parent reference rejected.");
    }
  }

  return systemDb.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const organizationId = requireOrganizationContext();
          const scopeFactory = tenantScopeByModel[model];
          if (!scopeFactory) throw new Error(`Model ${model} is not approved for tenant-scoped access.`);
          const mutable = args as MutableArguments;

          if (readOrMutationOperations.has(operation)) mutable.where = addScope(mutable.where, scopeFactory(organizationId));

          if (operation === "create" && mutable.data) {
            const data = mutable.data as Record<string, unknown>;
            mutable.data = directTenantModels.has(model) ? addDirectOrganization(data, organizationId) : data;
            await assertOwnedParent(model, mutable.data as Record<string, unknown>, organizationId);
            if (model === "AuditEvent" && !options.databaseRls) {
              const latest = await systemDb.auditEvent.findFirst({ where: { organizationId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
              mutable.data = sealAuditRows([mutable.data as Record<string, unknown>], organizationId, latest?.eventHash ?? null)[0];
            }
          }

          if (operation === "createMany" && mutable.data) {
            const rows = Array.isArray(mutable.data) ? mutable.data : [mutable.data];
            mutable.data = directTenantModels.has(model) ? rows.map((row) => addDirectOrganization(row, organizationId)) : mutable.data;
            for (const row of rows) await assertOwnedParent(model, row, organizationId);
            if (model === "AuditEvent" && !options.databaseRls) {
              const latest = await systemDb.auditEvent.findFirst({ where: { organizationId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
              mutable.data = sealAuditRows(mutable.data as Record<string, unknown>[], organizationId, latest?.eventHash ?? null);
            }
          }

          if (operation === "upsert" && mutable.create) {
            mutable.create = directTenantModels.has(model) ? addDirectOrganization(mutable.create, organizationId) : mutable.create;
            await assertOwnedParent(model, mutable.create, organizationId);
          }

          const updateData = operation === "upsert" ? mutable.update : operation === "update" || operation === "updateMany" ? mutable.data as Record<string, unknown> | undefined : undefined;
          if (updateData) {
            if (model === "AuditEvent") throw new Error("Audit events are append-only.");
            if (directTenantModels.has(model) && updateData.organizationId && updateData.organizationId !== organizationId) throw new Error("Cross-organization reassignment rejected.");
            await assertOwnedParent(model, updateData, organizationId);
          }

          if (model === "AuditEvent" && (operation === "delete" || operation === "deleteMany")) throw new Error("Audit events are append-only.");

          return runScoped(organizationId, query(args) as Prisma.PrismaPromise<unknown>);
        },
      },
    },
  });
}
