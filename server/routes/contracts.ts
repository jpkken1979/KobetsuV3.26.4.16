import { Hono } from "hono";
import { db, sqlite } from "../db/index.js";
import { contracts, contractEmployees, auditLog, employees, factories } from "../db/schema.js";
import { eq, and, not, desc, inArray, type SQL } from "drizzle-orm";
import { generateContractNumber } from "../services/contract-number.js";
import { cleanupPurgedContractDocuments } from "../services/document-index.js";
import { createContractSchema, updateContractSchema } from "../validation.js";
import { z } from "zod";
import {
  formatEmployeeLabel,
  getDuplicateEmployeeIds,
  getEmployeesOutsideFactory,
  getMissingEmployeeIds,
  getSelectedEmployeeIds,
} from "../services/contract-assignment.js";
import { parseIdParam } from "../services/db-utils.js";
import { buildContractEmployeeRows } from "../services/contract-writes.js";
import { createAutoBackup } from "../services/backup.js";

export const contractsRouter = new Hono();

class ContractValidationError extends Error {}

/** Verify that the factory belongs to the specified company and return factory data */
async function assertFactoryBelongsToCompany(factoryId: number, companyId: number) {
  const factory = await db.query.factories.findFirst({
    where: eq(factories.id, factoryId),
    columns: { id: true, companyId: true, factoryName: true, conflictDate: true },
  });
  if (!factory) {
    throw new ContractValidationError(`Factory ID ${factoryId} not found`);
  }
  if (factory.companyId !== companyId) {
    throw new ContractValidationError(
      `Factory "${factory.factoryName}" (company ${factory.companyId}) does not belong to the selected company (${companyId})`
    );
  }
  return factory;
}

async function assertSelectedEmployeesMatchFactory(factoryId: number, selectedEmployeeIds?: number[]) {
  if (!selectedEmployeeIds || selectedEmployeeIds.length === 0) {
    return;
  }

  const duplicateIds = getDuplicateEmployeeIds(selectedEmployeeIds);
  if (duplicateIds.length > 0) {
    throw new ContractValidationError(`Duplicate employees selected: ${duplicateIds.join(", ")}`);
  }

  const uniqueEmployeeIds = [...new Set(selectedEmployeeIds)];
  const selectedEmployees = await db.query.employees.findMany({
    where: inArray(employees.id, uniqueEmployeeIds),
    columns: {
      id: true,
      factoryId: true,
      fullName: true,
      employeeNumber: true,
    },
  });

  const missingIds = getMissingEmployeeIds(uniqueEmployeeIds, selectedEmployees.map((employee) => employee.id));
  if (missingIds.length > 0) {
    throw new ContractValidationError(`Selected employees not found: ${missingIds.join(", ")}`);
  }

  const outsideFactory = getEmployeesOutsideFactory(selectedEmployees, factoryId);
  if (outsideFactory.length > 0) {
    const labels = outsideFactory.map((employee) => formatEmployeeLabel(employee)).join(", ");
    throw new ContractValidationError(`Selected employees must belong to the chosen factory/line: ${labels}`);
  }
}

const VALID_CONTRACT_STATUSES = ["draft", "active", "expired", "cancelled", "renewed"] as const;

// GET /api/contracts
contractsRouter.get("/", async (c) => {
  try {
    const companyId = c.req.query("companyId");
    const status = c.req.query("status");
    const showCancelled = c.req.query("showCancelled") === "true";

    if (status && !VALID_CONTRACT_STATUSES.includes(status as typeof VALID_CONTRACT_STATUSES[number])) {
      return c.json({ error: `Invalid status. Allowed: ${VALID_CONTRACT_STATUSES.join(", ")}` }, 400);
    }

    const conditions: (SQL | undefined)[] = [
      companyId ? eq(contracts.companyId, Number(companyId)) : undefined,
      status
        ? eq(contracts.status, status as "draft" | "active" | "expired" | "cancelled" | "renewed")
        : !showCancelled ? not(eq(contracts.status, "cancelled")) : undefined,
    ];
    const valid = conditions.filter((c): c is SQL => c !== undefined);

    // Pagination with safe defaults
    const rawLimit = Number(c.req.query("limit")) || 0;
    const rawOffset = Number(c.req.query("offset")) || 0;
    const limit = rawLimit > 0 ? Math.min(rawLimit, 2000) : 500;
    const offset = rawOffset > 0 ? rawOffset : undefined;

    const results = await db.query.contracts.findMany({
      where: valid.length > 0 ? and(...valid) : undefined,
      orderBy: [desc(contracts.createdAt)],
      with: { company: true, factory: true, employees: { with: { employee: true } } },
      limit,
      ...(offset ? { offset } : {}),
    });
    return c.json(results);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Operation failed";
    return c.json({ error: message }, 500);
  }
});

