// Route: /api/company-yearly-config — CRUD para configuración anual por empresa
import { Hono } from "hono";
import { z } from "zod";
import {
  getAllConfigsForCompany,
  createCompanyYearlyConfig,
  updateCompanyYearlyConfig,
  deleteCompanyYearlyConfig,
} from "../services/factory-yearly-config.js";

export const companyYearlyConfigRouter = new Hono();

const configSchema = z.object({
  companyId: z.number().int().positive(),
  fiscalYear: z.number().int().min(2000).max(2100),
  kyujitsuText: z.string().nullable().optional(),
  kyuukashori: z.string().nullable().optional(),
  hakensakiManagerName: z.string().nullable().optional(),
  hakensakiManagerDept: z.string().nullable().optional(),
  hakensakiManagerRole: z.string().nullable().optional(),
  hakensakiManagerPhone: z.string().nullable().optional(),
});

const updateSchema = configSchema.omit({ companyId: true, fiscalYear: true }).partial();

// GET /api/company-yearly-config/:companyId — todas las configs de una empresa
companyYearlyConfigRouter.get("/:companyId", async (c) => {
  try {
    const companyId = Number(c.req.param("companyId"));
    if (isNaN(companyId)) return c.json({ error: "companyId inválido" }, 400);
    const configs = await getAllConfigsForCompany(companyId);
    return c.json(configs);
  } catch (err: unknown) {
    return c.json({ error: String(err) }, 500);
  }
});

// POST /api/company-yearly-config — crear nueva config anual de empresa
companyYearlyConfigRouter.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = configSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const { companyId, fiscalYear, ...rest } = parsed.data;
    const config = await createCompanyYearlyConfig({
      companyId,
      fiscalYear,
      kyujitsuText: rest.kyujitsuText ?? null,
      kyuukashori: rest.kyuukashori ?? null,
      hakensakiManagerName: rest.hakensakiManagerName ?? null,
      hakensakiManagerDept: rest.hakensakiManagerDept ?? null,
      hakensakiManagerRole: rest.hakensakiManagerRole ?? null,
      hakensakiManagerPhone: rest.hakensakiManagerPhone ?? null,
    });
    return c.json(config, 201);
  } catch (err: unknown) {
    const msg = String(err);
    if (msg.includes("UNIQUE")) return c.json({ error: "この年度の設定はすでに存在します" }, 409);
    return c.json({ error: msg }, 500);
  }
});

// PUT /api/company-yearly-config/:id — actualizar config de empresa
companyYearlyConfigRouter.put("/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    if (isNaN(id)) return c.json({ error: "id inválido" }, 400);
    const body = await c.req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const updated = await updateCompanyYearlyConfig(id, parsed.data);
    if (!updated) return c.json({ error: "No encontrado" }, 404);
    return c.json(updated);
  } catch (err: unknown) {
    return c.json({ error: String(err) }, 500);
  }
});

// DELETE /api/company-yearly-config/:id — eliminar config de empresa
companyYearlyConfigRouter.delete("/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    if (isNaN(id)) return c.json({ error: "id inválido" }, 400);
    await deleteCompanyYearlyConfig(id);
    return c.json({ ok: true });
  } catch (err: unknown) {
    return c.json({ error: String(err) }, 500);
  }
});