// GET /api/contracts/:id
contractsRouter.get("/:id", async (c) => {
  try {
    const id = parseIdParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const contract = await db.query.contracts.findFirst({
      where: eq(contracts.id, id),
      with: {
        company: true,
        factory: true,
        employees: { with: { employee: true } },
        previousContract: true,
      },
    });
    if (!contract) return c.json({ error: "Contract not found" }, 404);
    return c.json(contract);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Operation failed";
    return c.json({ error: message }, 500);
  }
});

// POST /api/contracts
contractsRouter.post("/", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = createContractSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
    const { employeeIds, employeeAssignments, ...contractData } = parsed.data;
    const usesLegacyEmployeeIdsPayload = !employeeAssignments && Array.isArray(employeeIds);

    const factory = await assertFactoryBelongsToCompany(contractData.factoryId, contractData.companyId);
    if (factory.conflictDate && contractData.endDate && contractData.endDate > factory.conflictDate) {
      throw new ContractValidationError(
        `契約終了日(${contractData.endDate})が抵触日(${factory.conflictDate})を超えています`
      );
    }
    await assertSelectedEmployeesMatchFactory(
      contractData.factoryId,
      getSelectedEmployeeIds({ employeeAssignments, employeeIds }),
    );

    const contract = sqlite.transaction(() => {
      // Generate contract number inside transaction to avoid race conditions (API-1)
      if (!contractData.contractNumber) {
        contractData.contractNumber = generateContractNumber(contractData.startDate);
      }
      const c2 = db.insert(contracts).values(contractData as typeof contractData & { contractNumber: string }).returning().get();

      const assignments = buildContractEmployeeRows({
        contractId: c2.id,
        employeeAssignments,
        employeeIds,
      });
      if (assignments.length > 0) {
        db.insert(contractEmployees).values(assignments).run();
      }

      db.insert(auditLog).values({
        action: "create",
        entityType: "contract",
        entityId: c2.id,
        detail: `Created contract: ${c2.contractNumber} (company ${c2.companyId}, ¥${c2.hourlyRate}/h)${usesLegacyEmployeeIdsPayload ? " [legacy employeeIds payload]" : ""}`,
        userName: "system",
      }).run();

      return c2;
    })();

    // Deprecation notice vía headers estándar (RFC 7234 Warning + draft Deprecation header)
    if (usesLegacyEmployeeIdsPayload) {
      c.header("Deprecation", "true");
      c.header("Warning", '299 - "employeeIds is deprecated; use employeeAssignments: [{employeeId, hourlyRate?}] instead"');
    }
    return c.json(contract, 201);
  } catch (err: unknown) {
    if (err instanceof ContractValidationError) {
      return c.json({ error: err.message }, 400);
    }
    const message = err instanceof Error ? err.message : "Failed to create contract";
    return c.json({ error: message }, 500);
  }
});

// PUT /api/contracts/:id
contractsRouter.put("/:id", async (c) => {
  try {
    const id = parseIdParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const raw = await c.req.json();
    const parsed = updateContractSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
    const { employeeIds, employeeAssignments, ...contractData } = parsed.data;
    const usesLegacyEmployeeIdsPayload = !employeeAssignments && Array.isArray(employeeIds);

    const existing = await db.query.contracts.findFirst({
      where: eq(contracts.id, id),
      columns: {
        id: true,
        companyId: true,
        factoryId: true,
        status: true,
      },
    });

    if (!existing) return c.json({ error: "Contract not found" }, 404);

    if (existing.status === "cancelled") {
      return c.json({ error: "キャンセル済みの契約は編集できません" }, 409);
    }

    const nextFactoryId = contractData.factoryId ?? existing.factoryId;
    const nextCompanyId = contractData.companyId ?? existing.companyId;

    // Validate factory belongs to company when either changes
    if (contractData.factoryId || contractData.companyId) {
      const factory = await assertFactoryBelongsToCompany(nextFactoryId, nextCompanyId);
      const endDate = contractData.endDate;
      if (factory.conflictDate && endDate && endDate > factory.conflictDate) {
        throw new ContractValidationError(
          `契約終了日(${endDate})が抵触日(${factory.conflictDate})を超えています`
        );
      }
    } else if (contractData.endDate) {
      // endDate changed but factory didn't — still need to validate against conflictDate
      const factory = await db.query.factories.findFirst({
        where: eq(factories.id, nextFactoryId),
        columns: { conflictDate: true },
      });
      if (factory?.conflictDate && contractData.endDate > factory.conflictDate) {
        throw new ContractValidationError(
          `契約終了日(${contractData.endDate})が抵触日(${factory.conflictDate})を超えています`
        );
      }
    }

    let selectedEmployeeIds = getSelectedEmployeeIds({ employeeAssignments, employeeIds });

    if (selectedEmployeeIds === undefined && nextFactoryId !== existing.factoryId) {
      const existingAssignments = await db.query.contractEmployees.findMany({
        where: eq(contractEmployees.contractId, id),
        columns: {
          employeeId: true,
        },
      });
      selectedEmployeeIds = existingAssignments.map((assignment) => assignment.employeeId);
    }

    await assertSelectedEmployeesMatchFactory(nextFactoryId, selectedEmployeeIds);

    const result = sqlite.transaction(() => {
      const r = db
        .update(contracts)
        .set({ ...contractData, updatedAt: new Date().toISOString() })
        .where(eq(contracts.id, id))
        .returning()
        .get();

      if (!r) return null;
      if (employeeAssignments || employeeIds) {
        db.delete(contractEmployees).where(eq(contractEmployees.contractId, id)).run();
        const assignments = buildContractEmployeeRows({
          contractId: id,
          employeeAssignments,
          employeeIds,
        });
        if (assignments.length > 0) {
          db.insert(contractEmployees).values(assignments).run();
        }
      }

      db.insert(auditLog).values({
        action: "update",
        entityType: "contract",
        entityId: id,
        detail: `Updated contract: ${r.contractNumber}${usesLegacyEmployeeIdsPayload ? " [legacy employeeIds payload]" : ""}`,
        userName: "system",
      }).run();

      return r;
    })();

    if (!result) {
      return c.json({ error: "Contract not found or modified concurrently" }, 404);
    }

    // Deprecation notice vía headers estándar (RFC 7234 Warning + draft Deprecation header)
    if (usesLegacyEmployeeIdsPayload) {
      c.header("Deprecation", "true");
      c.header("Warning", '299 - "employeeIds is deprecated; use employeeAssignments: [{employeeId, hourlyRate?}] instead"');
    }
    return c.json(result);
  } catch (err: unknown) {
    if (err instanceof ContractValidationError) {
      return c.json({ error: err.message }, 400);
    }
    const message = err instanceof Error ? err.message : "Failed to update contract";
    return c.json({ error: message }, 500);
  }
});

const bulkIdsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "Al menos 1 ID requerido"),
});

// DELETE /api/contracts/bulk — bulk delete (soft delete → cancelled)
contractsRouter.post("/bulk-delete", async (c) => {
  try {
    const parsed = bulkIdsSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
    const { ids } = parsed.data;

    await createAutoBackup();
    const now = new Date().toISOString();
    const existingContracts = await db.query.contracts.findMany({
      where: inArray(contracts.id, ids),
    });
    const contractMap = new Map(existingContracts.map(c2 => [c2.id, c2]));

    const deleted = sqlite.transaction(() => {
      let count = 0;
      for (const id of ids) {
        const existing = contractMap.get(id);
        if (!existing) continue;
        db.update(contracts)
          .set({ status: "cancelled", updatedAt: now })
          .where(eq(contracts.id, id))
          .run();
        db.insert(auditLog).values({
          action: "delete",
          entityType: "contract",
          entityId: id,
          detail: `Bulk cancelled contract: ${existing.contractNumber}`,
          userName: "system",
        }).run();
        count++;
      }
      return count;
    })();

    return c.json({ success: true, deleted });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bulk delete failed";
    return c.json({ error: message }, 500);
  }
});

// POST /api/contracts/purge — hard delete cancelled contracts (permanent)
contractsRouter.post("/purge", async (c) => {
  try {
    const parsed = bulkIdsSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
    const { ids } = parsed.data;

    await createAutoBackup();
    const existingContracts = await db.query.contracts.findMany({
      where: inArray(contracts.id, ids),
    });
    const contractMap = new Map(existingContracts.map(c2 => [c2.id, c2]));

    const purgedResult = sqlite.transaction(() => {
      const purgedIds: number[] = [];
      for (const id of ids) {
        const existing = contractMap.get(id);
        if (!existing) continue;
        // Safety: only allow purging cancelled contracts
        if (existing.status !== "cancelled") continue;

        // Delete junction records first (FK)
        db.delete(contractEmployees)
          .where(eq(contractEmployees.contractId, id))
          .run();
        // Delete the contract
        db.delete(contracts)
          .where(eq(contracts.id, id))
          .run();

        db.insert(auditLog).values({
          action: "delete",
          entityType: "contract",
          entityId: id,
          detail: `Permanently purged contract: ${existing.contractNumber}`,
          userName: "system",
        }).run();
        purgedIds.push(id);
      }
      return purgedIds;
    })();

    let cleanup = { removedIndexes: 0, removedFiles: 0 };
    try {
      cleanup = await cleanupPurgedContractDocuments(purgedResult);
    } catch {
      // Cleanup failure is non-critical — purge already succeeded
    }

    return c.json({
      success: true,
      purged: purgedResult.length,
      cleanup,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Purge failed";
    return c.json({ error: message }, 500);
  }
});

// PATCH /api/contracts/:id/status — soft cancel / status transition only
const statusPatchSchema = z.object({
  status: z.enum(["draft", "active", "expired", "cancelled", "renewed"]),
});

contractsRouter.patch("/:id/status", async (c) => {
  try {
    const id = parseIdParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);

    const parsed = statusPatchSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

    const existing = await db.query.contracts.findFirst({
      where: eq(contracts.id, id),
      columns: { id: true, status: true, contractNumber: true },
    });
    if (!existing) return c.json({ error: "Contract not found" }, 404);

    const now = new Date().toISOString();
    db.update(contracts)
      .set({ status: parsed.data.status, updatedAt: now })
      .where(eq(contracts.id, id))
      .run();

    db.insert(auditLog).values({
      action: "update",
      entityType: "contract",
      entityId: id,
      detail: `Status changed: ${existing.contractNumber} ${existing.status} → ${parsed.data.status}`,
      userName: "system",
    }).run();

    return c.json({ success: true, status: parsed.data.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Status update failed";
    return c.json({ error: message }, 500);
  }
});

// DELETE /api/contracts/:id (soft delete → cancelled)
contractsRouter.delete("/:id", async (c) => {
  try {
    const id = parseIdParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const existing = await db.query.contracts.findFirst({
      where: eq(contracts.id, id),
    });
    if (!existing) return c.json({ error: "Contract not found" }, 404);

    sqlite.transaction(() => {
      db.update(contracts)
        .set({ status: "cancelled", updatedAt: new Date().toISOString() })
        .where(eq(contracts.id, id))
        .run();

      db.insert(auditLog).values({
        action: "delete",
        entityType: "contract",
        entityId: id,
        detail: `Cancelled contract: ${existing.contractNumber}`,
        userName: "system",
      }).run();
    })();

    return c.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete contract";
    return c.json({ error: message }, 500);
  }
});
